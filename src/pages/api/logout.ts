import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ cookies, redirect }) => {
  try {
    // Clear authentication cookies
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });

    // Redirect to login with success message
    return redirect('/login?message=Sesión cerrada exitosamente');
  } catch (error) {
    console.error('Logout error:', error);

    // Even if there's an error, clear cookies and redirect
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });

    return redirect('/login?error=Error al cerrar sesión');
  }
}

export const GET: APIRoute = async ({ redirect }) => {
  // Redirect GET requests to login
  return redirect('/login');
}
