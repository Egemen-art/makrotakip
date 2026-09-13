import 'server-only'
import { kurlariGetir } from '@/lib/kur'

/**
 * Varlik fiyati okuyucusu — portfoy adet bazina gectiginde her varligin
 * gunluk degeri buradan olculur.
 *
 * Kaynaklar teshisle secildi (finans.olaylar, tur='teshis', id 150-160):
 *  - BIST hisse/ETF ve ABD hissesi: Yahoo chart ucu (~150 ms, para birimi de gelir).
 *  - Yatirim fonu: kurucunun kendi sayfasi. TEFAS Vercel'i guvenlik duvarinda
 *    kesiyor ("Request Rejected"), araci siteler 403/404 verdi.
 *  - Gram altin: mevcut /api/kur (karar 42).
 *
 * Kural: okunamayan fiyat NULL doner ve nedeni yazilir. Uydurma rakam yok.
 */

const ZAMAN_ASIMI_MS = 8000

export type FiyatKaynagi =
  | { tur: 'bist'; sembol: string }
  | { tur: 'abd'; sembol: string }
  | { tur: 'fon'; kod: string; kurucu: 'tera' }
  | { tur: 'gram_altin' }
  | { tur: 'nakit' }

export type Fiyat = {
  /** Birim fiyat; okunamadiysa null. */
  fiyat: number | null
  para: 'TRY' | 'USD' | null
  /** Fiyatin ait oldugu gun (kaynak soyluyorsa). Fon fiyatlari is gunudur, bugun olmayabilir. */
  tarih: string | null
  kaynak: string
  /** Fonlarda sayfada yayimlanan gunluk getiri (%) — ara gunleri ilerletmek icin. */
  gunlukGetiri?: number | null
  hata: string | null
}

async function metin(url: string): Promise<string> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    cache: 'no-store',
    headers: { accept: '*/*', 'user-agent': 'Mozilla/5.0 (compatible; finans-takip/1.0)' },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

/** HTML -> duz metin; sayisal varliklar COZULUR (Turkce harfler kaybolmasin). */
function duzMetin(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
}

const trSayi = (s: string) => {
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const AYLAR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık']

/** "11 Eylül 2026" -> "2026-09-11" */
function trTarih(metin: string): string | null {
  const m = metin.match(/([0-9]{1,2})\s+(\p{L}+)\s+([0-9]{4})/u)
  if (!m) return null
  const ay = AYLAR.indexOf(m[2].toLocaleLowerCase('tr'))
  if (ay < 0) return null
  return `${m[3]}-${String(ay + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/* ── Yahoo: BIST ve ABD ─────────────────────────────────────────────────── */

async function yahoo(sembol: string, bekleneParar: 'TRY' | 'USD'): Promise<Fiyat> {
  const kaynak = `Yahoo · ${sembol}`
  try {
    const j = JSON.parse(await metin(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=5d`,
    ))
    const meta = j?.chart?.result?.[0]?.meta
    const fiyat = Number(meta?.regularMarketPrice)
    const para = meta?.currency === 'TRY' || meta?.currency === 'USD' ? meta.currency : null
    if (!Number.isFinite(fiyat) || fiyat <= 0) return { fiyat: null, para: null, tarih: null, kaynak, hata: 'fiyat gelmedi' }
    // Para birimi beklenenden farkliysa cevirme yapilmaz, uyarilir.
    if (para !== bekleneParar) {
      return { fiyat, para, tarih: null, kaynak, hata: `para birimi ${para ?? 'bilinmiyor'}, beklenen ${bekleneParar}` }
    }
    const zaman = Number(meta?.regularMarketTime)
    return {
      fiyat,
      para,
      tarih: Number.isFinite(zaman) ? new Date(zaman * 1000).toISOString().slice(0, 10) : null,
      kaynak,
      hata: null,
    }
  } catch (e) {
    return { fiyat: null, para: null, tarih: null, kaynak, hata: e instanceof Error ? e.message : String(e) }
  }
}

/* ── Tera Portfoy: yatirim fonu ─────────────────────────────────────────── */

/** Fon kodunun sayfa adresi site haritasindan bulunur; adres tahmin edilmez. */
async function teraFonAdresi(kod: string): Promise<string | null> {
  const harita = await metin('https://www.teraportfoy.com/sitemap.xml')
  const desen = new RegExp(`-${kod}(/|$)`, 'i')
  return [...harita.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]).find((u) => desen.test(u)) ?? null
}

/**
 * Tera fon sayfasi duz metinde su sirayi tutar:
 *   "… 11 Eylül 2026 Son Güncelleme Tarihi 2,22949 Günlük Getiri (%) % 0,13 …"
 * Fiyat ve getiri SABIT ETIKETLERE yaslanarak okunur — sayinin bicimine gore
 * degil; oyle yapilirsa sayfadaki baska bir sayi yarin fiyat sanilir.
 */
async function teraFon(kod: string): Promise<Fiyat> {
  const kaynak = `Tera Portföy · ${kod}`
  try {
    const adres = await teraFonAdresi(kod)
    if (!adres) return { fiyat: null, para: null, tarih: null, kaynak, hata: 'fon sayfası site haritasında yok' }

    const duz = duzMetin(await metin(adres))
    const fiyatEs = duz.match(/Son Güncelleme Tarihi\s*([0-9]+,[0-9]{2,6})/i)
    const tarihEs = duz.match(/([0-9]{1,2}\s+\p{L}+\s+[0-9]{4})\s*Son Güncelleme Tarihi/u)
    const getiriEs = duz.match(/Günlük Getiri[^0-9%+-]{0,24}%?\s*(-?[0-9]+(?:,[0-9]+)?)/i)

    const fiyat = fiyatEs ? trSayi(fiyatEs[1]) : null
    return {
      fiyat,
      para: fiyat === null ? null : 'TRY',
      tarih: tarihEs ? trTarih(tarihEs[1]) : null,
      kaynak,
      gunlukGetiri: getiriEs ? trSayi(getiriEs[1]) : null,
      hata: fiyat === null ? 'sayfada "Son Güncelleme Tarihi" etiketinin yanında fiyat bulunamadı' : null,
    }
  } catch (e) {
    return { fiyat: null, para: null, tarih: null, kaynak, hata: e instanceof Error ? e.message : String(e) }
  }
}

/* ── Gram altin: mevcut kur ucu ─────────────────────────────────────────── */

async function gramAltin(): Promise<Fiyat> {
  const k = await kurlariGetir()
  return {
    fiyat: k.altin_gram_alis_tl,
    para: k.altin_gram_alis_tl === null ? null : 'TRY',
    tarih: k.piyasa_zamani ? null : null,
    kaynak: `/api/kur · ${k.kaynak.altin_gram ?? 'gram alış'}`,
    hata: k.altin_gram_alis_tl === null ? (k.uyarilar[0] ?? 'gram altın gelmedi') : null,
  }
}

/**
 * Belirli bir GUNUN USD/TRY (ya da EUR/TRY) kuru — Yahoo'nun kur serisinden.
 * Hareketin TL karsiligi bununla hesaplanir: Egemen yalnizca adet ve birim
 * fiyat yazsin diye. Kur gelmezse null doner; yaklasik kur uydurulmaz.
 */
export async function kurTarihli(para: 'USD' | 'EUR', tarih: string): Promise<number | null> {
  const sembol = para === 'USD' ? 'TRY=X' : 'EURTRY=X'
  const gun = Date.parse(`${tarih}T00:00:00Z`)
  if (!Number.isFinite(gun)) return null
  // Hafta sonu / tatil icin pencere genis tutulur; son kapanis alinir.
  const bas = Math.floor((gun - 6 * 86_400_000) / 1000)
  const son = Math.floor((gun + 86_400_000) / 1000)
  try {
    const j = JSON.parse(await metin(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sembol}?period1=${bas}&period2=${son}&interval=1d`,
    ))
    const kapanis: (number | null)[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    const gecerli = kapanis.filter((k): k is number => typeof k === 'number' && k > 0)
    if (gecerli.length > 0) return gecerli[gecerli.length - 1]
    const simdi = Number(j?.chart?.result?.[0]?.meta?.regularMarketPrice)
    return Number.isFinite(simdi) && simdi > 0 ? simdi : null
  } catch {
    return null
  }
}

/** Nakit: karar 49'un formulu zaten finans.v_nakit'te; oradan okunur. */
async function nakit(): Promise<Fiyat> {
  const { supabaseSunucu } = await import('@/lib/supabase/server')
  const sb = await supabaseSunucu()
  const { data, error } = await sb.from('v_nakit').select('toplam, yk_tarih').limit(1).single()
  if (error || !data) {
    return { fiyat: null, para: null, tarih: null, kaynak: 'v_nakit', hata: error?.message ?? 'nakit okunamadı' }
  }
  const toplam = Number(data.toplam)
  return {
    fiyat: Number.isFinite(toplam) ? toplam : null,
    para: 'TRY',
    // YK bakiyesinin tarihi degil BUGUN: eldeki nakit bugune ait.
    tarih: null,
    kaynak: 'v_nakit · YK + elde (karar 49)',
    hata: Number.isFinite(toplam) ? null : 'nakit sayiya çevrilemedi',
  }
}

export async function fiyatOku(kaynak: FiyatKaynagi): Promise<Fiyat> {
  switch (kaynak.tur) {
    case 'bist': return yahoo(`${kaynak.sembol}.IS`, 'TRY')
    case 'abd': return yahoo(kaynak.sembol, 'USD')
    case 'fon': return teraFon(kaynak.kod)
    case 'gram_altin': return gramAltin()
    case 'nakit': return nakit()
  }
}

/**
 * Gunluk fiyat GECMISI — kalem bazinda performans olcebilmek icin.
 * Yahoo'nun kendi serisi kullanilir; ara gunler uydurulmaz, kaynakta ne
 * varsa o yazilir (borsa tatilinde gun yoktur, olmasi da gerekmez).
 */
export async function fiyatGecmisi(
  kaynak: FiyatKaynagi,
  aralik: '1mo' | '3mo' | '6mo' | '1y' | '2y' = '1y',
): Promise<{ satirlar: { tarih: string; fiyat: number }[]; para: 'TRY' | 'USD' | null; hata: string | null }> {
  if (kaynak.tur !== 'bist' && kaynak.tur !== 'abd') {
    return { satirlar: [], para: null, hata: 'bu kaynakta geçmiş serisi yok' }
  }
  const sembol = kaynak.tur === 'bist' ? `${kaynak.sembol}.IS` : kaynak.sembol
  try {
    const j = JSON.parse(await metin(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=${aralik}`,
    ))
    const sonuc = j?.chart?.result?.[0]
    const zamanlar: number[] = sonuc?.timestamp ?? []
    const kapanis: (number | null)[] = sonuc?.indicators?.quote?.[0]?.close ?? []
    const para = sonuc?.meta?.currency === 'TRY' || sonuc?.meta?.currency === 'USD' ? sonuc.meta.currency : null

    const satirlar = zamanlar
      .map((z, i) => ({ tarih: new Date(z * 1000).toISOString().slice(0, 10), fiyat: kapanis[i] }))
      .filter((r): r is { tarih: string; fiyat: number } => typeof r.fiyat === 'number' && r.fiyat > 0)

    return { satirlar, para, hata: satirlar.length ? null : 'seri boş geldi' }
  } catch (e) {
    return { satirlar: [], para: null, hata: e instanceof Error ? e.message : String(e) }
  }
}
