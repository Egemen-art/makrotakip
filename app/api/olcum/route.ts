import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/ortam'
import { gunlukOlcum, olcumOzeti, tokenliDepo } from '@/lib/olcum'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sabahki OTOMATIK gunluk olcum (karar 50).
 *
 *   GET/POST /api/olcum
 *   Authorization: Bearer <olcum_token>
 *
 * Tetikleyen: Supabase pg_cron (portfoy_gunluk_olcum; 09:30, 15:30, 18:30 TR) — token
 * Vault'ta durur, dogrulayan DB'dir (finans.olcum_yetki). Bu uc yalnizca
 * fiyatlari ceker; okuma/yazma anon istemciyle DB fonksiyonlari uzerinden
 * olur. Vercel'de hicbir ortam degiskeni (CRON_SECRET, servis anahtari)
 * gerekmez — iki gun 401/503 vermelerinin nedeni buydu.
 *
 * Sonuc finans.olaylar'a tur='olcum' olarak yazilir ki calisip calismadigi
 * veritabanindan gorulsun. proxy.ts'te muaf.
 */

async function calistir(istek: Request) {
  const baslik = istek.headers.get('authorization') ?? ''
  const token = baslik.startsWith('Bearer ') ? baslik.slice(7) : ''
  if (token.length < 32) {
    return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 401 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: 'finans' }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const depo = tokenliDepo(sb, token)
  const olayYaz = (ozet: string, detay?: string) =>
    sb.rpc('olcum_olay', { p_token: token, p_ozet: ozet, p_detay: detay ?? null })

  try {
    const sonuc = await gunlukOlcum(depo)
    const ozet = olcumOzeti(sonuc)
    await olayYaz(`Otomatik günlük ölçüm — ${ozet}`, JSON.stringify(sonuc))
    return NextResponse.json({ tamam: true, ozet, sonuc }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    const hata = e instanceof Error ? e.message : String(e)
    if (/yetkisiz/i.test(hata)) {
      console.warn('olcum 401', JSON.stringify({ tokenUzunluk: token.length, kaynak: istek.headers.get('user-agent') ?? null }))
      return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 401 })
    }
    await olayYaz(`Otomatik günlük ölçüm BAŞARISIZ — ${hata}`)
    return NextResponse.json({ tamam: false, hata }, { status: 500 })
  }
}

export const GET = calistir
export const POST = calistir
