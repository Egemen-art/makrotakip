import 'server-only'

/**
 * Fiyat kaynagi TESHISI — hangi ucun canlidan gercekten cevap verdigini olcer.
 *
 * Portfoy adet bazina gecerken (hisse, fon, ETF, gram altin) her varlik icin
 * gunluk fiyat lazim. Kur kaynaklarindan farkli olarak bunlarin cogu resmi
 * degil; kirilgan olani secmemek icin once olculur, sonra semaya baglanir.
 * Sandbox bu adreslere cikamiyor, bu yuzden olcum Vercel'de calisir.
 */

const ZAMAN_ASIMI_MS = 8000

export type KaynakDurumu = {
  ad: string
  ne: string
  url: string
  ok: boolean
  status: number | null
  ms: number
  /** Kaynaktan okunabilen fiyat — null ise govde geldi ama fiyat cikarilamadi. */
  fiyat: number | null
  bas: string
  hata: string | null
}

type Istek = {
  ad: string
  ne: string
  url: string
  init?: RequestInit
  /** Istekten once cerez almak icin gezilecek sayfa (TEFAS oturum istiyor). */
  cerezUrl?: string
  oku: (govde: string) => number | null
  /** Yanitin hangi parcasi kanit olarak saklanacak; HTML'de govdenin basi ise yaramaz. */
  kanit?: (govde: string) => string
}

const sayi = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n !== 0 ? n : null
}

/** Yahoo chart yaniti: meta.regularMarketPrice */
function yahooOku(govde: string): number | null {
  try {
    const j = JSON.parse(govde)
    return sayi(j?.chart?.result?.[0]?.meta?.regularMarketPrice)
  } catch { return null }
}

const FON_ETIKETLERI = ['Son Fiyat', 'Birim Pay Değeri', 'Birim Pay Deger', 'Pay Fiyatı', 'Fiyat']

/** Sayfada fiyat etiketini bulup yanindaki TR bicimli sayiyi okur. */
function etiketliFiyat(govde: string): number | null {
  const duz = govde.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  for (const e of FON_ETIKETLERI) {
    const m = duz.match(new RegExp(`${e}[^0-9]{0,80}?([0-9]{1,3}(?:[.,][0-9]+)+)`, 'i'))
    if (m) {
      const n = sayi(m[1].replace(/\./g, '').replace(',', '.'))
      if (n !== null) return n
    }
  }
  return null
}

/** Sayfayi tanimak icin dokum: baslik, fon kodu geciyor mu, "fiyat" gecen ilk yerler. */
function dokum(fon: string) {
  return (govde: string) => {
    const baslik = govde.match(/<title[^>]*>([^<]{0,120})/i)?.[1]?.trim() ?? '(başlık yok)'
    const duz = govde.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
    const kodVar = new RegExp(`\\b${fon}\\b`, 'i').test(duz)
    const pencereler: string[] = []
    const re = /fiyat|pay değeri|birim pay/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(duz)) && pencereler.length < 3) {
      pencereler.push(duz.slice(Math.max(0, m.index - 30), m.index + 110))
    }
    return `başlık="${baslik}" · ${fon} geçiyor mu: ${kodVar ? 'evet' : 'HAYIR'} · ${pencereler.join(' ⟂ ') || 'fiyat kelimesi yok'}`
  }
}

/** Sayfadaki "fon" gecen baglantilari listeler — dogru fon sayfasini bulmak icin. */
function bagDokum(govde: string): string {
  const baslik = govde.match(/<title[^>]*>([^<]{0,90})/i)?.[1]?.trim() ?? '(başlık yok)'
  const baglar = [...govde.matchAll(/href="([^"]{3,120})"/gi)]
    .map((m) => m[1])
    .filter((h) => /fon|fund|fiyat|deger/i.test(h))
  const tekil = [...new Set(baglar)].slice(0, 14)
  return `başlık="${baslik}" · bağlantılar: ${tekil.join(' | ') || 'yok'}`
}


export function istekler({ bist, abd, fon }: { bist: string; abd: string; fon: string }): Istek[] {
  return [
    {
      ad: 'yahoo_bist', ne: `BİST hisse/ETF — ${bist}.IS`,
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${bist}.IS?interval=1d&range=5d`,
      oku: yahooOku,
    },
    {
      ad: 'yahoo_abd', ne: `ABD hisse — ${abd}`,
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${abd}?interval=1d&range=5d`,
      oku: yahooOku,
    },
    // ── Yatirim fonu (PPF) — Tera'nin sitesi "fetch failed" verdi (114 ms).
    // DNS calisiyor (teraportfoy.com.tr -> 93.89.226.17, TR IP, Cloudflare yok),
    // yani sorun baglanti/TLS seviyesinde. Varyantlari ve kontrol ucunu deneriz.
    {
      ad: 'tera_wwwsuz', ne: 'Tera Portföy — www olmadan (https)',
      url: 'https://teraportfoy.com.tr/',
      oku: () => null, kanit: bagDokum,
    },
    {
      ad: 'tera_http', ne: 'Tera Portföy — düz http',
      url: 'http://teraportfoy.com.tr/',
      oku: () => null, kanit: bagDokum,
    },
    {
      ad: 'tera_com', ne: 'Tera Portföy — .com alan adı',
      url: 'https://teraportfoy.com/',
      oku: () => null, kanit: bagDokum,
    },
    {
      ad: 'terayatirim', ne: 'Tera Yatırım (aracı kurum)',
      url: 'https://www.terayatirim.com/',
      oku: () => null, kanit: bagDokum,
    },
    {
      ad: 'kontrol_kap', ne: 'Kontrol: KAP ana sayfası açılıyor mu (.tr erişimi)',
      url: 'https://www.kap.org.tr/tr/',
      oku: (g) => (g.toLocaleLowerCase('tr').includes('kap') ? 1 : null),
      kanit: (g) => g.slice(0, 150),
    },
  ]
}

/** Her kaynagi paralel dener; HTTP durumu, sure ve okunabilen fiyati dondurur. */
export async function fiyatTanisi(semboller: { bist: string; abd: string; fon: string }): Promise<KaynakDurumu[]> {
  return Promise.all(istekler(semboller).map(async (i): Promise<KaynakDurumu> => {
    const basla = Date.now()
    try {
      // Cerez isteyen uclar icin once sayfayi gez, donen cerezi tasi.
      let cerez = ''
      if (i.cerezUrl) {
        const c = await fetch(i.cerezUrl, {
          signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
          cache: 'no-store',
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; finans-takip/1.0)' },
        })
        cerez = (c.headers.getSetCookie?.() ?? []).map((k) => k.split(';')[0]).join('; ')
      }

      const r = await fetch(i.url, {
        ...i.init,
        signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
        cache: 'no-store',
        headers: {
          accept: '*/*',
          'user-agent': 'Mozilla/5.0 (compatible; finans-takip/1.0)',
          ...(cerez ? { cookie: cerez } : {}),
          ...(i.init?.headers as Record<string, string> | undefined),
        },
      })
      const govde = await r.text()
      return {
        ad: i.ad, ne: i.ne, url: i.url, ok: r.ok, status: r.status, ms: Date.now() - basla,
        fiyat: r.ok ? i.oku(govde) : null,
        bas: (i.kanit ? i.kanit(govde) : govde.slice(0, 160)).slice(0, 700),
        hata: null,
      }
    } catch (e) {
      return {
        ad: i.ad, ne: i.ne, url: i.url, ok: false, status: null, ms: Date.now() - basla,
        fiyat: null, bas: '',
        hata: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      }
    }
  }))
}
