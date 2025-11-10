import { defineMiddleware } from "astro:middleware";
import { supabase } from "@/lib/supabase";

export const onRequest = defineMiddleware(async (context, next) => {
	const accessToken = context.cookies.get("sb-access-token")?.value;
	const refreshToken = context.cookies.get("sb-refresh-token")?.value;

	if (accessToken && refreshToken) {
		// Intentar usar el access token actual
		const { data, error } = await supabase.auth.setSession({
			access_token: accessToken,
			refresh_token: refreshToken,
		});

		if (error) {
			// Si el token expiró, intentar refrescar
			const { data: refreshData, error: refreshError } =
				await supabase.auth.refreshSession({
					refresh_token: refreshToken,
				});

			if (refreshError || !refreshData.session) {
				// Tokens inválidos, limpiar cookies
				context.cookies.delete("sb-access-token", { path: "/" });
				context.cookies.delete("sb-refresh-token", { path: "/" });
				context.locals.user = null;
				context.locals.session = null;
			} else {
				// Actualizar cookies con nuevos tokens
				context.cookies.set(
					"sb-access-token",
					refreshData.session.access_token,
					{
						path: "/",
						maxAge: 60 * 60 * 24 * 7,
						httpOnly: true,
						secure: import.meta.env.PROD,
						sameSite: "lax",
					},
				);

				context.cookies.set(
					"sb-refresh-token",
					refreshData.session.refresh_token,
					{
						path: "/",
						maxAge: 60 * 60 * 24 * 30,
						httpOnly: true,
						secure: import.meta.env.PROD,
						sameSite: "lax",
					},
				);

				context.locals.user = refreshData.user;
				context.locals.session = refreshData.session;
			}
		} else if (data.session) {
			// Sesión válida
			context.locals.user = data.user;
			context.locals.session = data.session;
		}
	} else {
		context.locals.user = null;
		context.locals.session = null;
	}

	return next();
});
