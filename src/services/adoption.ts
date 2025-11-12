import { supabase, supabaseServer } from "@/lib/supabase";

export interface AdoptionRequestData {
	pet_id: string;
	// Personal Information
	name: string;
	lastname: string;
	birthdate: string;
	status: string;
	city: string;
	personalId: string;
	address: string;
	zipcode: string;
	email: string;
	cellphone: string;
	career: string;
	officePhone?: string;
	
	// Personal References
	fullname1: string;
	cellphone1: string;
	fullname2: string;
	cellphone2: string;
	
	// Questionnaire
	q1: string; // Why adopt
	q2_others_pets: string;
	q2_which_pets?: string;
	q3_esterilized: string;
	q3_why_not_sterilized?: string;
	q4_had_other_pets: string;
	q4_what_happened?: string;
	q4_allow_home_visits: string;
	q5_why_not_allow_home_visits?: string;
	q7_persons: number;
	q8_agree_adopt: string;
	q8_comments?: string;
	q9_children: string;
	q9_children_ages?: string;
	q10_allergic: string;
	q11_allowed_pets: string;
	q12: string; // Change of address
	q13: string; // Family changes
	q14: string; // Pet lifespan
	q15: string; // Vision in 5 years
	q16_space_enough: string;
	q16_description?: string;
	q17: string; // Where will pet sleep
	q18: string; // Time alone
	q19: string; // Behavior issues
	q20_budget: string;
	q21: string; // Who pays
	
	// Care commitments (checkboxes - multiple values)
	p22_cuidados?: string[];
	p23_cuidados?: string[];
	
	// Veterinary
	q23_veterinary: string;
	q24_vet_name?: string;
	q24_vet_phone?: string;
	q25_resources: string;
	q25_details?: string;
	
	// Acceptance
	aceptoCondiciones: string;
	informacionVeraz: string;
	
	// File path for INE/Passport
	ine_archivo_path?: string;
}

export const createAdoptionRequest = async (data: AdoptionRequestData) => {
	try {
		// Prepare the data for insertion
		const insertData = {
			pet_id: data.pet_id,
			
			// Personal information
			name: data.name,
			lastname: data.lastname,
			birthdate: data.birthdate,
			marital_status: data.status,
			city: data.city,
			personal_id: data.personalId,
			address: data.address,
			zipcode: data.zipcode.toString(),
			email: data.email,
			cellphone: data.cellphone,
			career: data.career,
			office_phone: data.officePhone,
			
			// Personal references
			reference1_name: data.fullname1,
			reference1_phone: data.cellphone1,
			reference2_name: data.fullname2,
			reference2_phone: data.cellphone2,
			
			// Questionnaire answers (stored as JSONB for flexibility)
			questionnaire_answers: {
				why_adopt: data.q1,
				has_other_pets: data.q2_others_pets,
				which_pets: data.q2_which_pets,
				pets_sterilized: data.q3_esterilized,
				why_not_sterilized: data.q3_why_not_sterilized,
				had_pets_before: data.q4_had_other_pets,
				what_happened_to_pets: data.q4_what_happened,
				allow_home_visits: data.q4_allow_home_visits,
				why_not_home_visits: data.q5_why_not_allow_home_visits,
				household_persons: data.q7_persons,
				all_agree_adopt: data.q8_agree_adopt,
				adoption_comments: data.q8_comments,
				has_children: data.q9_children,
				children_ages: data.q9_children_ages,
				has_allergies: data.q10_allergic,
				landlord_allows_pets: data.q11_allowed_pets,
				if_moving: data.q12,
				if_family_changes: data.q13,
				pet_lifespan_estimate: data.q14,
				vision_5_years: data.q15,
				has_enough_space: data.q16_space_enough,
				space_description: data.q16_description,
				where_pet_sleeps: data.q17,
				time_alone: data.q18,
				behavior_issues_plan: data.q19,
				monthly_budget: data.q20_budget,
				responsible_for_expenses: data.q21,
			},
			
			// Care commitments
			care_commitments: {
				basic_care: data.p22_cuidados || [],
				additional_care: data.p23_cuidados || [],
			},
			
			// Veterinary information
			has_veterinarian: data.q23_veterinary === 'yes',
			veterinarian_name: data.q24_vet_name,
			veterinarian_phone: data.q24_vet_phone,
			has_resources: data.q25_resources === 'yes',
			resources_details: data.q25_details,
			
			// Acceptance
			accepted_terms: data.aceptoCondiciones === 'si',
			confirmed_truthful: data.informacionVeraz === 'si',
			
			// File path
			id_document_path: data.ine_archivo_path,
			
			// Status
			status: 'pending',
			
			// Timestamps handled by DB
		};

		const { data: adoptionRequest, error } = await supabase
			.from("adoption_requests")
			.insert(insertData)
			.select("id")
			.single();

		if (error) {
			console.error("Error creating adoption request:", error);
			return {
				success: false,
				error: "Error al enviar la solicitud. Por favor intente de nuevo.",
				requestId: null,
			};
		}

		return {
			success: true,
			error: null,
			requestId: adoptionRequest.id,
		};
	} catch (error) {
		console.error("Unexpected error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error inesperado al procesar la solicitud",
			requestId: null,
		};
	}
};

export const uploadIdDocument = async (
	requestId: string,
	file: File
): Promise<{ success: boolean; error: string | null; path: string | null }> => {
	try {
		// Generate unique filename
		const fileExt = file.name.split(".").pop();
		const fileName = `adoption-requests/${requestId}/id-document-${Date.now()}.${fileExt}`;

		// Upload to Storage
		const { error: uploadError } = await supabaseServer.storage
			.from("documents")
			.upload(fileName, file, {
				cacheControl: "3600",
				upsert: false,
			});

		if (uploadError) {
			console.error("Upload error:", uploadError);
			return {
				success: false,
				error: "Error al subir el documento",
				path: null,
			};
		}

		// Update adoption request with file path
		const { error: updateError } = await supabase
			.from("adoption_requests")
			.update({ id_document_path: fileName })
			.eq("id", requestId);

		if (updateError) {
			// Clean up uploaded file if DB update fails
			await supabaseServer.storage.from("documents").remove([fileName]);
			return {
				success: false,
				error: "Error al actualizar la solicitud con el documento",
				path: null,
			};
		}

		return {
			success: true,
			error: null,
			path: fileName,
		};
	} catch (error) {
		console.error("Error uploading document:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error subiendo documento",
			path: null,
		};
	}
};
