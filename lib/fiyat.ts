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

type Istek = { ad: string; ne: string; url: string; init?: RequestInit; oku: (govde: string) => number | null }

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

/** Stooq CSV: basligin altindaki satirda Close 7. sutun. */
function stooqOku(govde: string): number | null {
  const satir = govde.trim().split('\n')[1]
  return satir ? sayi(satir.split(',')[6]) : null
}

/** TEFAS BindHistoryInfo: data[].FIYAT */
function tefasOku(govde: string): number | null {
  try {
    const j = JSON.parse(govde)
    const d = Array.isArray(j?.data) ? j.data : []
    return d.length ? sayi(d[d.length - 1]?.FIYAT) : null
  } catch { return null }
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
    {
      ad: 'yahoo2_bist', ne: `BİST — ${bist}.IS (ikinci sunucu)`,
      url: `https://query2.finance.yahoo.com/v8/finance/chart/${bist}.IS?interval=1d&range=5d`,
      oku: yahooOku,
    },
    {
      ad: 'stooq_abd', ne: `ABD hisse — ${abd} (CSV)`,
      url: `https://stooq.com/q/l/?s=${abd.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`,
      oku: stooqOku,
    },
    {
      ad: 'stooq_bist', ne: `BİST — ${bist} (CSV)`,
      url: `https://stooq.com/q/l/?s=${bist.toLowerCase()}.tr&f=sd2t2ohlcv&h&e=csv`,
      oku: stooqOku,
    },
    {
      ad: 'tefas', ne: `Yatırım fonu — ${fon}`,
      url: 'https://www.tefas.gov.tr/api/DB/BindHistoryInfo',
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
      ad: 'genelpara_bist', ne: 'BİST toplu liste',
      url: 'https://api.genelpara.com/embed/borsa.json',
      oku: (g) => { try { const j = JSON.parse(g); return sayi(j?.[bist]?.satis ?? j?.[bist]?.son) } catch { return null } },
    },
  ]
}

/** Her kaynagi paralel dener; HTTP durumu, sure ve okunabilen fiyati dondurur. */
export async function fiyatTanisi(semboller: { bist: string; abd: string; fon: string }): Promise<KaynakDurumu[]> {
  return Promise.all(istekler(semboller).map(async (i): Promise<KaynakDurumu> => {
    const basla = Date.now()
    try {
      const r = await fetch(i.url, {
        ...i.init,
        signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
        cache: 'no-store',
        headers: {
          accept: '*/*',
          'user-agent': 'Mozilla/5.0 (compatible; finans-takip/1.0)',
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
