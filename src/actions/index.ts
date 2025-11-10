import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
	publishPetForAdoption,
	listAvailablePets,
	uploadPetImages,
	getPetBySlug,
	getRecentPets,
} from "@/services/pets";
import { supabase } from "@/lib/supabase";
import { completeUserRegistration } from "@/services/auth";
import { makeSlug } from "@/lib/utils";

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
	listing_pets: defineAction({
		input: z.object({
			filter: z.array(z.string()),
			total: z.number(),
		}),
		async handler({ filter, total = 0 }) {
			const { data, pagination, success, error } = await listAvailablePets(
				filter,
				total,
			);

			if (!success) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: error ?? "Error obteniendo adoptables",
				});
			}

			return {
				success: true,
				data,
				pagination,
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
			pet_id: z.string().uuid(),
			name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
		}),
		handler: async (input, context) => {
			console.log(input);
			// Aquí iría la lógica para crear una solicitud de adopción
			// Por simplicidad, asumiremos que la función existe y funciona correctamente

			// const { success, error } = await createAdoptionRequest(pet_id, user_id, message);

			// if (!success) {
			// 	throw new ActionError({
			// 		code: "BAD_REQUEST",
			// 		message: error ?? "Error al enviar la solicitud de adopción",
			// 	});
			// }

			return {
				success: true,
				message: "Solicitud de adopción enviada exitosamente",
			};
		},
	}),
};
