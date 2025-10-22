import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies } = context;
  const pathname = url.pathname;

  // Define protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/profile', '/applications', '/favorites', '/publicar-adoptable'];

  // Define auth routes (redirect if already authenticated)
  const authRoutes = ['/login', '/register'];

  // Check if current route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Check if current route is an auth route
  const isAuthRoute = authRoutes.includes(pathname);

  // Get tokens from cookies for auth check
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  const hasValidTokens = accessToken && refreshToken;

  // Redirect authenticated users away from auth routes
  if (isAuthRoute && hasValidTokens) {
    return context.redirect('/dashboard');
  }

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !hasValidTokens) {
    return context.redirect('/login?next=' + pathname);
  }

  return next();
});
