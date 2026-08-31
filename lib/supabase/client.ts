import { createBrowserClient } from '@supabase/ssr'

/** Tarayici istemcisi — yalnizca giris/cikis akisinda kullanilir. */
export function supabaseTarayici() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'finans' } },
  )
}
