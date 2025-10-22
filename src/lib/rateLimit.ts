import { supabaseServer } from "./supabase"

export async function rateLimit(key: string, windowSec = 60, maxHits = 1) {
    const now = new Date();
    const { data: row } = await supabaseServer
      .from('rate_limiter')
      .select('*')
      .eq('key', key)
      .single();

    if (!row) {
      const resetAt = new Date(now.getTime() + windowSec * 1000).toISOString();
      await supabaseServer.from('rate_limiter').insert({ key, hits: 1, reset_at: resetAt });
      return { allowed: true } as const;
    }

    if (new Date(row.reset_at) <= now) {
      const resetAt = new Date(now.getTime() + windowSec * 1000).toISOString();
      await supabaseServer.from('rate_limiter').update({ hits: 1, reset_at: resetAt }).eq('key', key);
      return { allowed: true } as const;
    }

    if ((row.hits ?? 0) + 1 > maxHits) {
      const retryAfter = Math.ceil((new Date(row.reset_at).getTime() - now.getTime()) / 1000);
      return { allowed: false, retryAfter } as const;
    }

    await supabaseServer
      .from('rate_limiter')
      .update({ hits: (row.hits ?? 0) + 1 })
      .eq('key', key);

  return { allowed: true } as const;
}
