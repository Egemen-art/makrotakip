import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/ortam'

/** Tarayici istemcisi — yalnizca giris/cikis akisinda kullanilir. */
export function supabaseTarayici() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { db: { schema: 'finans' } },
  )
}
