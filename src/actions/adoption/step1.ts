// src/actions/adoption/step1.ts
import { step1Schema } from '@/lib/validation';
import { fetchPetAndRule, uploadDocuments } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export async function POST({ request }: { request: Request }) {
  const form = await request.formData();

  // 1) Validación campos
  const data = step1Schema.parse({
    petSlug: form.get('petSlug'),
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone'),
    city: form.get('city'),
    ageBracket: form.get('ageBracket'),
    occupation: form.get('occupation') || null,
    address: form.get('address') || null,
    household_count: form.get('household_count'),
    household_ages: form.get('household_ages') || null,
    otp: form.get('otp') || '',
    phoneVerified: form.get('phoneVerified') === 'true',
    docsConfirmed: JSON.parse(String(form.get('docsConfirmed') || '{}')),
  });

  const files = (form.getAll('documents') as File[]).filter((f) => f && typeof f.name === 'string');

  // 2) Cargar pet + rule
  const { pet, rule } = await fetchPetAndRule(data.petSlug);

  // 3) Reglas de documentos requeridos
  const required = Array.isArray(rule?.required_documents) ? rule!.required_documents : [];
  if (required.length) {
    if (!files.length) return new Response('Debes adjuntar los documentos solicitados.', { status: 400 });
    const confirmed = data.docsConfirmed || {};
    for (const type of required) {
      if (!confirmed[type]) return new Response(`Falta adjuntar/confirmar: ${type}.`, { status: 400 });
    }
  }

  // 4) Verificación OTP mínima (si la exiges antes de avanzar)
  if (!data.phoneVerified) {
    return new Response('Debes verificar tu teléfono para continuar.', { status: 400 });
  }

  // 5) Crear/actualizar application (draft) — puedes usar upsert por (email, pet_slug) si quieres continuar sesiones
  const { data: app, error } = await supabase
    .from('applications')
    .insert({
      pet_slug: pet.slug,
      adopter_name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      age_bracket: data.ageBracket,
      occupation: data.occupation,
      address: data.address,
      household_count: data.household_count,
      household_ages: data.household_ages,
      phone_verified_at: new Date().toISOString(),
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) return new Response(error.message, { status: 500 });

  // 6) Subir documentos
  if (files.length) await uploadDocuments(app.id, files, data.docsConfirmed);

  // 7) Guardar “answers atómicos” opcional
  const pairs: Record<string, any> = {
    'adopter.name': data.name,
    'adopter.email': data.email,
    'adopter.phone': data.phone,
    'adopter.city': data.city,
    'adopter.ageBracket': data.ageBracket,
    'adopter.occupation': data.occupation,
    'adopter.address': data.address,
    'adopter.household_count': data.household_count,
    'adopter.household_ages': data.household_ages,
  };
  const answers = Object.entries(pairs).map(([key, value]) => ({ application_id: app.id, key, value: { value } }));
  await supabase.from('application_answers').insert(answers);

  return new Response(null, { status: 303, headers: { Location: `?step=2&pet=${encodeURIComponent(pet.slug)}&app=${app.id}` } });
}
