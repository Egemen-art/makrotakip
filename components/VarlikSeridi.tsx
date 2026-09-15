import Link from 'next/link'
import type { VarlikDeger, VarlikGetiri } from '@/lib/tipler-varlik'
import { SINIF_ETIKETI } from '@/lib/tipler-varlik'
import { tarihKisa, tl, yuzde } from '@/lib/bicim'

/**
 * Panonun ustunde, kur seridinin altinda: elimdeki her kalemin ANLIK degeri.
 * Kaynak v_varlik_deger (adet x son olculen fiyat) — ayri bir olcum degil,
 * son olcum neyse o. Fiyati okunamayan kalem "fiyat yok" der; toplam o kalemi
 * icermez ve bu soylenir. Gunluk yuzde v_varlik_getiri'den (fiyat bazli).
 */

const FIYAT: Record<string, Intl.NumberFormat> = {
  TRY: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
  EUR: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }),
}
const fiyatMetni = (f: string | null, para: string | null) =>
  f === null ? 'fiyat yok' : (FIYAT[para ?? 'TRY'] ?? FIYAT.TRY).format(Number(f))
const yuzdeMetni = (v: string | null) => {
  if (v === null) return null
  const n = Number(v)
  return `${n > 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} %`
}

export default function VarlikSeridi({ degerler, getiriler }: { degerler: VarlikDeger[]; getiriler: VarlikGetiri[] }) {
  const kalemler = degerler
    .filter((d) => Number(d.miktar) !== 0)
    .sort((a, b) => Number(b.deger_tl ?? 0) - Number(a.deger_tl ?? 0))
  if (kalemler.length === 0) return null
  const getiri = new Map(getiriler.map((g) => [g.varlik_id, g]))
  const toplam = kalemler.reduce((t, k) => t + Number(k.deger_tl ?? 0), 0)
  const fiyatsiz = kalemler.filter((k) => k.deger_tl === null).length
  const enYeni = kalemler.reduce<string | null>((t, k) => (k.fiyat_tarihi && (!t || k.fiyat_tarihi > t) ? k.fiyat_tarihi : t), null)

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          Varlıklarım · anlık değer{' '}
          <span className="rakam font-medium" style={{ color: 'var(--ink)' }}>{tl(toplam)}</span>
          {enYeni && <span className="ml-1.5 text-[11px]">fiyatlar {tarihKisa(enYeni)}</span>}
          {fiyatsiz > 0 && <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ciddi)' }}>{fiyatsiz} kalem fiyatsız, toplamda yok</span>}
        </span>
        <Link href="/portfoy" className="text-[11px] font-medium" style={{ color: 'var(--seri-1)' }}>Portföy →</Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {kalemler.map((k) => {
          const g = getiri.get(k.varlik_id)
          const gun = k.sinif === 'nakit' ? null : yuzdeMetni(g?.gun_yuzde ?? null)
          const n = g?.gun_yuzde === null || g?.gun_yuzde === undefined ? 0 : Number(g.gun_yuzde)
          return (
            <div key={k.varlik_id} className="kart px-3 py-2">
              <div className="flex items-baseline justify-between gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                <span className="truncate">
                  <span className="font-medium" style={{ color: 'var(--ink)' }}>{k.kod}</span>
                  {SINIF_ETIKETI[k.sinif] !== k.kod && ` · ${SINIF_ETIKETI[k.sinif]}`}
                </span>
                {gun && (
                  <span className="rakam shrink-0" style={{ color: n > 0 ? 'var(--artis-iyi)' : n < 0 ? 'var(--kritik)' : 'var(--ink-muted)' }}>{gun}</span>
                )}
              </div>
              <div className="rakam mt-0.5 text-[15px] font-semibold leading-tight" style={{ color: k.deger_tl === null ? 'var(--ciddi)' : undefined }}>
                {k.deger_tl === null ? 'fiyat yok' : tl(k.deger_tl)}
              </div>
              <div className="rakam mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {k.sinif === 'nakit'
                  ? 'YK + elde'
                  : `${fiyatMetni(k.birim_fiyat, k.fiyat_para)}${k.fiyat_olculdu === false ? ' · elle' : ''} · ${toplam > 0 && k.deger_tl !== null ? yuzde(Number(k.deger_tl) / toplam) : '—'}`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
