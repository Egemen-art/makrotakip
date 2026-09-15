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

  const servisAnahtari = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!servisAnahtari) {
    return NextResponse.json({ hata: 'SUPABASE_SERVICE_ROLE_KEY tanımlı değil.' }, { status: 503 })
  }
  const sb = createClient(SUPABASE_URL, servisAnahtari, {
    db: { schema: 'finans' }, auth: { persistSession: false, autoRefreshToken: false },
  })

  // Uc yol: Vercel Cron (CRON_SECRET), gorev/elle (INGEST_TOKEN), ya da
  // Supabase pg_cron — o token Vault'ta durur, DB fonksiyonu dogrular; Vercel
  // ortam degiskenine bagimli degildir (CRON_SECRET iki gun 401 verdi).
  let yetkili = esit(verilen, process.env.CRON_SECRET) || esit(verilen, process.env.INGEST_TOKEN)
  if (!yetkili && verilen.length >= 32) {
    const { data } = await sb.rpc('olcum_token_dogru', { p_token: verilen })
    yetkili = data === true
  }
  if (!yetkili) {
    // 401 iki gundur sessizce tekrarladi. Neden reddedildigi loglardan gorulsun —
    // sir degeri degil, yalnizca "var mi / uzunluk tutuyor mu".
    console.warn('olcum 401', JSON.stringify({
      baslikVar: baslik.length > 0,
      bearerVar: verilen.length > 0,
      verilenUzunluk: verilen.length,
      cronSecretTanimli: !!process.env.CRON_SECRET,
      cronSecretUzunluk: process.env.CRON_SECRET?.length ?? 0,
      ingestTokenTanimli: !!process.env.INGEST_TOKEN,
      kaynak: istek.headers.get('user-agent') ?? null,
    }))
    return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 401 })
  }

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
