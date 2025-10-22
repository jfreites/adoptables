import type { Pet, PetAdoptionRule, ApplicationDraftStep1, ApplicationDraftStep2, ApplicationDraftStep3, EvaluateResult } from './types';

function minAgeFromBracket(b: ApplicationDraftStep1['ageBracket']) {
  return parseInt(b, 10);
}

function petsConflict(rule: PetAdoptionRule | undefined, otherPets: ApplicationDraftStep2['otherPets']) {
  const conflicts: string[] = [];
  if ((otherPets === 'cat' || otherPets === 'both') && rule && rule.accepts_other_cats === false) {
    conflicts.push('No convive con otros gatos');
  }
  if ((otherPets === 'dog' || otherPets === 'both') && rule && rule.accepts_other_dogs === false) {
    conflicts.push('No convive con perros');
  }
  return conflicts;
}

export function evaluateApplication(
  pet: Pet,
  rule: PetAdoptionRule | undefined,
  step1: ApplicationDraftStep1,
  step2: ApplicationDraftStep2,
  step3: ApplicationDraftStep3
): EvaluateResult {
  const knockouts: string[] = [];
  let score = 0;

  // 1) KO edad mínima
  const ageReal = minAgeFromBracket(step1.ageBracket);
  const minAge = rule?.min_age_years ?? 18;
  if (ageReal < minAge) {
    knockouts.push(`Edad mínima requerida: ${minAge} años`);
  }

  // 2) KO vivienda no permitida
  if (rule?.allowed_housing?.length && !rule.allowed_housing.includes(step2.housingType)) {
    knockouts.push('Tipo de vivienda no permitido para esta adopción');
  }

  // 3) KO permiso arrendador si renta
  if ((rule?.require_landlord_permission ?? true) && step2.housingType === 'rent' && !step2.landlordAllowsPets) {
    knockouts.push('Contrato de renta no permite mascotas');
  }

  // 4) KO free_roam
  if ((rule?.disallow_free_roam ?? true) && step2.petEnvironment === 'free_roam') {
    knockouts.push('Ambiente 100% exterior no permitido');
  }

  // 5) KO convivencia
  knockouts.push(...petsConflict(rule, step2.otherPets));

  // 6) Penalizaciones por horas
  const maxHours = rule?.max_hours_away_per_week;
  let hoursPenalty = 0;
  if (maxHours != null && step2.hoursAwayPerWeek > maxHours) {
    hoursPenalty = Math.min(25, Math.ceil((step2.hoursAwayPerWeek - maxHours) / 4));
  }
  let alonePenalty = 0;
  const maxAlone = rule?.max_hours_alone;
  if (maxAlone != null && step2.hoursAlonePerDay != null && step2.hoursAlonePerDay > maxAlone) {
    alonePenalty = Math.min(30, (step2.hoursAlonePerDay - maxAlone) * 4);
  }

  // KO requeridos “dog”
  if (pet.species === 'dog') {
    if ((rule?.require_home_visit ?? false) && !step2.yardSecure && step2.yardSecure === false) {
      // nota: en el original, la visita domiciliaria se valida también aparte
    }
    if ((rule?.require_home_visit ?? false) && step2?.['homeVisitOk'] === false) {
      knockouts.push('Se requiere visita domiciliaria.');
    }
    if ((rule?.require_fenced_or_secure ?? false) && step2.yardSecure === false) {
      knockouts.push('El entorno no es seguro (posibles salidas a la calle).');
    }
    if ((rule?.forbid_tethering ?? true) && step2.willNotTether === false) {
      knockouts.push('No se permite amarrar o encadenar al adoptado.');
    }
  }

  // 7) Scoring base
  // Vivienda
  score += step2.housingType === 'own' ? 20 : step2.housingType === 'with_family' ? 12 : step2.housingType === 'rent' ? 10 : 0;
  if (step2.housingType !== 'rent' || (step2.housingType === 'rent' && step2.landlordAllowsPets)) score += 10;

  // Estilo de vida: menos horas fuera = mejor (cap 60)
  score += Math.max(0, 20 - Math.min(step2.hoursAwayPerWeek, 60) / 3);

  // Ambiente
  score += step2.petEnvironment === 'indoor' ? 25 : step2.petEnvironment === 'indoor_with_enclosed' ? 20 : 0;

  // Motivación
  const minMot = rule?.min_motivation_chars ?? 120;
  const motLen = (step2.motivation?.trim().length ?? 0);
  if (motLen >= minMot) {
    score += Math.min(15, Math.floor((motLen / Math.max(1, minMot * 2)) * 15));
  } else {
    score -= Math.min(10, Math.ceil((minMot - motLen) / 40));
  }

  // Compromisos
  const req = rule?.require_commits ?? [];
  score += step3.commitSterilization ? 5 : (req.includes('sterilization') ? -10 : 0);
  score += step3.commitVaccines ? 5 : (req.includes('vaccines') ? -10 : 0);
  score += step3.acceptContract ? 5 : (req.includes('accept_contract') ? -10 : 0);

  // Presupuesto
  const budgetTable: Record<string, number> = { '100-200': -10, '200-300': -5, '300-400': 0, '400-500': 5, '500+': 8 };
  if (step2.monthlyBudget) score += budgetTable[step2.monthlyBudget] ?? 0;

  // Veterinario
  if (step2.hasVet) score += 8;
  if (step2.vetContact) score += 4;

  // Consentimiento familiar
  if (rule?.require_family_consent) {
    if (!step3.familyAgrees) score -= 30;
  } else {
    if (step3.familyAgrees) score += 5;
  }

  // Condominio
  if (step2.condoAllowsPets === false) {
    score -= 25;
    knockouts.push('Reglamento del condominio no permite mascotas');
  } else if (step2.condoAllowsPets === true) {
    score += 5;
  }

  // Dormir y viajes
  const sleep = (step2.sleepLocation || '').toLowerCase();
  if (sleep.includes('interior') || sleep.includes('habitación') || sleep.includes('sala')) score += 5;
  if (sleep.includes('exterior') || sleep.includes('azotea') || sleep.includes('patio abierto')) score -= 5;
  if (step2.travelCaretaker) score += 5;

  // Antecedentes negativos
  const bad = ['abandono','regalé','regale','perdí','perdi','murió por envenenamiento','murio por envenenamiento','lo dejé','lo deje','lo soltamos', 'se escapó','se escapo','lo entregué','lo entregue','maltrato','maltrató','maltrato animal','maltrato a un animal','no lo cuidé','no lo cuide','no podía con él','no podia con él','problemas económicos','problemas economicos','problemas de espacio','problemas de tiempo','alergia'];
  const outcome = (step2.priorPetsOutcome || '').toLowerCase();
  if (bad.some(w => outcome.includes(w))) score -= 15;

  // Penalizaciones por horas
  score -= hoursPenalty;
  score -= alonePenalty;

  // Dog specifics (bonus)
  if (pet.species === 'dog') {
    if (step2.willLeash)    score += 8;
    if (step2.idTagWillUse) score += 6;
    if (step2.trainingPlan) score += 6;
    if (step2.socialPlan)   score += 6;
    if (step2.yardSecure)   score += 10;
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  // Estado
  const status = knockouts.length
    ? 'rejected'
    : (bounded >= 80 ? 'interview' : (bounded >= 60 ? 'review' : 'rejected'));

  return { score: bounded, knockouts, status };
}
