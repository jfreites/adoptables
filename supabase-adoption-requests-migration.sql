-- Create adoption_requests table
CREATE TABLE IF NOT EXISTS public.adoption_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  
  -- Personal Information
  name text NOT NULL,
  lastname text NOT NULL,
  birthdate date NOT NULL,
  marital_status text NOT NULL CHECK (marital_status IN ('single', 'married', 'divorced', 'other')),
  city text NOT NULL,
  personal_id text NOT NULL,
  address text NOT NULL,
  zipcode text NOT NULL,
  email text NOT NULL,
  cellphone text NOT NULL,
  career text NOT NULL,
  office_phone text,
  
  -- Personal References
  reference1_name text NOT NULL,
  reference1_phone text NOT NULL,
  reference2_name text NOT NULL,
  reference2_phone text NOT NULL,
  
  -- Questionnaire answers (stored as JSONB for flexibility)
  questionnaire_answers jsonb NOT NULL,
  
  -- Care commitments
  care_commitments jsonb NOT NULL,
  
  -- Veterinary information
  has_veterinarian boolean DEFAULT false,
  veterinarian_name text,
  veterinarian_phone text,
  has_resources boolean DEFAULT false,
  resources_details text,
  
  -- Acceptance
  accepted_terms boolean NOT NULL DEFAULT false,
  confirmed_truthful boolean NOT NULL DEFAULT false,
  
  -- File path for ID document
  id_document_path text,
  
  -- Status tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'cancelled')),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_adoption_requests_pet_id ON public.adoption_requests(pet_id);
CREATE INDEX IF NOT EXISTS idx_adoption_requests_email ON public.adoption_requests(email);
CREATE INDEX IF NOT EXISTS idx_adoption_requests_status ON public.adoption_requests(status);
CREATE INDEX IF NOT EXISTS idx_adoption_requests_created_at ON public.adoption_requests(created_at);

-- Create trigger for updated_at
CREATE TRIGGER update_adoption_requests_updated_at
  BEFORE UPDATE ON public.adoption_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE public.adoption_requests ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own adoption requests
CREATE POLICY "Users can insert adoption requests"
  ON public.adoption_requests FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own adoption requests
CREATE POLICY "Users can view own adoption requests"
  ON public.adoption_requests FOR SELECT
  USING (auth.uid() IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Allow organization owners/admins to view adoption requests for their pets
CREATE POLICY "Organization admins can view adoption requests for their pets"
  ON public.adoption_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      INNER JOIN public.user_organizations uo ON uo.org_id = p.org_id
      WHERE p.id = adoption_requests.pet_id
      AND uo.user_id = auth.uid()
      AND uo.role IN ('owner', 'admin')
    )
  );

-- Allow organization owners/admins to update adoption requests for their pets
CREATE POLICY "Organization admins can update adoption requests for their pets"
  ON public.adoption_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      INNER JOIN public.user_organizations uo ON uo.org_id = p.org_id
      WHERE p.id = adoption_requests.pet_id
      AND uo.user_id = auth.uid()
      AND uo.role IN ('owner', 'admin')
    )
  );

-- Grant necessary permissions
GRANT ALL ON public.adoption_requests TO authenticated;
GRANT SELECT ON public.adoption_requests TO anon;

-- Create storage bucket for adoption documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view their own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
  );

-- Comment on table for documentation
COMMENT ON TABLE public.adoption_requests IS 'Stores adoption requests submitted by users for pets';
COMMENT ON COLUMN public.adoption_requests.questionnaire_answers IS 'JSONB field containing all questionnaire responses';
COMMENT ON COLUMN public.adoption_requests.care_commitments IS 'JSONB field containing care commitments selected by user';
COMMENT ON COLUMN public.adoption_requests.status IS 'Current status of the adoption request: pending, under_review, approved, rejected, cancelled';
