import { NextResponse } from 'next/server'
import { kurlariGetir } from '@/lib/kur'

/**
 * GET /api/kur — canli piyasa kurlari (USD/TRY, EUR/TRY, gram altin, ons).
 * Yalniz herkese acik piyasa verisi tasir; kimlik gerektirmez (proxy.ts'te muaf).
 * 5 dakika onbelleklenir: ust kaynaklara en fazla 12 istek/saat gider.
 */
export const revalidate = 300

export async function GET() {
  const kurlar = await kurlariGetir()
  return NextResponse.json(kurlar, {
    headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
