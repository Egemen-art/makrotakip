import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Sunucu tarafi Supabase istemcisi (RSC, server action, route handler).
 * Oturumdaki kullanicinin JWT'siyle calisir; RLS bu sayede devrede kalir.
 * Varsayilan sema `finans` — bu projenin `public` semasinda baska bir
 * uygulama var, oraya dokunulmuyor.
 */
export async function supabaseSunucu() {
  const cookieDeposu = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'finans' },
      cookies: {
        getAll: () => cookieDeposu.getAll(),
        setAll: (cerezler) => {
          try {
            cerezler.forEach(({ name, value, options }) =>
              cookieDeposu.set(name, value, options),
            )
          } catch {
            // RSC icinden cagrildiginda cerez yazilamaz; oturum tazelemesini
            // middleware zaten yapiyor, sessizce gec.
          }
        },
      },
    },
  )
}
