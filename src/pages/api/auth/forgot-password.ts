import type { APIRoute } from 'astro'
import { supabase } from '@/lib/supabase'

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData()
  const email = formData.get('email')?.toString()

  if (!email) {
    return redirect(`/forgot-password?error=${encodeURIComponent('Email is required')}`)
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${new URL(request.url).origin}/auth/reset-password`
  })

  if (error) {
    return redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`)
  }

  return redirect(`/forgot-password?message=${encodeURIComponent('Check your email for a password reset link')}`)
}
