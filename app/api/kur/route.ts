import { NextResponse, type NextRequest } from 'next/server'
import { kaynakTanisi, kurlariGetir } from '@/lib/kur'

/**
 * GET /api/kur — canli piyasa kurlari (USD/TRY, EUR/TRY, gram altin, ons).
 * Yalniz herkese acik piyasa verisi tasir; kimlik gerektirmez (proxy.ts'te muaf).
 * Dogrulanmis sonuc 5 dk onbelleklenir (lib/kur.ts); ust cagrilar no-store.
 * ?ham=1 — teshis: her kaynagin HTTP durumu ve govde basi (onbelleksiz).
 */
export const dynamic = 'force-dynamic'

export async function GET(istek: NextRequest) {
  if (istek.nextUrl.searchParams.get('ham') === '1') {
    return NextResponse.json(await kaynakTanisi(), { headers: { 'cache-control': 'no-store' } })
  }
  const kurlar = await kurlariGetir()
  return NextResponse.json(kurlar, {
    headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
