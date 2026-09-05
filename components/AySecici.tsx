'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { donemEtiket } from '@/lib/bicim'

/**
 * Pano ay secici. Secim URL'e yazilir (?ay=YYYY-MM) — sayfa sunucuda o ay icin
 * yeniden kurulur, adres paylasilabilir/geri tusuyla donulebilir.
 */
export default function AySecici({
  aylar, secili, buAy,
}: {
  /** 'YYYY-MM', yeniden eskiye. */
  aylar: string[]
  secili: string
  buAy: string
}) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()

  return (
    <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
      <span className="sr-only">Ay seç</span>
      <select
        value={secili}
        disabled={bekliyor}
        onChange={(e) => {
          const ay = e.target.value
          baslat(() => router.push(ay === buAy ? '/' : `/?ay=${ay}`))
        }}
        className="rakam rounded-lg px-2.5 py-1.5 text-[13px] font-medium disabled:opacity-60"
        style={{ border: '1px solid var(--hair)', background: 'var(--surface)', color: 'var(--ink)' }}
      >
        {aylar.map((ay) => (
          <option key={ay} value={ay}>
            {donemEtiket(ay)}{ay === buAy ? ' · bu ay' : ''}
          </option>
        ))}
      </select>
      {bekliyor && <span aria-live="polite">yükleniyor…</span>}
    </label>
  )
}
