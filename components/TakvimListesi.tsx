import Link from 'next/link'
import { tarihKisa } from '@/lib/bicim'

/**
 * Yaklasan onemli tarihler (finans.takvim): TCMB/Fed faiz karari, TUFE, istihdam, PMI…
 * Resmi kaynaktan gelenler duz; kural bazli tahminler "tahmini" etiketiyle.
 * Saat Turkiye saati. Panoda kisa liste, /takvim sayfasinda uzun.
 */
export type TakvimSatiri = {
  anahtar: string
  tarih: string
  saat: string | null
  ulke: 'TR' | 'ABD' | 'EUR' | 'TUM'
  baslik: string
  onem: 'yuksek' | 'orta' | 'dusuk'
  kaynak: string | null
  tahmin: string | null
  onceki: string | null
  kural: boolean
}

const ULKE: Record<string, string> = { TR: 'TR', ABD: 'ABD', EUR: 'EUR', TUM: '—' }

/** Haftalik takvimin Ingilizce basliklari icin Turkce karsilik; eslesmeyen oldugu gibi kalir. */
const BASLIK_TR: Record<string, string> = {
  'Federal Funds Rate': 'Fed faiz kararı',
  'FOMC Statement': 'FOMC karar metni',
  'FOMC Press Conference': 'Fed basın toplantısı',
  'FOMC Economic Projections': 'Fed ekonomik projeksiyonları',
  'FOMC Meeting Minutes': 'FOMC toplantı tutanakları',
  'Non-Farm Employment Change': 'Tarım dışı istihdam (NFP)',
  'Unemployment Rate': 'İşsizlik oranı',
  'Average Hourly Earnings m/m': 'Ortalama saatlik kazanç (aylık)',
  'Unemployment Claims': 'Haftalık işsizlik başvuruları',
  'CPI m/m': 'TÜFE (aylık)',
  'CPI y/y': 'TÜFE (yıllık)',
  'Core CPI m/m': 'Çekirdek TÜFE (aylık)',
  'PPI m/m': 'ÜFE (aylık)',
  'Core PPI m/m': 'Çekirdek ÜFE (aylık)',
  'Core PCE Price Index m/m': 'Çekirdek PCE (aylık)',
  'ISM Manufacturing PMI': 'ISM İmalat PMI',
  'ISM Services PMI': 'ISM Hizmet PMI',
  'Flash Manufacturing PMI': 'İmalat PMI (öncü)',
  'Flash Services PMI': 'Hizmet PMI (öncü)',
  'Retail Sales m/m': 'Perakende satışlar (aylık)',
  'Core Retail Sales m/m': 'Çekirdek perakende satışlar (aylık)',
  'Advance GDP q/q': 'GSYH öncü (çeyreklik)',
  'Prelim GDP q/q': 'GSYH ikinci tahmin (çeyreklik)',
  'Final GDP q/q': 'GSYH nihai (çeyreklik)',
  'JOLTS Job Openings': 'JOLTS açık iş sayısı',
  'ADP Non-Farm Employment Change': 'ADP özel sektör istihdamı',
  'Philly Fed Manufacturing Index': 'Philly Fed imalat endeksi',
  'Empire State Manufacturing Index': 'New York Fed imalat endeksi',
  'CB Consumer Confidence': 'Tüketici güveni (Conference Board)',
  'Prelim UoM Consumer Sentiment': 'Michigan tüketici güveni (öncü)',
  'Main Refinancing Rate': 'ECB faiz kararı',
  'ECB Press Conference': 'ECB basın toplantısı',
  'Monetary Policy Statement': 'ECB para politikası açıklaması',
  'Treasury Sec Bessent Speaks': 'ABD Hazine Bakanı konuşması',
  'Fed Chair Powell Speaks': 'Fed Başkanı konuşması',
  'ECB President Lagarde Speaks': 'ECB Başkanı konuşması',
}
const baslikTr = (b: string) => BASLIK_TR[b] ?? b
const ONEM_RENGI: Record<string, string> = { yuksek: 'var(--kritik)', orta: 'var(--ciddi)', dusuk: 'var(--axis)' }
const GUN_ADI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const gunAdi = (iso: string) => GUN_ADI[new Date(`${iso}T12:00:00Z`).getUTCDay()]

export default function TakvimListesi({
  satirlar, bugun, kompakt = false, baglanti = true,
}: {
  satirlar: TakvimSatiri[]
  bugun: string
  kompakt?: boolean
  baglanti?: boolean
}) {
  const gruplar = new Map<string, TakvimSatiri[]>()
  for (const s of satirlar) gruplar.set(s.tarih, [...(gruplar.get(s.tarih) ?? []), s])
  const gunler = [...gruplar.entries()].sort(([a], [b]) => a.localeCompare(b))

  if (gunler.length === 0) {
    return <p className="py-4 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>Bu aralıkta kayıtlı tarih yok.</p>
  }

  return (
    <div>
      <ul>
        {gunler.map(([tarih, olaylar]) => (
          <li key={tarih} className="py-1.5" style={{ borderTop: '1px solid var(--hair)' }}>
            <div className="flex items-baseline gap-2 text-[12px]">
              <span className="rakam font-medium" style={{ color: tarih === bugun ? 'var(--seri-1)' : 'var(--ink)' }}>
                {tarihKisa(tarih).replace(/ \d{4}$/, '')}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{gunAdi(tarih)}{tarih === bugun ? ' · bugün' : ''}</span>
            </div>
            <ul className="mt-0.5">
              {olaylar
                .sort((a, b) => (a.saat ?? '99').localeCompare(b.saat ?? '99') || a.baslik.localeCompare(b.baslik))
                .map((o) => (
                  <li key={o.anahtar} className={`flex flex-wrap items-baseline gap-x-2 ${kompakt ? 'py-0.5 text-[12px]' : 'py-1 text-[13px]'}`}>
                    <span aria-hidden className="inline-block h-2 w-2 shrink-0 self-center rounded-full" style={{ background: ONEM_RENGI[o.onem] }} title={`önem: ${o.onem}`} />
                    <span className="rakam w-11 shrink-0 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{o.saat ? o.saat.slice(0, 5) : '—'}</span>
                    <span className="w-8 shrink-0 text-[11px] font-medium" style={{ color: 'var(--ink-2)' }}>{ULKE[o.ulke]}</span>
                    <span className="min-w-0 flex-1 truncate" title={o.baslik}>{baslikTr(o.baslik)}</span>
                    {o.kural && <span className="text-[11px]" style={{ color: 'var(--ciddi)' }}>tahmini</span>}
                    {!kompakt && (o.tahmin || o.onceki) && (
                      <span className="rakam text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {o.tahmin ? `beklenti ${o.tahmin}` : ''}{o.tahmin && o.onceki ? ' · ' : ''}{o.onceki ? `önceki ${o.onceki}` : ''}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      {baglanti && (
        <Link href="/takvim" className="mt-2 inline-block text-[12px] font-medium" style={{ color: 'var(--seri-1)' }}>Tüm takvim →</Link>
      )}
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        Saatler Türkiye saati. Kaynak: TCMB PPK takvimi, Fed FOMC takvimi, haftalık ekonomik takvim (ABD/EUR). &quot;tahmini&quot; olanlar kural bazlı, resmi tarih gelince yenilenir.
      </p>
    </div>
  )
}
