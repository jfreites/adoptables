// src/actions/adoption/step2.ts
import { fetchPetAndRule } from '@/lib/utils';
import { refineStep2ByRule } from '@/lib/validation';
import { supabase } from '@/lib/supabase';

export async function POST({ request }: { request: Request }) {
  const form = await request.formData();
  const petSlug = String(form.get('petSlug') || '');
  const appId = String(form.get('app') || '');

  const { pet, rule } = await fetchPetAndRule(petSlug);
  const schema = refineStep2ByRule(rule);
  const data = schema.parse({
    petSlug,
    housingType: form.get('housingType'),
    landlordAllowsPets: form.get('landlordAllowsPets'),
    hoursAwayPerWeek: form.get('hoursAwayPerWeek'),
    petEnvironment: form.get('petEnvironment'),
    otherPets: form.get('otherPets'),
    motivation: form.get('motivation') || '',
    condoAllowsPets: form.get('condoAllowsPets'),
    priorPetsExperience: form.get('priorPetsExperience'),
    priorPetsOutcome: form.get('priorPetsOutcome'),
    sleepLocation: form.get('sleepLocation'),
    travelCaretaker: form.get('travelCaretaker'),
    hoursAlonePerDay: form.get('hoursAlonePerDay'),

    yardSecure: form.get('yardSecure'),
    willLeash: form.get('willLeash'),
    willNotTether: form.get('willNotTether'),
    idTagWillUse: form.get('idTagWillUse'),
    trainingPlan: form.get('trainingPlan'),
    socialPlan: form.get('socialPlan'),
    monthlyBudget: form.get('monthlyBudget'),
    hasVet: form.get('hasVet'),
    vetContact: form.get('vetContact'),
    childrenYoungestAge: form.get('childrenYoungestAge'),
  });

  // actualizar application (draft)
  const { error } = await supabase.from('applications').update({
    housing_type: data.housingType,
    landlord_allows_pets: data.housingType === 'rent' ? !!data.landlordAllowsPets : null,
    hours_away_per_week: data.hoursAwayPerWeek,
    pet_environment: data.petEnvironment,
    other_pets: data.otherPets,
    motivation: data.motivation,
    condo_allows_pets: data.condoAllowsPets,
    prior_pets_experience: data.priorPetsExperience,
    prior_pets_outcome: data.priorPetsOutcome,
    sleep_location: data.sleepLocation,
    travel_caretaker: data.travelCaretaker,
    hours_alone_per_day: data.hoursAlonePerDay,

    yard_secure: data.yardSecure,
    will_leash: data.willLeash,
    will_not_tether: data.willNotTether,
    id_tag_will_use: data.idTagWillUse,
    training_plan: data.trainingPlan,
    social_plan: data.socialPlan,
    monthly_budget: data.monthlyBudget,
    has_vet: data.hasVet,
    vet_contact: data.vetContact,
    children_youngest_age: data.childrenYoungestAge,
  }).eq('id', appId);

  if (error) return new Response(error.message, { status: 500 });

  // answers atómicos (opcional): similar a step1
  // ...

  return new Response(null, { status: 303, headers: { Location: `?step=3&pet=${encodeURIComponent(pet.slug)}&app=${appId}` } });
}
