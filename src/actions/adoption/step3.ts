// src/actions/adoption/step3.ts
import { fetchPetAndRule } from '@/lib/utils';
import { step3SchemaByRule } from '@/lib/validation';
import { evaluateApplication } from '@/lib/evaluate';
import { supabase } from '@/lib/supabase';

export async function POST({ request }: { request: Request }) {
  const form = await request.formData();
  const petSlug = String(form.get('petSlug') || '');
  const appId = String(form.get('app') || '');

  const { pet, rule } = await fetchPetAndRule(petSlug);
  const schema = step3SchemaByRule(rule);
  const data = schema.parse({
    petSlug,
    commitSterilization: form.get('commitSterilization') === 'on' || form.get('commitSterilization') === 'true',
    commitVaccines: form.get('commitVaccines') === 'on' || form.get('commitVaccines') === 'true',
    acceptContract: form.get('acceptContract') === 'on' || form.get('acceptContract') === 'true',
    familyAgrees: form.get('familyAgrees') === 'on' || form.get('familyAgrees') === 'true',
  });

  // Cargar snapshot de application para componer evaluate()
  const { data: appRow, error: appErr } = await supabase
    .from('applications')
    .select('*')
    .eq('id', appId)
    .single();

  if (appErr || !appRow) return new Response('Application not found', { status: 404 });

  // Mapear a drafts (step1 + step2)
  const step1 = {
    name: appRow.adopter_name,
    email: appRow.email,
    phone: appRow.phone,
    city: appRow.city,
    ageBracket: appRow.age_bracket,
    occupation: appRow.occupation,
    address: appRow.address,
    household_count: appRow.household_count,
    household_ages: appRow.household_ages,
    phoneVerified: !!appRow.phone_verified_at,
  };

  const step2 = {
    housingType: appRow.housing_type,
    landlordAllowsPets: !!appRow.landlord_allows_pets,
    hoursAwayPerWeek: appRow.hours_away_per_week ?? 0,
    petEnvironment: appRow.pet_environment,
    otherPets: appRow.other_pets,
    motivation: appRow.motivation ?? '',
    condoAllowsPets: appRow.condo_allows_pets,
    priorPetsExperience: appRow.prior_pets_experience,
    priorPetsOutcome: appRow.prior_pets_outcome,
    sleepLocation: appRow.sleep_location,
    travelCaretaker: appRow.travel_caretaker,
    hoursAlonePerDay: appRow.hours_alone_per_day,

    yardSecure: appRow.yard_secure,
    willLeash: appRow.will_leash,
    willNotTether: appRow.will_not_tether,
    idTagWillUse: appRow.id_tag_will_use,
    trainingPlan: appRow.training_plan,
    socialPlan: appRow.social_plan,
    monthlyBudget: appRow.monthly_budget,
    hasVet: appRow.has_vet,
    vetContact: appRow.vet_contact,
    childrenYoungestAge: appRow.children_youngest_age,
  } as any;

  const step3 = {
    commitSterilization: data.commitSterilization,
    commitVaccines: data.commitVaccines,
    acceptContract: data.acceptContract,
    familyAgrees: data.familyAgrees ?? null,
  };

  const result = evaluateApplication(pet, rule, step1, step2, step3);

  // Persistir resultado final
  const { error } = await supabase.from('applications').update({
    status: result.status,
    score: result.score,
    knockouts: result.knockouts,
  }).eq('id', appId);

  if (error) return new Response(error.message, { status: 500 });

  // answers atómicos (opcional)
  await supabase.from('application_answers').insert([
    { application_id: appId, key: 'commit.sterilization', value: { value: step3.commitSterilization } },
    { application_id: appId, key: 'commit.vaccines', value: { value: step3.commitVaccines } },
    { application_id: appId, key: 'commit.acceptContract', value: { value: step3.acceptContract } },
    { application_id: appId, key: 'commit.familyAgrees', value: { value: step3.familyAgrees } },
  ]);

  return new Response(null, { status: 303, headers: { Location: `/adopt/${encodeURIComponent(pet.slug)}?step=done&app=${appId}` } });
}
