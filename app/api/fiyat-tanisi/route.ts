import { NextResponse, type NextRequest } from 'next/server'
import { supabaseSunucu } from '@/lib/supabase/server'
import { fiyatTanisi } from '@/lib/fiyat'

/**
 * GET /api/fiyat-tanisi — portfoy adet bazina gecerken kullanilacak fiyat
 * uclarini canlidan dener ve sonucu finans.olaylar'a yazar (tur='teshis'),
 * boylece ajanlar sonucu veritabanindan okuyabilir.
 *
 * Oturum ister (proxy.ts muaf listesinde DEGIL) — disariya acik degildir.
 * Semboller sorgu ile degistirilebilir: ?bist=THYAO&abd=AAPL&fon=AFA
 */
export const dynamic = 'force-dynamic'

export async function GET(istek: NextRequest) {
  const s = istek.nextUrl.searchParams
  const semboller = {
    bist: (s.get('bist') || 'THYAO').toUpperCase(),
    abd: (s.get('abd') || 'AAPL').toUpperCase(),
    fon: (s.get('fon') || 'AFA').toUpperCase(),
  }

  const sonuc = await fiyatTanisi(semboller)
  const calisan = sonuc.filter((k) => k.ok && k.fiyat !== null).map((k) => `${k.ad}=${k.fiyat}`)

  // Sonucu ajanlarin gorebilecegi yere yaz; yazamazsa teshis yine de donsun.
  let yazildi: string | null = null
  try {
    const sb = await supabaseSunucu()
    const { error } = await sb.from('olaylar').insert({
      aktor: 'claude_code',
      tur: 'teshis',
      ozet: `Fiyat kaynagi teshisi — calisan: ${calisan.length ? calisan.join(', ') : 'yok'}`,
      detay: JSON.stringify({ semboller, sonuc: sonuc.map(({ bas, ...k }) => ({ ...k, bas: bas.slice(0, 700) })) }, null, 1),
      nesne: 'fiyat kaynaklari',
    })
    yazildi = error ? `olaylar yazilamadi: ${error.message}` : 'olaylar tablosuna yazildi'
  } catch (e) {
    yazildi = e instanceof Error ? `olaylar yazilamadi: ${e.message}` : 'olaylar yazilamadi'
  }

  return NextResponse.json({ semboller, calisan, kayit: yazildi, sonuc }, {
    headers: { 'cache-control': 'no-store' },
  })
}
