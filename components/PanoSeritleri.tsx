'use client'

import { useState } from 'react'
import type { VarlikDeger, VarlikGetiri } from '@/lib/tipler-varlik'
import { SERIT_DONEMLERI, type SeritDonemi } from '@/lib/serit'
import { SecimGrubu } from './grafik/ortak'
import KurSeridi from './KurSeridi'
import VarlikSeridi from './VarlikSeridi'

/**
 * Panonun ustundeki iki serit (piyasa kurlari + varliklarim) tek secimle
 * yonetilir: ₺ | $ ve degisim donemi (Gun varsayilan, Hafta, Ay, 6 Ay).
 * Secim sayfa icinde kalir; yeniden acildiginda varsayilana doner.
 */
export default function PanoSeritleri({
  degerler, getiriler, usdtry, kurTarihi,
}: {
  degerler: VarlikDeger[]
  getiriler: VarlikGetiri[]
  usdtry: number | null
  kurTarihi: string | null
}) {
  const [para, setPara] = useState<'TRY' | 'USD'>('TRY')
  const [donem, setDonem] = useState<SeritDonemi>('gun')

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SecimGrubu<SeritDonemi>
          secenekler={SERIT_DONEMLERI.map((d) => ({ deger: d.kod, ad: d.ad }))}
          deger={donem}
          degistir={setDonem}
          etiket="Değişim dönemi"
        />
        <SecimGrubu<'TRY' | 'USD'>
          secenekler={[{ deger: 'TRY', ad: '₺' }, { deger: 'USD', ad: '$' }]}
          deger={para}
          degistir={setPara}
          etiket="Para birimi"
        />
      </div>
      <KurSeridi donem={donem} />
      <VarlikSeridi degerler={degerler} getiriler={getiriler} para={para} donem={donem} usdtry={usdtry} kurTarihi={kurTarihi} />
    </>
  )
}
