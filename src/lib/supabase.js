import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sign-in is by 6-digit code, never by a link, so nothing should ever pick a session out of
// the page URL: with the default (detectSessionInUrl: true) a crafted
// https://app/#access_token=... link silently signs the visitor in as someone else.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { detectSessionInUrl: false },
})
