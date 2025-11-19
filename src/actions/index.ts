import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
	publishPetForAdoption,
	uploadPetImages,
	getPetBySlug,
	getRecentPets,
} from "@/services/pets";
import { supabase } from "@/lib/supabase";
import { completeUserRegistration } from "@/services/auth";
import { makeSlug } from "@/lib/utils";
import { getPostBySlug } from "@/services/blog";

export const server = {
	publish_pet: defineAction({
		accept: "form",
		input: z.object({
			name: z.string(),
			species: z.string(),
			breed: z.string(),
			gender: z.string(),
			age: z.string(),
			size: z.string(),
			color: z.string(),
			location: z.string(),
			bio: z.string().min(10),
			org_id: z.string().uuid(),
			images: z
				.instanceof(File)
				.refine((file) => file.size <= 5000000, "Máximo 5MB por imagen")
				.refine(
					(file) =>
						["image/jpeg", "image/png", "image/webp"].includes(file.type),
					"Solo JPG, PNG o WebP",
				)
				.array()
				.max(4, "Máximo 4 imágenes")
				.optional(),
		}),
		async handler(
			{
				name,
				species,
				breed,
				gender,
				age,
				size,
				color,
				location,
				bio,
				org_id,
				images,
			},
			{ request },
		) {
			// Slug generation
			const slug = makeSlug(name, { randomLen: 8, withDate: false });

			const { success, error, petId } = await publishPetForAdoption(
				name,
				slug,
				species,
				breed,
				gender,
				age,
				size,
				color,
				location,
				bio,
				org_id,
			);

			if (!success || !petId) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message:
						error ??
						"Error al guardar los datos del adoptable. Intente de nuevo.",
				});
			}

			// Si hay imágenes, subirlas
			if (images && images.length > 0) {
				const { success: uploadSuccess, error: uploadError } =
					await uploadPetImages(petId, images);

				if (!uploadSuccess) {
					// Opcional: podrías eliminar la mascota si fallan las imágenes
					// o simplemente logear el error
					console.error("Error subiendo imágenes:", uploadError);

					throw new ActionError({
						code: "BAD_REQUEST",
						message:
							"La mascota se guardó pero hubo un error al subir las imágenes.",
					});
				}
			}

			return {
				success: true,
				message: "publicaste un adoptable",
			};
		},
	}),
	recent_pets: defineAction({
		input: z.object({
			limit: z.number().optional(),
		}),
		async handler({ limit = 4 }) {
			const { pets, success, error } = await getRecentPets(limit);

			if (!success) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: error ?? "Error obteniendo adoptables",
				});
			}

			return {
				pets,
				error: null,
			};
		},
	}),
	get_pet_by_slug: defineAction({
		input: z.object({
			slug: z.string().min(1),
		}),
		async handler({ slug }) {
			const { pet, error } = await getPetBySlug(slug);

			return {
				pet: pet,
			};
		},
	}),
	register: defineAction({
		accept: "form",
		input: z
			.object({
				email: z.string().email("Por favor ingresa un email válido"),
				password: z
					.string()
					.min(6, "La contraseña debe tener al menos 6 caracteres"),
				"confirm-password": z.string(),
				name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
				phone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
				orgType: z.enum(["personal", "association"], {
					errorMap: () => ({ message: "Selecciona el tipo de organización" }),
				}),
				orgName: z.string().optional(),
				orgRole: z.enum(["owner", "admin", "member"]).optional(),
			})
			.refine((data) => data.password === data["confirm-password"], {
				message: "Las contraseñas no coinciden",
				path: ["confirm-password"],
			})
			.refine(
				(data) => {
					if (data.orgType === "association") {
						return data.orgName && data.orgName.trim().length >= 2;
					}
					return true;
				},
				{
					message: "El nombre de la organización es requerido",
					path: ["orgName"],
				},
			)
			.refine(
				(data) => {
					if (data.orgType === "association") {
						return data.orgRole !== undefined;
					}
					return true;
				},
				{
					message: "Selecciona tu rol en la organización",
					path: ["orgRole"],
				},
			),
		async handler(
			{ email, password, name, phone, orgType, orgName, orgRole },
			{ request },
		) {
			// Step 1: Create user in Supabase Auth
			const { data: authData, error: authError } = await supabase.auth.signUp({
				email,
				password,
				options: {
					emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
				},
			});

			if (authError) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: authError.message,
				});
			}

			if (!authData.user) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Error al crear el usuario",
				});
			}

			try {
				// Step 2: Complete user registration with profile and organization
				await completeUserRegistration(authData.user.id, {
					name,
					phone,
					orgType,
					orgName,
					orgRole,
				});

				// Check if user needs email confirmation
				if (authData.user && !authData.session) {
					return {
						success: true,
						message:
							"¡Registro exitoso! Te hemos enviado un correo de confirmación. Por favor revisa tu bandeja de entrada y confirma tu cuenta.",
						requiresConfirmation: true,
					};
				}

				return {
					success: true,
					message: "¡Cuenta creada exitosamente!",
					user: authData.user,
				};
			} catch (error) {
				console.error("Registration error:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						error instanceof Error
							? error.message
							: "Error interno del servidor",
				});
			}
		},
	}),
	login: defineAction({
		accept: "form",
		input: z.object({
			email: z.string().email("Por favor ingresa un email válido"),
			password: z.string().min(1, "La contraseña es requerida"),
		}),
		async handler({ email, password }, context) {
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "Email o contraseña incorrectos",
				});
			}

			// IMPORTANTE: Guardar las cookies aquí
			context.cookies.set("sb-access-token", data.session.access_token, {
				path: "/",
				maxAge: 60 * 60 * 24 * 7, // 7 días
				httpOnly: true,
				secure: import.meta.env.PROD, // solo HTTPS en producción
				sameSite: "lax",
			});

			context.cookies.set("sb-refresh-token", data.session.refresh_token, {
				path: "/",
				maxAge: 60 * 60 * 24 * 30, // 30 días
				httpOnly: true,
				secure: import.meta.env.PROD,
				sameSite: "lax",
			});

			return {
				success: true,
				message: "¡Inicio de sesión exitoso!",
				user: data.user,
				session: data.session,
			};
		},
	}),
	logout: defineAction({
		accept: "form",
		input: z.object({}),
		async handler(_, context) {
			// Eliminar las cookies
			context.cookies.delete("sb-access-token", { path: "/" });
			context.cookies.delete("sb-refresh-token", { path: "/" });

			const { error } = await supabase.auth.signOut();

			if (error) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: error.message,
				});
			}

			return {
				success: true,
				message: "Sesión cerrada exitosamente",
			};
		},
	}),
	forgot_password: defineAction({
		accept: "form",
		input: z.object({
			email: z.string().email("Por favor ingresa un email válido"),
		}),
		async handler({ email }, { request }) {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: `${new URL(request.url).origin}/auth/reset-password`,
			});

			if (error) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: error.message,
				});
			}

			return {
				success: true,
				message:
					"Te hemos enviado un enlace de recuperación a tu correo electrónico",
			};
		},
	}),
	adoption_request: defineAction({
		accept: "form",
		input: z.object({
			// Pet
			pet_id: z.string().uuid("ID de mascota inválido"),
			
			// Personal Information
			name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
			lastname: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
			birthdate: z.string().min(1, "La fecha de nacimiento es requerida"),
			status: z.enum(["single", "married", "divorced", "other"], {
				errorMap: () => ({ message: "Selecciona un estado civil válido" }),
			}),
			city: z.string().min(2, "La ciudad es requerida"),
			personalId: z.string().min(5, "El número de INE/Pasaporte es requerido"),
			address: z.string().min(5, "La dirección es requerida"),
			zipcode: z.string().min(4, "El código postal es requerido"),
			email: z.string().email("Email inválido"),
			cellphone: z.string().min(10, "El número celular debe tener al menos 10 dígitos"),
			career: z.string().min(2, "La profesión es requerida"),
			"office-phone": z.string().optional(),
			
			// Personal References
			fullname1: z.string().min(3, "El nombre de la referencia 1 es requerido"),
			cellphone1: z.string().min(10, "El teléfono de la referencia 1 es requerido"),
			fullname2: z.string().min(3, "El nombre de la referencia 2 es requerido"),
			cellphone2: z.string().min(10, "El teléfono de la referencia 2 es requerido"),
			
			// Questionnaire
			q1: z.string().min(10, "Por favor explica tu motivación"),
			q2_others_pets: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q2_which_pets: z.string().optional(),
			q3_esterilized: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q3_why_not_sterilized: z.string().optional(),
			q4_had_other_pets: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q4_what_happened: z.string().optional(),
			q4_allow_home_visits: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q5_why_not_allow_home_visits: z.string().optional(),
			q7_persons: z.coerce.number().min(1, "Debe haber al menos 1 persona"),
			q8_agree_adopt: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q8_comments: z.string().optional(),
			q9_children: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q9_children_ages: z.string().optional(),
			q10_allergic: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q11_allowed_pets: z.enum(["yes", "no", "unkown"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q12: z.string().min(10, "Por favor explica qué harías"),
			q13: z.string().min(10, "Por favor explica qué harías"),
			q14: z.string().min(1, "Esta respuesta es requerida"),
			q15: z.string().min(10, "Por favor comparte tu visión"),
			q16_space_enough: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q16_description: z.string().optional(),
			q17: z.string().min(5, "Por favor describe dónde dormirá"),
			q18: z.string().min(5, "Por favor indica cuánto tiempo estará solo"),
			q19: z.string().min(10, "Por favor explica qué medidas tomarías"),
			q20_budget: z.enum(["100_300", "301_500", "501_700", "more_than_700"], {
				errorMap: () => ({ message: "Respuesta requerida" }),
			}),
			q21: z.string().min(2, "Esta respuesta es requerida"),
			
			// Care commitments (checkboxes)
			p22_cuidados: z.string().array().optional(),
			p23_cuidados: z.string().array().optional(),
			
			// Veterinary
			q23_veterinary: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q24: z.string().array().optional(),
			q25_resources: z.enum(["yes", "no"], { errorMap: () => ({ message: "Respuesta requerida" }) }),
			q25_details: z.string().optional(),
			
			// Acceptance
			aceptoCondiciones: z.literal("si", {
				errorMap: () => ({ message: "Debes aceptar las condiciones" }),
			}),
			informacionVeraz: z.literal("si", {
				errorMap: () => ({ message: "Debes confirmar que la información es veraz" }),
			}),
			
			// File upload
			ine_archivo: z
				.instanceof(File)
				.refine(
					(file) => file.size > 0 && file.size <= 10000000,
					"El archivo debe ser menor a 10MB"
				)
				.refine(
					(file) =>
						["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
							file.type
						),
					"Solo se permiten archivos JPG, PNG, WebP o PDF"
				)
				.optional(),
		}),
		handler: async (input, context) => {
			const {
				createAdoptionRequest,
				uploadIdDocument,
			} = await import("@/services/adoption");

			// Handle q24 array (veterinary name and phone)
			const q24Array = input.q24 || [];
			const q24_vet_name = q24Array[0] || undefined;
			const q24_vet_phone = q24Array[1] || undefined;
			
			// Prepare data for service
			const adoptionData = {
				pet_id: input.pet_id,
				name: input.name,
				lastname: input.lastname,
				birthdate: input.birthdate,
				status: input.status,
				city: input.city,
				personalId: input.personalId,
				address: input.address,
				zipcode: input.zipcode,
				email: input.email,
				cellphone: input.cellphone,
				career: input.career,
				officePhone: input["office-phone"],
				fullname1: input.fullname1,
				cellphone1: input.cellphone1,
				fullname2: input.fullname2,
				cellphone2: input.cellphone2,
				q1: input.q1,
				q2_others_pets: input.q2_others_pets,
				q2_which_pets: input.q2_which_pets,
				q3_esterilized: input.q3_esterilized,
				q3_why_not_sterilized: input.q3_why_not_sterilized,
				q4_had_other_pets: input.q4_had_other_pets,
				q4_what_happened: input.q4_what_happened,
				q4_allow_home_visits: input.q4_allow_home_visits,
				q5_why_not_allow_home_visits: input.q5_why_not_allow_home_visits,
				q7_persons: input.q7_persons,
				q8_agree_adopt: input.q8_agree_adopt,
				q8_comments: input.q8_comments,
				q9_children: input.q9_children,
				q9_children_ages: input.q9_children_ages,
				q10_allergic: input.q10_allergic,
				q11_allowed_pets: input.q11_allowed_pets,
				q12: input.q12,
				q13: input.q13,
				q14: input.q14,
				q15: input.q15,
				q16_space_enough: input.q16_space_enough,
				q16_description: input.q16_description,
				q17: input.q17,
				q18: input.q18,
				q19: input.q19,
				q20_budget: input.q20_budget,
				q21: input.q21,
				p22_cuidados: input.p22_cuidados,
				p23_cuidados: input.p23_cuidados,
				q23_veterinary: input.q23_veterinary,
				q24_vet_name,
				q24_vet_phone,
				q25_resources: input.q25_resources,
				q25_details: input.q25_details,
				aceptoCondiciones: input.aceptoCondiciones,
				informacionVeraz: input.informacionVeraz,
			};

			// Create adoption request
			const { success, error, requestId } = await createAdoptionRequest(adoptionData);

			if (!success || !requestId) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: error ?? "Error al enviar la solicitud de adopción",
				});
			}

			// Upload ID document if provided
			if (input.ine_archivo && input.ine_archivo.size > 0) {
				const uploadResult = await uploadIdDocument(requestId, input.ine_archivo);
				
				if (!uploadResult.success) {
					console.error("Error uploading document:", uploadResult.error);
					// Don't fail the request if document upload fails
					// Just log it and continue
				}
			}

			return {
				success: true,
				message: "Solicitud de adopción enviada exitosamente",
				requestId,
			};
		},
	}),
	get_blog_post_by_slug: defineAction({
		input: z.object({
			slug: z.string().min(1),
		}),
		async handler({ slug }) {
			const { post, error } = await getPostBySlug(slug);

			console.log(post);

			return {
				post,
			};
		},
	}),
};
