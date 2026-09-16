import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/ortam'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/enflasyon — aylik fiyat endekslerini kaynagindan cekip finans.enflasyon'a
 * yazar (karar 53). Asil yol veritabaninin kendi cekimi (pg_cron + pg_net); bu uc,
 * TCMB'nin Supabase'den gelen baglantiyi reddettigi durum icin YEDEK yoldur.
 *
 *   Authorization: Bearer <olcum_token>   (Vault; DB dogrular — /api/olcum ile ayni)
 *   ?seri=tufe|cpi|pce  (yoksa hepsi)     ?tani=1 (yazmaz, yalniz kaynak yanitini dondurur)
 *
 * Anahtarlar Vault'tan RPC ile alinir, burada saklanmaz. Kaynak ne verdiyse o
 * yazilir; okunamazsa olaylar'a hata duser, uydurma yok. proxy.ts'te muaf.
 */

const ZAMAN_ASIMI = 20000
type Satir = { ay: string; endeks: number }

const tarih = (d: Date) => d.toISOString().slice(0, 10)
const evdsTarih = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`
const ucYilOnce = () => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 3); return d }

async function evds(anahtar: string): Promise<{ satirlar: Satir[]; durum: number; bas: string }> {
  const url = `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.FG.J0&startDate=${evdsTarih(ucYilOnce())}&endDate=${evdsTarih(new Date())}&type=json&frequency=5`
  const r = await fetch(url, { headers: { key: anahtar, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 finans-takip' }, signal: AbortSignal.timeout(ZAMAN_ASIMI), cache: 'no-store' })
  const metin = await r.text()
  const bas = `[${r.status} ${r.headers.get('content-type') ?? ''}] ${metin.replace(/\s+/g, ' ').slice(0, 400)}`
  if (!r.ok) return { satirlar: [], durum: r.status, bas }
  let j: { items?: Record<string, string | null>[] }
  try { j = JSON.parse(metin) } catch { return { satirlar: [], durum: r.status, bas } }
  const satirlar: Satir[] = []
  for (const it of j.items ?? []) {
    const k = Object.keys(it).find((x) => x.startsWith('TP_FG_J0'))
    const v = k ? it[k] : null
    const t = it.Tarih
    if (!v || !t) continue
    const [y, a] = t.split('-')
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) continue
    satirlar.push({ ay: `${y}-${a.padStart(2, '0')}-01`, endeks: n })
  }
  return { satirlar, durum: r.status, bas }
}

async function fred(anahtar: string, seri: 'CPIAUCSL' | 'PCEPI'): Promise<{ satirlar: Satir[]; durum: number; bas: string }> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seri}&api_key=${encodeURIComponent(anahtar)}&file_type=json&observation_start=${tarih(ucYilOnce())}`
  const r = await fetch(url, { signal: AbortSignal.timeout(ZAMAN_ASIMI), cache: 'no-store' })
  const metin = await r.text()
  const bas = `[${r.status}] ${metin.slice(0, 300)}`
  if (!r.ok) return { satirlar: [], durum: r.status, bas }
  let j: { observations?: { date: string; value: string }[] }
  try { j = JSON.parse(metin) } catch { return { satirlar: [], durum: r.status, bas } }
  const satirlar = (j.observations ?? [])
    .filter((o) => o.value !== '.' && Number.isFinite(Number(o.value)))
    .map((o) => ({ ay: o.date, endeks: Number(o.value) }))
  return { satirlar, durum: r.status, bas }
}

export async function GET(istek: Request) {
  const baslik = istek.headers.get('authorization') ?? ''
  const token = baslik.startsWith('Bearer ') ? baslik.slice(7) : ''
  if (token.length < 32) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 401 })
  const url = new URL(istek.url)
  const istenen = url.searchParams.get('seri')
  const tani = url.searchParams.get('tani') === '1'
  const seriler = (['tufe', 'cpi', 'pce'] as const).filter((s) => !istenen || s === istenen)

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'finans' }, auth: { persistSession: false, autoRefreshToken: false } })
  const anahtar = async (ad: 'evds_anahtari' | 'fred_anahtari') => {
    const { data, error } = await sb.rpc('enflasyon_anahtar', { p_token: token, p_ad: ad })
    if (error) throw new Error(error.message)
    return (data as string | null) ?? null
  }

  const sonuc: Record<string, unknown> = {}
  try {
    for (const seri of seriler) {
      const ad = seri === 'tufe' ? 'evds_anahtari' : 'fred_anahtari'
      const k = await anahtar(ad)
      if (!k) { sonuc[seri] = { hata: `Vault'ta ${ad} yok` }; continue }
      let okuma: { satirlar: Satir[]; durum: number; bas: string }
      try {
        okuma = seri === 'tufe' ? await evds(k) : await fred(k, seri === 'cpi' ? 'CPIAUCSL' : 'PCEPI')
      } catch (e) {
        okuma = { satirlar: [], durum: 0, bas: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
      }
      // Anahtar govdede yankilanmasin (FRED hata mesajlari anahtari tekrar edebilir).
      const bas = okuma.bas.split(k).join('***')
      if (tani) { sonuc[seri] = { durum: okuma.durum, satir: okuma.satirlar.length, son: okuma.satirlar.at(-1) ?? null, bas }; continue }
      if (okuma.satirlar.length === 0) {
        await sb.rpc('enflasyon_olay', { p_token: token, p_ozet: `Enflasyon cekimi BASARISIZ (${seri}, Vercel yolu) — HTTP ${okuma.durum} — ${bas}` })
        sonuc[seri] = { hata: `HTTP ${okuma.durum}`, bas }
        continue
      }
      const kaynak = seri === 'tufe' ? 'EVDS TP.FG.J0' : seri === 'cpi' ? 'FRED CPIAUCSL' : 'FRED PCEPI'
      const { data, error } = await sb.rpc('enflasyon_yaz', { p_token: token, p_seri: seri, p_satirlar: okuma.satirlar, p_kaynak: kaynak })
      sonuc[seri] = error ? { hata: error.message } : { yazilan: data, son: okuma.satirlar.at(-1) }
    }
  } catch (e) {
    const hata = e instanceof Error ? e.message : String(e)
    if (/yetkisiz/i.test(hata)) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 401 })
    return NextResponse.json({ tamam: false, hata }, { status: 500 })
  }
  return NextResponse.json({ tamam: true, sonuc }, { headers: { 'cache-control': 'no-store' } })
}
