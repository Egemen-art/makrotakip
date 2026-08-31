'use client'

import { donemEtiket, tlKurus } from '@/lib/bicim'

/** Eksen icin sikistirilmis TL: 25 B, 1,2 Mn */
const KISA = new Intl.NumberFormat('tr-TR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
export const eksenTL = (n: number) => (n === 0 ? '0' : `₺${KISA.format(n)}`)

/** Eksen degerlerini yuvarlak sayilara oturtan ust sinir. */
export function ustSinir(enBuyuk: number) {
  if (enBuyuk <= 0) return 100
  const buyukluk = Math.pow(10, Math.floor(Math.log10(enBuyuk)))
  const adim = [1, 2, 2.5, 5, 10].find((a) => a * buyukluk >= enBuyuk)! * buyukluk
  return adim
}

export const SERI_RENKLERI = [
  'var(--seri-1)', 'var(--seri-2)', 'var(--seri-3)', 'var(--seri-4)',
  'var(--seri-5)', 'var(--seri-6)', 'var(--seri-7)', 'var(--seri-8)',
]

type IpucuGirdi = { name?: string; value?: number; color?: string; dataKey?: string }

/** Ortak hover ipucu. Metin daima metin renginde; kimligi yanindaki renk noktasi tasir. */
export function Ipucu({
  active, payload, label, donemMi = true,
}: {
  active?: boolean
  payload?: IpucuGirdi[]
  label?: string
  donemMi?: boolean
}) {
  if (!active || !payload?.length) return null
  const gorunen = payload.filter((p) => p.value !== undefined && p.value !== null)
  if (!gorunen.length) return null

  return (
    <div
      className="kart px-3 py-2 text-[12px] shadow-lg"
      style={{ background: 'var(--surface)', color: 'var(--ink)' }}
    >
      <div className="mb-1 font-medium">
        {donemMi && label ? donemEtiket(String(label)) : label}
      </div>
      {gorunen.map((p, i) => (
        <div key={i} className="flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: p.color }}
          />
          <span style={{ color: 'var(--ink-2)' }}>{p.name}</span>
          <span className="rakam ml-auto font-medium">{tlKurus(p.value!)}</span>
        </div>
      ))}
    </div>
  )
}

export const EKSEN_STILI = {
  fontSize: 11,
  fill: 'var(--ink-muted)',
}
