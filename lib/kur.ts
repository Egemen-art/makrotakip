import 'server-only'
import type { Kurlar } from '@/lib/tipler'
import { sayiOku as sayi } from '@/lib/bicim'

/**
 * Canli piyasa kurlari — yalniz sunucuda calisir.
 *
 * Kararlar (Egemen, 05.09.2026):
 *  - USD/EUR: canli piyasa kuru, ALIS tarafi (bugun satsan eline gececek).
 *  - Fiziksel altin: Turkiye piyasa GRAM ALIS fiyati. Ons ve USD/TRY bilgi olarak.
 *
 * Kaynaklar birbirinden bagimsiz, paralel ve zaman asimli cekilir; biri
 * duserse digerine dusulur. Hicbiri gelmezse alan null kalir ve `uyarilar`
 * bunu soyler — form o alani elle doldurtur. Sessizce uydurulmus rakam YOK.
 */

const TROY_ONS_GRAM = 31.1034768
const ZAMAN_ASIMI_MS = 6000

type Ham = Record<string, unknown>

async function jsonGetir(url: string): Promise<Ham> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    headers: { accept: 'application/json', 'user-agent': 'finans-takip/1.0' },
    next: { revalidate: 300 },
  })
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`)
  return (await r.json()) as Ham
}

/** Nesnede adi "alis"/"satis" gibi baslayan anahtari bul (Alış, Alis, Buying...). */
function alan(o: unknown, ...adaylar: string[]): number | null {
  if (!o || typeof o !== 'object') return null
  const norm = (k: string) => k.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/[^a-z]/g, '')
  for (const [k, v] of Object.entries(o as Ham)) {
    const nk = norm(k)
    if (adaylar.some((a) => nk.startsWith(a))) {
      const n = sayi(v)
      if (n !== null) return n
    }
  }
  return null
}

/* ── Kaynaklar ─────────────────────────────────────────────────────────── */

/** Turkiye piyasasi: USD, EUR, gram altin (alis/satis), ons. Tek kaynakta hepsi; ama resmi degil. */
async function truncgil() {
  const j = await jsonGetir('https://finans.truncgil.com/v4/today.json')
  return {
    usd_alis: alan(j.USD, 'alis', 'buying'), usd_satis: alan(j.USD, 'satis', 'selling'),
    eur_alis: alan(j.EUR, 'alis', 'buying'), eur_satis: alan(j.EUR, 'satis', 'selling'),
    gram_alis: alan(j.GRA, 'alis', 'buying'), gram_satis: alan(j.GRA, 'satis', 'selling'),
    ons_usd: alan(j.ONS, 'alis', 'buying'),
    zaman: typeof j.Update_Date === 'string' ? j.Update_Date : null,
  }
}

/** Gunluk referans kurlar (orta). Yedek. */
async function erApi() {
  const j = await jsonGetir('https://open.er-api.com/v6/latest/USD')
  const r = (j.rates ?? {}) as Ham
  const usd = sayi(r.TRY), eur = sayi(r.EUR)
  return { usdtry: usd, eurtry: usd !== null && eur ? usd / eur : null }
}

/** ECB referans (orta). Ikinci yedek. */
async function frankfurter() {
  const j = await jsonGetir('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR')
  const r = (j.rates ?? {}) as Ham
  const usd = sayi(r.TRY), eur = sayi(r.EUR)
  return { usdtry: usd, eurtry: usd !== null && eur ? usd / eur : null }
}

/** Ons USD, canli. */
async function goldApi() {
  const j = await jsonGetir('https://api.gold-api.com/price/XAU')
  return { ons_usd: sayi(j.price) }
}

/** Ons TRY (goldprice.org) -> has altin gram TL; piyasa makasi yok. Yedek. */
async function goldpriceTry() {
  const j = await jsonGetir('https://data-asg.goldprice.org/dbXRates/TRY')
  const ilk = (Array.isArray(j.items) ? j.items[0] : null) as Ham | null
  const onsTry = ilk ? sayi(ilk.xauPrice) : null
  return { gram_has_tl: onsTry !== null ? onsTry / TROY_ONS_GRAM : null }
}

/* ── Birlestirme ───────────────────────────────────────────────────────── */

const yuvarla = (n: number | null, basamak: number) =>
  n === null ? null : Number(n.toFixed(basamak))

export async function kurlariGetir(): Promise<Kurlar> {
  const [t, e, f, g, p] = await Promise.allSettled([truncgil(), erApi(), frankfurter(), goldApi(), goldpriceTry()])
  const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : null)
  const T = ok(t), E = ok(e), F = ok(f), G = ok(g), P = ok(p)

  const uyarilar: string[] = []
  const kaynak: Kurlar['kaynak'] = { usd: null, eur: null, altin_gram: null, ons: null }

  // USD/TRY — piyasa alis; yoksa referans (orta)
  let usdtry: number | null = null
  if (T?.usd_alis) { usdtry = T.usd_alis; kaynak.usd = 'piyasa alış (truncgil)' }
  else if (E?.usdtry) { usdtry = E.usdtry; kaynak.usd = 'referans orta (er-api)'; uyarilar.push('USD için piyasa alış gelmedi, referans orta kur kullanıldı.') }
  else if (F?.usdtry) { usdtry = F.usdtry; kaynak.usd = 'ECB referans (frankfurter)'; uyarilar.push('USD için piyasa alış gelmedi, ECB referans kuru kullanıldı.') }
  else uyarilar.push('USD/TRY hiçbir kaynaktan gelmedi — elle gir.')

  let eurtry: number | null = null
  if (T?.eur_alis) { eurtry = T.eur_alis; kaynak.eur = 'piyasa alış (truncgil)' }
  else if (E?.eurtry) { eurtry = E.eurtry; kaynak.eur = 'referans orta (er-api)' }
  else if (F?.eurtry) { eurtry = F.eurtry; kaynak.eur = 'ECB referans (frankfurter)' }
  else uyarilar.push('EUR/TRY hiçbir kaynaktan gelmedi — elle gir.')

  // Ons USD
  let ons: number | null = null
  if (G?.ons_usd) { ons = G.ons_usd; kaynak.ons = 'gold-api' }
  else if (T?.ons_usd) { ons = T.ons_usd; kaynak.ons = 'truncgil' }

  // Gram altin — piyasa ALIS; yoksa has altin (ons/31,1035 x kur), acikca isaretli
  let gramAlis: number | null = null
  let gramSatis: number | null = null
  if (T?.gram_alis) { gramAlis = T.gram_alis; gramSatis = T.gram_satis ?? null; kaynak.altin_gram = 'piyasa gram alış (truncgil)' }
  else if (P?.gram_has_tl) { gramAlis = P.gram_has_tl; kaynak.altin_gram = 'has altın: ons TL / 31,1035 (goldprice)'; uyarilar.push('Piyasa gram alış gelmedi; has altın (ons/31,1035) kullanıldı — piyasa gramından biraz düşük kalır.') }
  else if (ons !== null && usdtry !== null) { gramAlis = (ons / TROY_ONS_GRAM) * usdtry; kaynak.altin_gram = 'has altın: ons USD × USD/TRY'; uyarilar.push('Piyasa gram alış gelmedi; ons × kur ile hesaplandı — piyasa gramından biraz düşük kalır.') }
  else uyarilar.push('Gram altın hiçbir kaynaktan gelmedi — elle gir.')

  return {
    zaman: new Date().toISOString(),
    piyasa_zamani: T?.zaman ?? null,
    usdtry: yuvarla(usdtry, 4),
    eurtry: yuvarla(eurtry, 4),
    usdtry_satis: yuvarla(T?.usd_satis ?? null, 4),
    eurtry_satis: yuvarla(T?.eur_satis ?? null, 4),
    altin_gram_alis_tl: yuvarla(gramAlis, 2),
    altin_gram_satis_tl: yuvarla(gramSatis, 2),
    altin_ons_usd: yuvarla(ons, 2),
    kaynak,
    uyarilar,
  }
}

/* ── Teshis ────────────────────────────────────────────────────────────── */

const KAYNAK_URLLERI: Record<string, string> = {
  truncgil: 'https://finans.truncgil.com/v4/today.json',
  erApi: 'https://open.er-api.com/v6/latest/USD',
  frankfurter: 'https://api.frankfurter.app/latest?from=USD&to=TRY,EUR',
  goldApi: 'https://api.gold-api.com/price/XAU',
  goldpriceTry: 'https://data-asg.goldprice.org/dbXRates/TRY',
}

/** Her kaynagin ham durumu: HTTP kodu, sure, govdenin basi. Sessiz dususleri gormek icin. */
export async function kaynakTanisi() {
  const sonuc: Record<string, { ok: boolean; status: number | null; ms: number; tip: string | null; bas: string; hata: string | null }> = {}
  await Promise.all(Object.entries(KAYNAK_URLLERI).map(async ([ad, url]) => {
    const t0 = Date.now()
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(ZAMAN_ASIMI_MS), cache: 'no-store',
        headers: { accept: 'application/json', 'user-agent': 'finans-takip/1.0' },
      })
      const govde = await r.text()
      sonuc[ad] = { ok: r.ok, status: r.status, ms: Date.now() - t0, tip: r.headers.get('content-type'), bas: govde.slice(0, 400), hata: null }
    } catch (e) {
      sonuc[ad] = { ok: false, status: null, ms: Date.now() - t0, tip: null, bas: '', hata: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
    }
  }))
  return sonuc
}
