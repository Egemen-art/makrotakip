'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * PANO AY ODAGI — "Aylik gider, gelir ve aktarim" grafigi ile "Kategori
 * kiyaslama" pastasi arasindaki bag. Aylik grafikte bir ayin uzerine gelince
 * (odak) pasta o ayi gosterir; aya tiklayinca (sabit) imlec grafikten
 * ayrilsa da pasta o ayda kalir, ayni aya ikinci tik birakir.
 * Ikisi de yoksa pasta panonun secili ayina (URL) doner.
 */

type Baglam = {
  odak: string | null
  sabit: string | null
  odakla: (ay: string | null) => void
  sabitle: (ay: string) => void
  birak: () => void
}

const AyOdagiBaglami = createContext<Baglam | null>(null)

export function AyOdagiSaglayici({ children }: { children: ReactNode }) {
  const [odak, setOdak] = useState<string | null>(null)
  const [sabit, setSabit] = useState<string | null>(null)
  const deger = useMemo<Baglam>(() => ({
    odak, sabit,
    odakla: (ay) => setOdak(ay),
    sabitle: (ay) => setSabit((s) => (s === ay ? null : ay)),
    birak: () => setSabit(null),
  }), [odak, sabit])
  return <AyOdagiBaglami.Provider value={deger}>{children}</AyOdagiBaglami.Provider>
}

/** Saglayici yoksa (baska sayfa, onizleme) bag kurulmaz, her sey eskisi gibi. */
export function useAyOdagi(): Baglam {
  return useContext(AyOdagiBaglami) ?? { odak: null, sabit: null, odakla: () => {}, sabitle: () => {}, birak: () => {} }
}
