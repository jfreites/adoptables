import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_ANON_PUB_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true } })

export const supabaseServer = createClient(supabaseUrl, import.meta.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
