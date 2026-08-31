'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { trSirala } from '@/lib/bicim'

export default function Filtreler({
  kategoriler, hesaplar, tipler, durumlar, arsivMi,
}: {
  kategoriler: string[]
  hesaplar: string[]
  tipler: string[]
  durumlar: string[]
  arsivMi: boolean
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')

  function guncelle(anahtar: string, deger: string) {
    const p = new URLSearchParams(params.toString())
    if (deger) p.set(anahtar, deger)
    else p.delete(anahtar)
    p.delete('sayfa')
    router.push(`/islemler?${p.toString()}`)
  }

  const kutu = {
    background: 'var(--surface)',
    border: '1px solid var(--hair)',
    color: 'var(--ink)',
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => { e.preventDefault(); guncelle('q', q) }}
          className="flex min-w-[220px] flex-1 gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={arsivMi ? 'Kategori ya da notta ara…' : 'Açıklama, kategori, notta ara…'}
            aria-label="Ara"
            className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-[13px]"
            style={kutu}
          />
          <button type="submit" className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white" style={{ background: 'var(--seri-1)' }}>
            Ara
          </button>
        </form>

        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ border: '1px solid var(--hair)' }} role="group" aria-label="Bölüm">
          {[{ d: '', a: 'Canlı defter' }, { d: 'arsiv', a: 'Arşiv' }].map((s) => {
            const acik = (params.get('bolum') ?? '') === s.d
            return (
              <button
                key={s.d || 'canli'}
                onClick={() => guncelle('bolum', s.d)}
                aria-pressed={acik}
                className="rounded-md px-2.5 py-1 text-[12px] font-medium"
                style={{ background: acik ? 'var(--seri-1)' : 'transparent', color: acik ? '#fff' : 'var(--ink-2)' }}
              >
                {s.a}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[12px]">
        <Secim ad="kategori" etiket="Kategori" secenekler={[...kategoriler].sort(trSirala)} params={params} guncelle={guncelle} stil={kutu} />
        {!arsivMi && (
          <Secim ad="hesap" etiket="Hesap" secenekler={hesaplar} params={params} guncelle={guncelle} stil={kutu} />
        )}
        <Secim ad="tip" etiket="Tip" secenekler={tipler} params={params} guncelle={guncelle} stil={kutu} />
        {!arsivMi && (
          <Secim ad="durum" etiket="Durum" secenekler={durumlar} params={params} guncelle={guncelle} stil={kutu} />
        )}
        <label className="flex items-center gap-1">
          <span style={{ color: 'var(--ink-muted)' }}>Başlangıç</span>
          <input
            type="date" value={params.get('baslangic') ?? ''}
            onChange={(e) => guncelle('baslangic', e.target.value)}
            className="rounded-lg px-2 py-1" style={kutu}
          />
        </label>
        <label className="flex items-center gap-1">
          <span style={{ color: 'var(--ink-muted)' }}>Bitiş</span>
          <input
            type="date" value={params.get('bitis') ?? ''}
            onChange={(e) => guncelle('bitis', e.target.value)}
            className="rounded-lg px-2 py-1" style={kutu}
          />
        </label>
        {[...params.keys()].some((k) => k !== 'bolum') && (
          <button
            onClick={() => {
              const p = new URLSearchParams()
              const bolum = params.get('bolum')
              if (bolum) p.set('bolum', bolum)
              setQ('')
              router.push(`/islemler?${p.toString()}`)
            }}
            className="rounded-lg px-2 py-1"
            style={{ color: 'var(--ink-muted)', border: '1px solid var(--hair)' }}
          >
            Filtreleri temizle
          </button>
        )}
      </div>
    </div>
  )
}

function Secim({
  ad, etiket, secenekler, params, guncelle, stil,
}: {
  ad: string
  etiket: string
  secenekler: string[]
  params: URLSearchParams
  guncelle: (a: string, d: string) => void
  stil: React.CSSProperties
}) {
  return (
    <select
      value={params.get(ad) ?? ''}
      onChange={(e) => guncelle(ad, e.target.value)}
      aria-label={etiket}
      className="rounded-lg px-2 py-1"
      style={stil}
    >
      <option value="">{etiket}: tümü</option>
      {secenekler.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}
