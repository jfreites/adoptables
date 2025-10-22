import type { APIRoute } from 'astro';
import { supabaseServer } from '@/lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const token = String(form.get('code') || '').trim();
  if (!email || !token) return new Response('Missing email/code', { status: 400 });

  const { data, error } = await supabaseServer.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) return new Response(error.message, { status: 401 });

  // Success: mark as verified in your draft application if needed
  // e.g., update applications set phone_verified_at = now() where id = :app

  return new Response(null, { status: 204 });
};
