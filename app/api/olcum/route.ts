import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { SUPABASE_URL } from '@/lib/ortam'
import { gunlukOlcum, olcumOzeti } from '@/lib/olcum'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sabahki OTOMATIK gunluk olcum (karar 50).
 *
 *   GET/POST /api/olcum
 *   Authorization: Bearer <CRON_SECRET>   (Vercel Cron bunu kendisi ekler)
 *   Authorization: Bearer <INGEST_TOKEN>  (gorev ya da elle cagri)
 *
 * Oturumsuz calisir; yazma servis anahtariyla. proxy.ts'te muaf.
 * Sonuc finans.olaylar'a tur='olcum' olarak yazilir ki calisip calismadigi
 * veritabanindan gorulsun.
 */

function esit(verilen: string, beklenen: string | undefined) {
  if (!beklenen) return false
  const a = Buffer.from(verilen), b = Buffer.from(beklenen)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function calistir(istek: Request) {
  const baslik = istek.headers.get('authorization') ?? ''
  const verilen = baslik.startsWith('Bearer ') ? baslik.slice(7) : ''
  const yetkili = esit(verilen, process.env.CRON_SECRET) || esit(verilen, process.env.INGEST_TOKEN)
  if (!yetkili) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 401 })

  const servisAnahtari = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!servisAnahtari) {
    return NextResponse.json({ hata: 'SUPABASE_SERVICE_ROLE_KEY tanımlı değil.' }, { status: 503 })
  }
  const sb = createClient(SUPABASE_URL, servisAnahtari, {
    db: { schema: 'finans' }, auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const sonuc = await gunlukOlcum(sb)
    const ozet = olcumOzeti(sonuc)
    await sb.from('olaylar').insert({
      aktor: 'claude_code', tur: 'olcum',
      ozet: `Otomatik günlük ölçüm — ${ozet}`,
      detay: JSON.stringify(sonuc),
      nesne: 'finans.portfoy_gunluk',
    })
    return NextResponse.json({ tamam: true, ozet, sonuc }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    const hata = e instanceof Error ? e.message : String(e)
    await sb.from('olaylar').insert({
      aktor: 'claude_code', tur: 'olcum',
      ozet: `Otomatik günlük ölçüm BAŞARISIZ — ${hata}`,
      nesne: 'finans.portfoy_gunluk',
    })
    return NextResponse.json({ tamam: false, hata }, { status: 500 })
  }
}

export const GET = calistir
export const POST = calistir
