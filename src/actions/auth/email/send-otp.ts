import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!email) return new Response('Email required', { status: 400 });

  const key = `otp:email:${email}`;
  const rl = await rateLimit(key, 60, 1); // 1 send / 60s
  if (!rl.allowed) return new Response(`Try again in ${rl.retryAfter}s`, { status: 429 });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,              // o false si no deseas auto-signup
      emailRedirectTo: undefined,          // OTP code only (no magic link redirect)
    },
  });
  if (error) return new Response(error.message, { status: 500 });

  return new Response(null, { status: 204 });
};
