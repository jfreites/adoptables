import { supabaseServer } from '@/lib/supabase';

export interface CreateUserProfileData {
  id: string;
  name: string;
  phone: string;
}

export interface CreateOrganizationData {
  slug: string;
  name: string;
  type: 'personal' | 'association';
}

export interface LinkUserToOrganizationData {
  user_id: string;
  org_id: string;
  role: 'owner' | 'admin' | 'member';
}

// Helper function to generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Helper function to ensure unique slug
export async function ensureUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;

  while (true) {
    const { data } = await supabaseServer
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!data) {
      return slug;
    }

    slug = `${generateSlug(baseName)}-${counter}`;
    counter++;
  }
}

// Create user profile
export async function createUserProfile(profileData: CreateUserProfileData) {
  const { data, error } = await supabaseServer
    .from('profiles')
    .insert({
      id: profileData.id,
      name: profileData.name,
      phone: profileData.phone
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating profile: ${error.message}`);
  }

  return data;
}

// Create organization
export async function createOrganization(orgData: CreateOrganizationData) {
  const { data, error } = await supabaseServer
    .from('organizations')
    .insert({
      slug: orgData.slug,
      name: orgData.name,
      type: orgData.type
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating organization: ${error.message}`);
  }

  return data;
}

// Link user to organization
export async function linkUserToOrganization(linkData: LinkUserToOrganizationData) {
  const { data, error } = await supabaseServer
    .from('user_organizations')
    .insert({
      user_id: linkData.user_id,
      org_id: linkData.org_id,
      role: linkData.role
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error linking user to organization: ${error.message}`);
  }

  return data;
}

// Get user profile with organization info
export async function getUserProfileWithOrganization(userId: string) {
  const { data, error } = await supabaseServer
    .from('profiles')
    .select(`
      *,
      user_organizations (
        role,
        organizations (
          id,
          slug,
          name,
          type
        )
      )
    `)
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Error fetching user profile: ${error.message}`);
  }

  return data;
}

// Complete user registration with profile and organization
export async function completeUserRegistration(
  userId: string,
  userData: {
    name: string;
    phone: string;
    orgType: 'personal' | 'association';
    orgName?: string;
    orgRole?: 'owner' | 'admin' | 'member';
  }
) {
  try {
    // Step 1: Create profile
    await createUserProfile({
      id: userId,
      name: userData.name,
      phone: userData.phone
    });

    // Step 2: Create organization
    const organizationName = userData.orgType === 'personal' ? userData.name : userData.orgName!;
    const slug = await ensureUniqueSlug(organizationName);

    const organization = await createOrganization({
      slug,
      name: organizationName,
      type: userData.orgType
    });

    // Step 3: Link user to organization
    const userRole = userData.orgType === 'personal' ? 'owner' : userData.orgRole!;
    await linkUserToOrganization({
      user_id: userId,
      org_id: organization.id,
      role: userRole
    });

    return {
      success: true,
      profile: { id: userId, name: userData.name, phone: userData.phone },
      organization,
      role: userRole
    };
  } catch (error) {
    console.error('Complete user registration error:', error);
    throw error;
  }
}

// Check if organization slug is available
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single();

  return !data;
}

// Get organization by slug
export async function getOrganizationBySlug(slug: string) {
  const { data, error } = await supabaseServer
    .from('organizations')
    .select(`
      *,
      user_organizations (
        role,
        profiles (
          id,
          name,
          phone
        )
      )
    `)
    .eq('slug', slug)
    .single();

  if (error) {
    throw new Error(`Error fetching organization: ${error.message}`);
  }

  return data;
}
