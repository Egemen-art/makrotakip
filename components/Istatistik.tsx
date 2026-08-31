import { tl } from '@/lib/bicim'

export function Istatistik({
  etiket, deger, altMetin, vurgu, delta,
}: {
  etiket: string
  deger: string
  altMetin?: string
  vurgu?: 'iyi' | 'kritik'
  /** Onceki doneme gore oransal degisim; isareti ok + metinle birlikte verilir. */
  delta?: { oran: number; artisIyiMi: boolean } | null
}) {
  const renk =
    vurgu === 'iyi' ? 'var(--artis-iyi)' : vurgu === 'kritik' ? 'var(--kritik)' : 'var(--ink)'

  return (
    <div className="kart p-4">
      <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{etiket}</div>
      <div className="mt-1 text-[22px] font-semibold leading-tight" style={{ color: renk }}>
        {deger}
      </div>
      {delta && isFinite(delta.oran) && (
        <DeltaRozeti oran={delta.oran} artisIyiMi={delta.artisIyiMi} />
      )}
      {altMetin && (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{altMetin}</div>
      )}
    </div>
  )
}

function DeltaRozeti({ oran, artisIyiMi }: { oran: number; artisIyiMi: boolean }) {
  const artis = oran >= 0
  const iyiMi = artis === artisIyiMi
  const bicimli = new Intl.NumberFormat('tr-TR', {
    style: 'percent', maximumFractionDigits: 0,
  }).format(Math.abs(oran))

  return (
    <div
      className="mt-1 flex items-center gap-1 text-[11px]"
      style={{ color: iyiMi ? 'var(--artis-iyi)' : 'var(--kritik)' }}
    >
      <span aria-hidden>{artis ? '▲' : '▼'}</span>
      <span>{bicimli} {artis ? 'artış' : 'azalış'}</span>
    </div>
  )
}

export function ParaSatiri({ ad, deger, ikincil }: { ad: string; deger: number | string | null; ikincil?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
        {ad}
        {ikincil && (
          <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{ikincil}</span>
        )}
      </span>
      <span className="rakam text-[13px] font-medium">{tl(deger)}</span>
    </div>
  )
}
