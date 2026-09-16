'use client'

import { useEffect, useState } from 'react'
import type { VarlikDeger, VarlikGetiri } from '@/lib/tipler-varlik'
import type { KurGecmisi } from '@/app/api/kur/gecmis/route'
import type { EnflasyonKutulari } from './KurSeridi'
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
  degerler, getiriler, usdtry, kurTarihi, enflasyon = null,
}: {
  degerler: VarlikDeger[]
  getiriler: VarlikGetiri[]
  usdtry: number | null
  kurTarihi: string | null
  enflasyon?: EnflasyonKutulari | null
}) {
  const [para, setPara] = useState<'TRY' | 'USD'>('TRY')
  const [donem, setDonem] = useState<SeritDonemi>('gun')
  // Gunluk kapanis serileri (ons, gram, USD/TRY, EUR/USD): kur seridinin yuzdeleri
  // ve gram altin kaleminin degisimi buradan. Sayfa acildiktan sonra cekilir.
  const [gecmis, setGecmis] = useState<KurGecmisi | null>(null)
  useEffect(() => {
    let iptal = false
    fetch('/api/kur/gecmis')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((g: KurGecmisi) => { if (!iptal) setGecmis(g) })
      .catch(() => { /* yuzdeler "—" kalir */ })
    return () => { iptal = true }
  }, [])

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
      <KurSeridi donem={donem} gecmis={gecmis} enflasyon={enflasyon} />
      <VarlikSeridi degerler={degerler} getiriler={getiriler} para={para} donem={donem} usdtry={usdtry} kurTarihi={kurTarihi} gramSerisi={gecmis?.gram ?? null} />
    </>
  )
}
