import { NextResponse } from 'next/server'
import { yahooSerisi } from '@/lib/fiyatKaynak'

/**
 * GET /api/kur/gecmis — son 1 yilin gunluk kapanislari: ons altin (USD),
 * USD/TRY, EUR/USD ve bunlardan turetilen gram altin (ons x USD/TRY / 31,1035).
 * Panodaki kur seridinin "dususte mi yukseliste mi" yuzdeleri buradan
 * hesaplanir (gun/hafta/ay/6 ay). Yalniz acik piyasa verisi; kimlik gerektirmez.
 * Kaynak Yahoo; seri gelmezse alan bos doner ve hata yazilir, uydurulmaz.
 */
export const dynamic = 'force-dynamic'

const TROY_ONS_GRAM = 31.1034768

export type KurGecmisi = {
  ons: { tarih: string; deger: number }[]
  gram: { tarih: string; deger: number }[]
  usdtry: { tarih: string; deger: number }[]
  eurusd: { tarih: string; deger: number }[]
  hatalar: Record<string, string>
  zaman: string
}

export async function GET() {
  const [ons, usdtry, eurusd] = await Promise.all([
    yahooSerisi('XAUUSD=X', '1y').then(async (r) => (r.satirlar.length ? r : yahooSerisi('GC=F', '1y'))),
    yahooSerisi('TRY=X', '1y'),
    yahooSerisi('EURUSD=X', '1y'),
  ])
  const seri = (r: { satirlar: { tarih: string; fiyat: number }[] }) => r.satirlar.map((s) => ({ tarih: s.tarih, deger: s.fiyat }))
  const kurHaritasi = new Map(usdtry.satirlar.map((s) => [s.tarih, s.fiyat]))
  const gram = ons.satirlar
    .filter((s) => kurHaritasi.has(s.tarih))
    .map((s) => ({ tarih: s.tarih, deger: (s.fiyat / TROY_ONS_GRAM) * kurHaritasi.get(s.tarih)! }))
  const hatalar: Record<string, string> = {}
  if (ons.hata) hatalar.ons = ons.hata
  if (usdtry.hata) hatalar.usdtry = usdtry.hata
  if (eurusd.hata) hatalar.eurusd = eurusd.hata

  const govde: KurGecmisi = { ons: seri(ons), gram, usdtry: seri(usdtry), eurusd: seri(eurusd), hatalar, zaman: new Date().toISOString() }
  return NextResponse.json(govde, {
    headers: { 'cache-control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  })
}
