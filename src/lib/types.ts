export type PetSpecies = "dog" | "cat";

export type OrgType = "personal" | "association";

export interface Pet {
	id: string;
	slug: string;
	name: string;
	species: PetSpecies;
}

export interface PetAdoptionRule {
	allowed_housing?: string[]; // ['own','rent','with_family']
	require_commits?: string[]; // ['sterilization','vaccines','accept_contract']
	min_age_years?: number;
	require_landlord_permission?: boolean;
	disallow_free_roam?: boolean;
	max_hours_away_per_week?: number | null;
	max_hours_alone?: number | null;
	children_min_age?: number | null;
	require_home_visit?: boolean;
	require_fenced_or_secure?: boolean;
	forbid_tethering?: boolean;
	required_documents?: string[]; // ['ine','proof_of_address',...]
	min_motivation_chars?: number; // p.ej. 120
	accepts_other_cats?: boolean;
	accepts_other_dogs?: boolean;
	require_family_consent?: boolean;
}

export interface ApplicationDraftStep1 {
	// --- Applicant + OTP + docs ---
	name: string;
	email: string;
	phone: string;
	city: string;
	ageBracket: "18" | "21" | "25" | "30" | "35" | "40" | "45" | "50";
	occupation?: string | null;
	address?: string | null;
	household_count?: number | null;
	household_ages?: string | null;

	// OTP
	phoneVerified?: boolean;
	otp?: string;

	// Documents
	docsConfirmed?: Record<string, boolean>;
}

export interface ApplicationDraftStep2 {
	housingType: "own" | "rent" | "with_family";
	landlordAllowsPets: boolean;
	hoursAwayPerWeek: number; // 0..168
	petEnvironment: "indoor" | "indoor_with_enclosed" | "free_roam";
	otherPets: "none" | "cat" | "dog" | "both";
	motivation?: string;

	// optional
	condoAllowsPets?: boolean | null;
	priorPetsExperience?: string | null;
	priorPetsOutcome?: string | null;
	sleepLocation?: string | null;
	travelCaretaker?: string | null;
	hoursAlonePerDay?: number | null;

	// dog-specific
	yardSecure?: boolean | null;
	willLeash?: boolean | null;
	willNotTether?: boolean | null;
	idTagWillUse?: boolean | null;
	trainingPlan?: string | null;
	socialPlan?: string | null;
	monthlyBudget?: "100-200" | "200-300" | "300-400" | "400-500" | "500+" | null;
	hasVet?: boolean | null;
	vetContact?: string | null;
	childrenYoungestAge?: number | null;
}

export interface ApplicationDraftStep3 {
	commitSterilization: boolean;
	commitVaccines: boolean;
	acceptContract: boolean;
	familyAgrees?: boolean | null;
}

export interface EvaluateResult {
	score: number; // 0..100
	knockouts: string[];
	status: "rejected" | "review" | "interview";
}

export interface Organization {
	id: string;
	slug: string;
	name: string;
	type: OrgType;
}
