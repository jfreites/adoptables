import { z } from 'astro:schema';
import type { Pet, PetAdoptionRule } from './types';

// Paso 1: incluye docs (hasta 6, 5MB c/u, tipos: pdf/jpg/jpeg/png/webp)
export const step1Schema = z.object({
  petSlug: z.string().min(1),
  name: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  city: z.string().min(2),
  ageBracket: z.enum(['18','21','25','30','35','40','45','50']),
  occupation: z.string().max(80).optional().nullable(),
  address: z.string().max(160).optional().nullable(),
  household_count: z.coerce.number().min(1).max(12).optional().nullable(),
  household_ages: z.string().max(120).optional().nullable(),

  // OTP (dummy)
  otp: z.string().optional(),
  phoneVerified: z.coerce.boolean().optional().default(false),

  // documents via multipart/form-data (se valida en runtime)
  // docsConfirmed: e.g. { ine: true, proof_of_address: true }
  docsConfirmed: z.record(z.boolean()).optional(),
});

export function refineStep2ByRule(rule?: PetAdoptionRule) {
  const allowedHousing = rule?.allowed_housing?.length ? rule.allowed_housing as any : ['own','rent','with_family'] as const;

  let shape = z.object({
    petSlug: z.string().min(1),
    housingType: z.enum(allowedHousing),
    landlordAllowsPets: z.coerce.boolean(),
    hoursAwayPerWeek: z.coerce.number().min(0).max(168),
    petEnvironment: z.enum(['indoor','indoor_with_enclosed','free_roam']),
    otherPets: z.enum(['none','cat','dog','both']),
    motivation: z.string().max(5000).optional().default(''),

    condoAllowsPets: z.coerce.boolean().optional().nullable(),
    priorPetsExperience: z.string().max(2000).optional().nullable(),
    priorPetsOutcome: z.string().max(2000).optional().nullable(),
    sleepLocation: z.string().max(200).optional().nullable(),
    travelCaretaker: z.string().max(200).optional().nullable(),
    hoursAlonePerDay: z.coerce.number().min(0).max(24).optional().nullable(),

    // dog-specific (opcional x regla)
    yardSecure: z.coerce.boolean().optional().nullable(),
    willLeash: z.coerce.boolean().optional().nullable(),
    willNotTether: z.coerce.boolean().optional().nullable(),
    idTagWillUse: z.coerce.boolean().optional().nullable(),
    trainingPlan: z.string().max(200).optional().nullable(),
    socialPlan: z.string().max(200).optional().nullable(),
    monthlyBudget: z.enum(['100-200','200-300','300-400','400-500','500+']).optional().nullable(),
    hasVet: z.coerce.boolean().optional().nullable(),
    vetContact: z.string().max(200).optional().nullable(),
    childrenYoungestAge: z.coerce.number().min(0).max(18).optional().nullable(),
  });

  return shape;
}

export function step3SchemaByRule(rule?: PetAdoptionRule) {
  const req = rule?.require_commits ?? [];
  const mustSter = req.includes('sterilization');
  const mustVac  = req.includes('vaccines');
  const mustAcc  = req.includes('accept_contract');
  const requireFamily = !!rule?.require_family_consent;

  return z.object({
    petSlug: z.string().min(1),
    commitSterilization: mustSter ? z.literal(true) : z.coerce.boolean(),
    commitVaccines: mustVac ? z.literal(true) : z.coerce.boolean(),
    acceptContract: mustAcc ? z.literal(true) : z.coerce.boolean(),
    familyAgrees: requireFamily ? z.literal(true) : z.coerce.boolean().optional().nullable(),
  });
}
