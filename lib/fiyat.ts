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

/** TEFAS BindHistoryInfo: data[].FIYAT */
function tefasOku(govde: string): number | null {
  try {
    const j = JSON.parse(govde)
    const d = Array.isArray(j?.data) ? j.data : []
    return d.length ? sayi(d[d.length - 1]?.FIYAT) : null
  } catch { return null }
}

/** TEFAS FonAnaliz sayfasi: "Son Fiyat" basliginin altindaki deger. */
function fonAnalizOku(govde: string): number | null {
  const m = govde.replace(/\s+/g, ' ').match(/Son Fiyat[^0-9]{0,120}?([0-9]{1,3}(?:[.,][0-9]+)+)/i)
  if (!m) return null
  // TR bicimi: binlik nokta, ondalik virgul.
  return sayi(m[1].replace(/\./g, '').replace(',', '.'))
}

const gg = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

export function istekler({ bist, abd, fon }: { bist: string; abd: string; fon: string }): Istek[] {
  const bugun = new Date()
  const onGunOnce = new Date(bugun.getTime() - 10 * 86_400_000)
  const tefasGovde = new URLSearchParams({
    fontip: 'YAT', sfontur: '', fonkod: fon, fongrup: '',
    bastarih: gg(onGunOnce), bittarih: gg(bugun), fonturkod: '', fonunvantip: '',
  })

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
    // ── Yatirim fonu (PPF) — ilk turda TEFAS API'si 404/fault dondu.
    // Once "TEFAS bizi hic aliyor mu" diye ana sayfa, sonra varyantlar.
    {
      ad: 'tefas_anasayfa', ne: 'TEFAS ana sayfa (erişim testi)',
      url: 'https://www.tefas.gov.tr/',
      oku: (g) => (g.toLocaleLowerCase('tr').includes('tefas') ? 1 : null),
    },
    {
      ad: 'tefas_fonanaliz', ne: `TEFAS fon sayfası — ${fon}`,
      url: `https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${fon}`,
      oku: fonAnalizOku,
    },
    {
      ad: 'tefas_post_cerez', ne: `TEFAS API (çerez alarak) — ${fon}`,
      url: 'https://www.tefas.gov.tr/api/DB/BindHistoryInfo',
      cerezUrl: 'https://www.tefas.gov.tr/TarihselVeriler.aspx',
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
          referer: 'https://www.tefas.gov.tr/TarihselVeriler.aspx',
          origin: 'https://www.tefas.gov.tr',
        },
        body: tefasGovde.toString(),
      },
      oku: tefasOku,
    },
    {
      ad: 'tefas_get', ne: `TEFAS API (GET) — ${fon}`,
      url: `https://www.tefas.gov.tr/api/DB/BindHistoryInfo?${tefasGovde.toString()}`,
      oku: tefasOku,
    },
    {
      ad: 'yahoo_fon', ne: `Yahoo'da fon kodu — ${fon}.IS`,
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${fon}.IS?interval=1d&range=5d`,
      oku: yahooOku,
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
        bas: govde.slice(0, 160),
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
