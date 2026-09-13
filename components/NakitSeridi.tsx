import type { Nakit } from '@/lib/tipler'
import { bugun, tarihKisa, tl, tlKurus } from '@/lib/bicim'

/**
 * Panonun en ustundeki anlik nakit (karar 49): YK guncel bakiyesi + eldeki nakit.
 * Secili aya BAGLI DEGILDIR — eski bir ay goruntulenirken de bugunku rakami gosterir,
 * bu yuzden ay kartlarinin gridine girmez, ayri durur.
 */
export default function NakitSeridi({ nakit }: { nakit: Nakit }) {
  const gunFarki = Math.round((Date.parse(bugun()) - Date.parse(nakit.yk_tarih)) / 86_400_000)
  const eski = gunFarki > 3

  return (
    <div className="kart mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
      <div className="flex items-baseline gap-3">
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Anlık nakit</span>
        <span
          className="rakam text-[22px] font-semibold leading-tight"
          style={{ color: Number(nakit.toplam) < 0 ? 'var(--kritik)' : 'var(--ink)' }}
        >
          {tlKurus(nakit.toplam)}
        </span>
      </div>
      <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        <span className="rakam">{tl(nakit.yk_bakiye)}</span> YK ·{' '}
        <span style={{ color: eski ? 'var(--ciddi)' : 'var(--ink-muted)' }}>
          {tarihKisa(nakit.yk_tarih)}{eski ? ` · ${gunFarki} gün eski` : ''}
        </span>
        {' + '}
        <span className="rakam">{tl(nakit.elde)}</span> elde
        {nakit.elde_adet > 0 && ` · ${nakit.elde_adet} kayıt`}
      </div>
    </div>
  )
}
