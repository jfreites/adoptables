-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for organization roles
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- Create organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('personal', 'association')),
  created_at timestamptz DEFAULT now()
);

-- Create profiles table (shadow of auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, -- = auth.users.id
  name text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_organizations relationship table
CREATE TABLE public.user_organizations (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

-- Create indexes for better performance
CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_type ON public.organizations(type);
CREATE INDEX idx_profiles_name ON public.profiles(name);
CREATE INDEX idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX idx_user_organizations_org_id ON public.user_organizations(org_id);
CREATE INDEX idx_user_organizations_role ON public.user_organizations(role);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Public organizations are viewable by everyone"
  ON public.organizations FOR SELECT
  USING (true);

CREATE POLICY "Users can insert organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own organizations"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = organizations.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User organizations policies
CREATE POLICY "Users can view their organization memberships"
  ON public.user_organizations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view organization members"
  ON public.user_organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = user_organizations.org_id
      AND uo.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert organization memberships"
  ON public.user_organizations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Organization owners/admins can manage memberships"
  ON public.user_organizations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = user_organizations.org_id
      AND uo.user_id = auth.uid()
      AND uo.role IN ('owner', 'admin')
    )
  );

-- Function to handle user signup and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Note: Profile creation will be handled by the application
  -- This trigger is here for potential future use
  RETURN NEW;
END;
$$;

-- Trigger for new user signup (commented out as we handle this in the app)
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_organizations TO authenticated;
GRANT SELECT ON public.organizations TO anon;

-- Sample data (optional - for testing)
-- INSERT INTO public.organizations (slug, name, type) VALUES
--   ('ejemplo-personal', 'Juan Pérez', 'personal'),
--   ('fundacion-amor-animal', 'Fundación Amor Animal A.C.', 'association');
