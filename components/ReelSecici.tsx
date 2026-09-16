'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { adresYaz } from '@/lib/donem'
import type { EnflasyonSerisi } from '@/lib/enflasyon'
import { SecimGrubu } from './grafik/ortak'

/**
 * Nominal | Reel anahtari (karar 53). Reel'de ₺ gorunumu TUFE ile, $ gorunumu
 * secilen ABD serisiyle (CPI | PCE) deflate edilir. Secim URL'de: ?reel=1&abd=pce.
 */
export default function ReelSecici({
  reel, abd, para, yol,
}: {
  reel: boolean
  abd: Exclude<EnflasyonSerisi, 'tufe'>
  para: 'TRY' | 'USD'
  yol: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, baslat] = useTransition()
  const git = (d: Record<string, string | null>) => baslat(() => router.push(adresYaz(yol, sp, d)))
  return (
    <div className="flex items-center gap-2">
      <SecimGrubu<'nominal' | 'reel'>
        secenekler={[{ deger: 'nominal', ad: 'Nominal' }, { deger: 'reel', ad: 'Reel' }]}
        deger={reel ? 'reel' : 'nominal'}
        degistir={(v) => git({ reel: v === 'reel' ? '1' : null })}
        etiket="Nominal / reel"
      />
      {reel && para === 'USD' && (
        <SecimGrubu<'cpi' | 'pce'>
          secenekler={[{ deger: 'cpi', ad: 'CPI' }, { deger: 'pce', ad: 'PCE' }]}
          deger={abd}
          degistir={(v) => git({ abd: v === 'cpi' ? null : 'pce' })}
          etiket="ABD enflasyon serisi"
        />
      )}
    </div>
  )
}
