'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { VarlikSinif } from '@/lib/tipler-varlik'
import { GRUP_ETIKETI, SINIF_GRUBU } from '@/lib/tipler-varlik'

/**
 * PORTFOY SAYFASI SECIMI — pasta grafiginde bir grup ya da kalem secilince
 * sayfadaki butun kartlar (dagilim/performans, buyukluk, kazanc) ayni secime
 * uyar. Secim tek yerde durur; kartlar sadece okur.
 */

export type Secim = { grup: string | null; varlikId: number | null }

type Baglam = Secim & {
  grupSec: (ad: string | null) => void
  varlikSec: (id: number | null) => void
}

const SecimBaglami = createContext<Baglam | null>(null)

export function SecimSaglayici({ children }: { children: ReactNode }) {
  const [grup, setGrup] = useState<string | null>(null)
  const [varlikId, setVarlikId] = useState<number | null>(null)
  const deger = useMemo<Baglam>(() => ({
    grup, varlikId,
    // Grup secimi kalem secimini sifirlar; ayni gruba ikinci tik secimi kaldirir.
    grupSec: (ad) => { setGrup((g) => (ad === null || g === ad ? null : ad)); setVarlikId(null) },
    varlikSec: (id) => setVarlikId((v) => (id === null || v === id ? null : id)),
  }), [grup, varlikId])
  return <SecimBaglami.Provider value={deger}>{children}</SecimBaglami.Provider>
}

/** Saglayici yoksa (onizleme, test) secimsiz calisir. */
export function useSecim(): Baglam {
  const b = useContext(SecimBaglami)
  return b ?? { grup: null, varlikId: null, grupSec: () => {}, varlikSec: () => {} }
}

/** Secime giren kalem mi? Secim yoksa hepsi girer. */
export function secimdeMi(s: Secim, k: { varlik_id: number; sinif: VarlikSinif }) {
  if (s.varlikId !== null) return k.varlik_id === s.varlikId
  if (s.grup !== null) return (SINIF_GRUBU[k.sinif] ?? 'diger') === s.grup
  return true
}

/** Basliga eklenecek ad: "· ASELS" ya da "· Hisse". */
export function secimAdi(s: Secim, kod: string | null) {
  if (s.varlikId !== null) return kod
  if (s.grup !== null) return GRUP_ETIKETI[s.grup] ?? s.grup
  return null
}
