'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { SecimGrubu } from './grafik/ortak'

/**
 * ₺ | $ secici. Secim URL'e yazilir (?para=USD): sayfa sunucuda o para
 * birimiyle yeniden kurulur, her sey — bugunku deger, dagilim, performans —
 * ayni birimde gelir. Adres paylasilabilir.
 */
export default function ParaSecici({ secili, yol }: { secili: 'TRY' | 'USD'; yol: string }) {
  const router = useRouter()
  const [, baslat] = useTransition()
  return (
    <SecimGrubu<'TRY' | 'USD'>
      secenekler={[{ deger: 'TRY', ad: '₺' }, { deger: 'USD', ad: '$' }]}
      deger={secili}
      degistir={(p) => baslat(() => router.push(p === 'TRY' ? yol : `${yol}?para=USD`))}
      etiket="Para birimi"
    />
  )
}
