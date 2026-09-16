'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { adresYaz } from '@/lib/donem'
import { SecimGrubu } from './grafik/ortak'

/**
 * ₺ | $ secici. Secim URL'e yazilir (?para=USD): sayfa sunucuda o para
 * birimiyle yeniden kurulur, her sey — bugunku deger, dagilim, performans —
 * ayni birimde gelir. Diger secimler (donem, reel) korunur. Adres paylasilabilir.
 */
export default function ParaSecici({ secili, yol }: { secili: 'TRY' | 'USD'; yol: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, baslat] = useTransition()
  return (
    <SecimGrubu<'TRY' | 'USD'>
      secenekler={[{ deger: 'TRY', ad: '₺' }, { deger: 'USD', ad: '$' }]}
      deger={secili}
      degistir={(p) => baslat(() => router.push(adresYaz(yol, sp, { para: p === 'TRY' ? null : 'USD' })))}
      etiket="Para birimi"
    />
  )
}
