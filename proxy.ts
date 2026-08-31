import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Her istekte Supabase oturumunu tazeler ve girisi zorunlu kilar.
 * `/api/ingest` haric tutulur — o uc kendi Bearer tokeniyla korunuyor.
 */
export async function proxy(istek: NextRequest) {
  let yanit = NextResponse.next({ request: istek })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => istek.cookies.getAll(),
        setAll: (cerezler) => {
          cerezler.forEach(({ name, value }) => istek.cookies.set(name, value))
          yanit = NextResponse.next({ request: istek })
          cerezler.forEach(({ name, value, options }) =>
            yanit.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !istek.nextUrl.pathname.startsWith('/giris')) {
    const url = istek.nextUrl.clone()
    url.pathname = '/giris'
    url.searchParams.set('devam', istek.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return yanit
}

export const config = {
  matcher: ['/((?!api/ingest|_next/static|_next/image|favicon.ico).*)'],
}
