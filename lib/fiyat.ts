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

const gg = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

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
    // ── Yatirim fonu (PPF) — TEFAS kapali (guvenlik duvari), vekiller 403/zaman
    // asimi, Mynet sayfasi acildi ama fiyat yanlis yerden okundu (hisse seridi).
    // Bu tur: sayfalarin ne icerdigini DOKUP dogru ayiklayiciyi ona gore yazmak.
    {
      ad: 'mynet_dokum', ne: `Mynet fon sayfası dökümü — ${fon}`,
      url: `https://finans.mynet.com/fon/${fon.toLowerCase()}/`,
      oku: () => null, kanit: dokum(fon),
    },
    {
      ad: 'mynet_dokum2', ne: `Mynet fon sayfası (alternatif adres) — ${fon}`,
      url: `https://finans.mynet.com/borsa/fonlar/${fon.toLowerCase()}/`,
      oku: () => null, kanit: dokum(fon),
    },
    {
      ad: 'bigpara_fon', ne: `Bigpara fon sayfası — ${fon}`,
      url: `https://bigpara.hurriyet.com.tr/fonlar/fon-detay/${fon.toLowerCase()}/`,
      oku: etiketliFiyat, kanit: dokum(fon),
    },
    {
      ad: 'isyatirim_fon', ne: `İş Yatırım fon verisi — ${fon}`,
      url: `https://www.isyatirim.com.tr/_layouts/15/IsyatirimHisseForm/StockInfo.aspx?hisse=${fon}`,
      oku: etiketliFiyat, kanit: dokum(fon),
    },
    {
      ad: 'tefas_ip', ne: 'TEFAS — farklı yol (fon karşılaştırma ucu)',
      url: `https://www.tefas.gov.tr/api/DB/BindComparisonFundReturns`,
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
          referer: 'https://www.tefas.gov.tr/FonKarsilastirma.aspx',
        },
        body: new URLSearchParams({ calismatipi: '1', fontip: 'YAT', sfontur: '', kurucukod: '', fongrup: '', bastarih: gg(new Date(Date.now() - 10 * 86_400_000)), bittarih: gg(new Date()), fonturkod: '', fonunvantip: '', strperiod: '1,1,1,1,1,1,1', islemdurum: '1' }).toString(),
      },
      oku: (g) => { try { const j = JSON.parse(g); const d = Array.isArray(j?.data) ? j.data : []; return sayi(d.find((x: Record<string, unknown>) => String(x?.FONKODU ?? '').toUpperCase() === fon)?.SONFIYAT) } catch { return null } },
      kanit: (g) => g.slice(0, 300),
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
