'use client'

import Link from 'next/link'
import type { VarlikDeger, VarlikGetiri } from '@/lib/tipler-varlik'
import { SINIF_ETIKETI, SINIF_KAYNAGI } from '@/lib/tipler-varlik'
import { tarihKisa, tl, usd, yuzde } from '@/lib/bicim'
import { SERIT_DONEMLERI, seriDegisimi, yuzdeMetni, yuzdeRengi, type SeritDonemi } from '@/lib/serit'

/**
 * Panonun ustunde, kur seridinin altinda: elimdeki her kalemin ANLIK degeri.
 * Kaynak v_varlik_deger (adet x son olculen fiyat) — ayri bir olcum degil,
 * son olcum neyse o. Fiyati okunamayan kalem "fiyat yok" der; toplam o kalemi
 * icermez ve bu soylenir. Degisim yuzdesi v_varlik_getiri'den (fiyat bazli),
 * secili doneme gore; o kadar gecmis fiyat yoksa "—". Gram altin icin fiyat
 * tablosu yeni; onun degisimi ons x kur gunluk serisinden (/api/kur/gecmis)
 * hesaplanir — iki ucu da ayni seriden, kaynak karisimi yok.
 * Dolar gorunumu gunun kuruyla (kur_gunluk) cevrilir; kur yoksa ₺'de kalir.
 */

const FIYAT: Record<string, Intl.NumberFormat> = {
  TRY: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
  EUR: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }),
}
const fiyatMetni = (f: string | null, para: string | null) =>
  f === null ? 'fiyat yok' : (FIYAT[para ?? 'TRY'] ?? FIYAT.TRY).format(Number(f))
const adetMetni = (m: string) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(Number(m))

const DONEM_SUTUNU: Record<SeritDonemi, keyof VarlikGetiri> = {
  gun: 'gun_yuzde', hafta: 'hafta_yuzde', ay: 'ay_yuzde', '3ay': 'uc_ay_yuzde', '6ay': 'alti_ay_yuzde',
}

export default function VarlikSeridi({
  degerler, getiriler, para = 'TRY', donem = 'gun', usdtry = null, kurTarihi = null, gramSerisi = null,
}: {
  degerler: VarlikDeger[]
  getiriler: VarlikGetiri[]
  para?: 'TRY' | 'USD'
  donem?: SeritDonemi
  usdtry?: number | null
  kurTarihi?: string | null
  /** Gram altinin gunluk serisi (ons x USD/TRY / 31,1035); gram kaleminin degisimi bundan. */
  gramSerisi?: { tarih: string; deger: number }[] | null
}) {
  const kalemler = degerler
    .filter((d) => Number(d.miktar) !== 0)
    .sort((a, b) => Number(b.deger_tl ?? 0) - Number(a.deger_tl ?? 0))
  if (kalemler.length === 0) return null
  const dolar = para === 'USD' && usdtry !== null && usdtry > 0
  const cevir = (n: number) => (dolar ? n / usdtry! : n)
  const bicim = dolar ? usd : tl
  // Birim fiyatin secili para birimindeki karsiligi (fiyat zaten o birimdeyse yok).
  const cevrilmis = (f: number, fiyatPara: string | null): string | null => {
    if (usdtry === null || usdtry <= 0) return null
    if (dolar && fiyatPara === 'TRY') return FIYAT.USD.format(f / usdtry)
    if (!dolar && fiyatPara === 'USD') return FIYAT.TRY.format(f * usdtry)
    return null
  }
  const getiri = new Map(getiriler.map((g) => [g.varlik_id, g]))
  const sutun = DONEM_SUTUNU[donem]
  const donemAdi = SERIT_DONEMLERI.find((d) => d.kod === donem)?.ad ?? ''
  const toplamTl = kalemler.reduce((t, k) => t + Number(k.deger_tl ?? 0), 0)
  const fiyatsiz = kalemler.filter((k) => k.deger_tl === null).length
  const enYeni = kalemler.reduce<string | null>((t, k) => (k.fiyat_tarihi && (!t || k.fiyat_tarihi > t) ? k.fiyat_tarihi : t), null)

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          Varlıklarım · anlık değer{' '}
          <span className="rakam font-medium" style={{ color: 'var(--ink)' }}>{bicim(cevir(toplamTl))}</span>
          {enYeni && <span className="ml-1.5 text-[11px]">fiyatlar {tarihKisa(enYeni)}</span>}
          {dolar && <span className="ml-1.5 text-[11px]">USD/TRY {usdtry!.toFixed(4)}{kurTarihi ? ` (${tarihKisa(kurTarihi)})` : ''}</span>}
          {para === 'USD' && !dolar && <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ciddi)' }}>kur yok, ₺ gösteriliyor</span>}
          <span className="ml-1.5 text-[11px]">değişim: {donemAdi.toLocaleLowerCase('tr')}</span>
          {fiyatsiz > 0 && <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ciddi)' }}>{fiyatsiz} kalem fiyatsız, toplamda yok</span>}
        </span>
        <Link href="/portfoy" className="text-[11px] font-medium" style={{ color: 'var(--seri-1)' }}>Portföy →</Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {kalemler.map((k) => {
          const g = getiri.get(k.varlik_id)
          const gram = SINIF_KAYNAGI[k.sinif] === 'gram_altin'
          const ham = k.sinif === 'nakit' ? null : (g?.[sutun] as string | null | undefined) ?? null
          // Gram altin: fiyat tablosu kisa; ons x kur serisi tercih edilir, yoksa tablo.
          const gramDegisim = gram && gramSerisi ? seriDegisimi(gramSerisi, donem) : null
          const n = gramDegisim !== null ? gramDegisim : ham === null ? null : Number(ham)
          return (
            <div key={k.varlik_id} className="kart px-3 py-2">
              <div className="flex items-baseline justify-between gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                <span className="truncate">
                  <span className="font-medium" style={{ color: 'var(--ink)' }}>{k.kod}</span>
                  {SINIF_ETIKETI[k.sinif] !== k.kod && ` · ${SINIF_ETIKETI[k.sinif]}`}
                </span>
                {k.sinif !== 'nakit' && (
                  <span className="rakam shrink-0" title={n === null ? `${donemAdi} için yeterli fiyat geçmişi yok` : gramDegisim !== null ? `${donemAdi} değişimi (ons × kur serisi)` : `${donemAdi} fiyat değişimi`} style={{ color: n === null ? 'var(--ink-muted)' : yuzdeRengi(n) }}>
                    {n === null ? '—' : yuzdeMetni(n)}
                  </span>
                )}
              </div>
              <div className="rakam mt-0.5 text-[15px] font-semibold leading-tight" style={{ color: k.deger_tl === null ? 'var(--ciddi)' : undefined }}>
                {k.deger_tl === null ? 'fiyat yok' : bicim(cevir(Number(k.deger_tl)))}
              </div>
              {/* Tekil (birim) fiyat: kendi para biriminde, yaninda secili birime cevrilmis hali. */}
              {k.sinif !== 'nakit' && (
                <div className="rakam mt-0.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
                  {fiyatMetni(k.birim_fiyat, k.fiyat_para)}
                  {k.birim_fiyat !== null && cevrilmis(Number(k.birim_fiyat), k.fiyat_para) && (
                    <span style={{ color: 'var(--ink-muted)' }}> ≈ {cevrilmis(Number(k.birim_fiyat), k.fiyat_para)}</span>
                  )}
                  {k.fiyat_olculdu === false && <span style={{ color: 'var(--ink-muted)' }}> · elle</span>}
                </div>
              )}
              <div className="rakam mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {k.sinif === 'nakit'
                  ? 'YK + elde'
                  : `${adetMetni(k.miktar)} adet · pay ${toplamTl > 0 && k.deger_tl !== null ? yuzde(Number(k.deger_tl) / toplamTl) : '—'}`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
