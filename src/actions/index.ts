import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { publishPetForAdoption, listAvailablePets } from '@/services/pets';
import { supabase } from '@/lib/supabase';
import { completeUserRegistration } from '@/services/auth';

export const server = {
    publish_pet: defineAction({
        input: z.object({
            name: z.string(),
            bio: z.string()
        }),
        async handler({ name, bio }) {
            const { success, error } = await publishPetForAdoption(name, bio, 'cat')

            if (!success) {
                throw new ActionError({
                    code: 'BAD_REQUEST',
                    message: error ?? "Error al guardar los datos del adoptable. Intente de nuevo."
                })
            }

            return {
                success: true,
                message: "publicaste un adoptable"
            }
        }
    }),
    listing_pets: defineAction({
        input: z.object({
            filter: z.array(z.string()),
            total: z.number(),
        }),
        async handler({ filter, total = 0 }) {
            const { data, pagination, success, error } = await listAvailablePets(filter, total)

            if (!success) {
                throw new ActionError({
                    code: 'BAD_REQUEST',
                    message: error ?? "Error obteniendo adoptables"
                })
            }

            return {
                success: true,
                data,
                pagination
            }
        }
    }),
    recent_pets: defineAction({
        input: z.object({
            filter: z.array(z.string()),
        }),
        async handler({ filter }) {
            const { data, pagination, success, error } = await listAvailablePets(filter, 4)

            if (!success) {
                throw new ActionError({
                    code: 'BAD_REQUEST',
                    message: error ?? "Error obteniendo adoptables"
                })
            }

            return {
                success: true,
                data,
                pagination
            }
        }
    }),
    get_pet_by_slug: defineAction({
      input: z.object({
        slug: z.string().min(1)
      }),
      async handler({ slug }) {
        return {
          success: true,
          message: `aqui va el adoptable con slug ${slug}`
        }
      }
    }),
    register: defineAction({
      accept: 'form',
      input: z.object({
        email: z.string().email('Por favor ingresa un email válido'),
        password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
        'confirm-password': z.string(),
        name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
        phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
        orgType: z.enum(['personal', 'association'], {
          errorMap: () => ({ message: 'Selecciona el tipo de organización' })
        }),
        orgName: z.string().optional(),
        orgRole: z.enum(['owner', 'admin', 'member']).optional()
      }).refine((data) => data.password === data['confirm-password'], {
        message: "Las contraseñas no coinciden",
        path: ["confirm-password"],
      }).refine((data) => {
        if (data.orgType === 'association') {
          return data.orgName && data.orgName.trim().length >= 2;
        }
        return true;
      }, {
        message: "El nombre de la organización es requerido",
        path: ["orgName"],
      }).refine((data) => {
        if (data.orgType === 'association') {
          return data.orgRole !== undefined;
        }
        return true;
      }, {
        message: "Selecciona tu rol en la organización",
        path: ["orgRole"],
      }),
      async handler({ email, password, name, phone, orgType, orgName, orgRole }, { request }) {
        // Step 1: Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${new URL(request.url).origin}/auth/callback`
          }
        });

        if (authError) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: authError.message
          });
        }

        if (!authData.user) {
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error al crear el usuario'
          });
        }

        try {
          // Step 2: Complete user registration with profile and organization
          await completeUserRegistration(authData.user.id, {
            name,
            phone,
            orgType,
            orgName,
            orgRole
          });

          // Check if user needs email confirmation
          if (authData.user && !authData.session) {
            return {
              success: true,
              message: '¡Registro exitoso! Te hemos enviado un correo de confirmación. Por favor revisa tu bandeja de entrada y confirma tu cuenta.',
              requiresConfirmation: true
            };
          }

          return {
            success: true,
            message: '¡Cuenta creada exitosamente!',
            user: authData.user
          };

        } catch (error) {
          console.error('Registration error:', error);
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Error interno del servidor'
          });
        }
      }
    }),
    login: defineAction({
      accept: 'form',
      input: z.object({
        email: z.string().email('Por favor ingresa un email válido'),
        password: z.string().min(1, 'La contraseña es requerida')
      }),
      async handler({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw new ActionError({
            code: 'UNAUTHORIZED',
            message: 'Email o contraseña incorrectos'
          });
        }

        return {
          success: true,
          message: '¡Inicio de sesión exitoso!',
          user: data.user,
          session: data.session
        };
      }
    }),
    logout: defineAction({
      accept: 'form',
      input: z.object({}),
      async handler() {
        const { error } = await supabase.auth.signOut();

        if (error) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }

        return {
          success: true,
          message: 'Sesión cerrada exitosamente'
        };
      }
    }),
    forgot_password: defineAction({
      accept: 'form',
      input: z.object({
        email: z.string().email('Por favor ingresa un email válido')
      }),
      async handler({ email }, { request }) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${new URL(request.url).origin}/auth/reset-password`
        });

        if (error) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }

        return {
          success: true,
          message: 'Te hemos enviado un enlace de recuperación a tu correo electrónico'
        };
      }
    })
}
