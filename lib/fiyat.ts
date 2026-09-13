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

/** TEFAS BindHistoryInfo: data[].FIYAT */
function tefasOku(govde: string): number | null {
  try {
    const j = JSON.parse(govde)
    const d = Array.isArray(j?.data) ? j.data : []
    return d.length ? sayi(d[d.length - 1]?.FIYAT) : null
  } catch { return null }
}

const FON_ETIKETLERI = ['Son Fiyat', 'Birim Pay Değeri', 'Birim Pay Deger', 'Pay Fiyatı', 'Fiyat']

/** Sayfada fiyat etiketini bulup yanindaki TR bicimli sayiyi okur. */
function etiketliFiyat(govde: string): number | null {
  const duz = govde.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  for (const e of FON_ETIKETLERI) {
    const m = duz.match(new RegExp(`${e}[^0-9]{0,80}?([0-9]{1,3}(?:[.,][0-9]+)+)`, 'i'))
    if (m) {
      const n = sayi(m[1].replace(/\./g, '').replace(',', '.'))
      if (n !== null) return n
    }
  }
  return null
}

/** Eslesen etiketin etrafindaki metin — rakamin dogru yerden geldigini gormek icin. */
function etiketKaniti(govde: string): string {
  const duz = govde.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  for (const e of FON_ETIKETLERI) {
    const i = duz.search(new RegExp(e, 'i'))
    if (i >= 0) return duz.slice(Math.max(0, i - 40), i + 160)
  }
  return duz.slice(0, 160)
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
    // ── Yatirim fonu (PPF) — TEFAS Vercel'i guvenlik duvarinda kesiyor
    // ("Request Rejected", ana sayfa dahil) ve API adresi tasinmis.
    // Ucuncu tur: metin vekilleri ve fon fiyatini yayinlayan siteler.
    {
      ad: 'jina_tefas', ne: `TEFAS fon sayfası, metin vekili üzerinden — ${fon}`,
      url: `https://r.jina.ai/https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${fon}`,
      oku: etiketliFiyat, kanit: etiketKaniti,
    },
    {
      ad: 'allorigins_tefas', ne: `TEFAS API, vekil üzerinden — ${fon}`,
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.tefas.gov.tr/api/DB/BindHistoryInfo?${tefasGovde.toString()}`)}`,
      oku: (g) => tefasOku(g) ?? etiketliFiyat(g), kanit: (g) => g.slice(0, 200),
    },
    {
      ad: 'mynet_fon', ne: `Mynet fon sayfası — ${fon}`,
      url: `https://finans.mynet.com/fon/${fon.toLowerCase()}/`,
      oku: etiketliFiyat, kanit: etiketKaniti,
    },
    {
      ad: 'uzmanpara_fon', ne: `Uzmanpara fon sayfası — ${fon}`,
      url: `https://uzmanpara.milliyet.com.tr/yatirim-fonlari/fon-detay/${fon}/`,
      oku: etiketliFiyat, kanit: etiketKaniti,
    },
    {
      ad: 'fonradar', ne: `Fonradar — ${fon}`,
      url: `https://fonradar.com/fon/${fon.toLowerCase()}`,
      oku: etiketliFiyat, kanit: etiketKaniti,
    },
    {
      ad: 'jina_mynet', ne: `Mynet, metin vekili üzerinden — ${fon}`,
      url: `https://r.jina.ai/https://finans.mynet.com/fon/${fon.toLowerCase()}/`,
      oku: etiketliFiyat, kanit: etiketKaniti,
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
        bas: (i.kanit ? i.kanit(govde) : govde.slice(0, 160)).slice(0, 220),
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
