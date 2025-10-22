import type { APIRoute } from 'astro'
import { supabase } from '@/lib/supabase'

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData()
  const email = formData.get('email')?.toString()
  const password = formData.get('password')?.toString()

  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: 'Email and password are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${new URL(request.url).origin}/auth/callback`
    }
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Check if user needs email confirmation
  if (data.user && !data.session) {
    return new Response(
      JSON.stringify({
        message: 'Registration successful! Please check your email to confirm your account.',
        requiresConfirmation: true
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (data.session) {
    // Set cookies for session management
    cookies.set('sb-access-token', data.session.access_token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax'
    })

    cookies.set('sb-refresh-token', data.session.refresh_token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax'
    })

    return redirect('/dashboard')
  }

  return new Response(
    JSON.stringify({ message: 'Registration successful!' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
