import { supabase } from './supabase';
import type { Pet, PetAdoptionRule } from './types';

export async function fetchPetAndRule(petSlug: string): Promise<{ pet: Pet; rule?: PetAdoptionRule }> {
  const { data, error } = await supabase
    .from('pets')
    .select('id, slug, name, species, rules:pet_adoption_rules(*)')
    //.eq('slug', petSlug)
    .eq('id', 1)
    .single();

  console.log(data, error)

  if (error || !data) throw new Error('Pet not found');

  const pet: Pet = { id: data.id, slug: data.slug, name: data.name, species: data.species };
  const rule = (data as any).rules as PetAdoptionRule | undefined;

  return { pet, rule };
}

export async function uploadDocuments(applicationId: string, files: File[], declaredTypes: Record<string, boolean> = {}) {
  const bucket = 'applications';
  const decl = Object.keys(declaredTypes).filter(k => declaredTypes[k]);

  for (const file of files) {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${applicationId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;

    // opcional: registra metadata en tabla application_documents
    await supabase.from('application_documents').insert({
      application_id: applicationId,
      path,
      declared_types: decl,
      mime: file.type,
      size: file.size,
    });
  }
}
