'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { DONEMLER, donemAdresi, gunEkle, type Donem, type DonemKodu } from '@/lib/donem'
import { tarihKisa } from '@/lib/bicim'
import { SecimGrubu } from './grafik/ortak'

/**
 * Donem secici: Gun / Hafta / Ay / 3 Ay / 6 Ay / 1 Yil / Baslangictan / Ozel.
 * Secim URL'e yazilir; gun gorunumunde gun, ozelde aralik ayrica secilir.
 */
export default function DonemSecici({
  donem, para, bugun, yol = '/portfoy',
}: {
  donem: Donem
  para: 'TRY' | 'USD'
  bugun: string
  yol?: string
}) {
  const router = useRouter()
  const [, baslat] = useTransition()
  const [bas, setBas] = useState(donem.bas ?? gunEkle(bugun, -30))
  const [bit, setBit] = useState(donem.bit)
  const git = (d: Partial<Donem> & { kod: DonemKodu }) => baslat(() => router.push(donemAdresi(yol, d, para)))

  const girdi = 'rounded-md border px-2 py-1 text-[12px]'
  const girdiStil = { borderColor: 'var(--hair)', background: 'var(--surface)', color: 'var(--ink)' }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <SecimGrubu<DonemKodu>
        secenekler={DONEMLER.map((d) => ({ deger: d.kod, ad: d.ad }))}
        deger={donem.kod}
        degistir={(kod) => git({ kod, gun: donem.gun, bas, bit })}
        etiket="Dönem"
      />

      {donem.kod === 'gun' && (
        <div className="flex items-center gap-1 text-[12px]">
          <button type="button" aria-label="Önceki gün" className="rounded-md px-2 py-1 hover:bg-[var(--plane)]"
            onClick={() => git({ kod: 'gun', gun: gunEkle(donem.gun, -1) })}>‹</button>
          <input
            type="date" value={donem.gun} max={bugun} aria-label="Gün"
            className={girdi} style={girdiStil}
            onChange={(e) => e.target.value && git({ kod: 'gun', gun: e.target.value })}
          />
          <button type="button" aria-label="Sonraki gün" className="rounded-md px-2 py-1 hover:bg-[var(--plane)] disabled:opacity-40"
            disabled={donem.gun >= bugun}
            onClick={() => git({ kod: 'gun', gun: gunEkle(donem.gun, 1) })}>›</button>
          <span style={{ color: 'var(--ink-muted)' }}>{tarihKisa(donem.gun)}</span>
        </div>
      )}

      {donem.kod === 'ozel' && (
        <form
          className="flex items-center gap-1 text-[12px]"
          onSubmit={(e) => { e.preventDefault(); git({ kod: 'ozel', bas, bit }) }}
        >
          <input type="date" value={bas} max={bit} aria-label="Başlangıç" className={girdi} style={girdiStil} onChange={(e) => setBas(e.target.value)} />
          <span style={{ color: 'var(--ink-muted)' }}>–</span>
          <input type="date" value={bit} min={bas} max={bugun} aria-label="Bitiş" className={girdi} style={girdiStil} onChange={(e) => setBit(e.target.value)} />
          <button type="submit" className="rounded-md px-2.5 py-1 font-medium" style={{ background: 'var(--seri-1)', color: '#fff' }}>
            Uygula
          </button>
        </form>
      )}
    </div>
  )
}
