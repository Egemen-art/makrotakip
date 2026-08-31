'use client'

import { useMemo, useState, useTransition } from 'react'
import type { Taksonomi } from '@/lib/tipler'
import { trSirala } from '@/lib/bicim'
import { taksonomiEkle, taksonomiSil } from './eylemler'

const kutu: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)',
}

export default function TaksonomiYonetimi({ taksonomi }: { taksonomi: Taksonomi[] }) {
  const [hata, setHata] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [bekliyor, basla] = useTransition()

  // Turkce siralama — collate tr; I/İ/ı/i karismasin.
  const gruplar = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    const harita = new Map<string, Taksonomi[]>()
    for (const t of taksonomi) {
      if (q && !`${t.kategori} ${t.alt_kategori}`.toLocaleLowerCase('tr').includes(q)) continue
      const liste = harita.get(t.kategori) ?? []
      liste.push(t)
      harita.set(t.kategori, liste)
    }
    return [...harita.entries()]
      .sort((a, b) => trSirala(a[0], b[0]))
      .map(([kategori, alt]) => ({
        kategori,
        alt: alt.sort((a, b) => trSirala(a.alt_kategori, b.alt_kategori)),
      }))
  }, [taksonomi, arama])

  const kategoriler = [...new Set(taksonomi.map((t) => t.kategori))].sort(trSirala)

  return (
    <>
      <div className="kart mt-3 p-3">
        <form
          action={(form) => {
            setHata(null)
            basla(async () => {
              const s = await taksonomiEkle(form)
              if (!s.tamam) setHata(s.hata)
            })
          }}
          className="grid gap-2 sm:grid-cols-4"
        >
          <input
            name="kategori" list="kategori-listesi" required placeholder="Kategori"
            aria-label="Kategori" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}
          />
          <datalist id="kategori-listesi">
            {kategoriler.map((k) => <option key={k} value={k} />)}
          </datalist>
          <input
            name="alt_kategori" placeholder="Alt kategori (boşsa —)"
            aria-label="Alt kategori" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}
          />
          <select name="yon" aria-label="Yön" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}>
            <option value="Gider">Gider</option>
            <option value="Gelir">Gelir</option>
          </select>
          <button
            type="submit" disabled={bekliyor}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--seri-1)' }}
          >
            {bekliyor ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </form>
        {hata && (
          <p role="alert" className="mt-2 text-[12px]" style={{ color: 'var(--kritik)' }}>{hata}</p>
        )}
      </div>

      <input
        value={arama} onChange={(e) => setArama(e.target.value)}
        placeholder="Taksonomide ara…" aria-label="Ara"
        className="mt-3 w-full rounded-lg px-3 py-1.5 text-[13px]" style={kutu}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {gruplar.map((g) => (
          <div key={g.kategori} className="kart p-3">
            <div className="mb-1.5 text-[13px] font-medium">{g.kategori}</div>
            <ul className="space-y-0.5">
              {g.alt.map((t) => (
                <li key={t.id} className="group flex items-baseline justify-between gap-2">
                  <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                    {t.alt_kategori}
                    {(t.gecmis_kayit ?? 0) > 0 && (
                      <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {t.gecmis_kayit}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => {
                      if (!confirm(`${t.kategori} › ${t.alt_kategori} silinsin mi?`)) return
                      basla(async () => {
                        const s = await taksonomiSil(t.id)
                        if (!s.tamam) setHata(s.hata)
                      })
                    }}
                    disabled={bekliyor}
                    className="text-[11px] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:opacity-40"
                    style={{ color: 'var(--kritik)' }}
                    aria-label={`${t.kategori} ${t.alt_kategori} sil`}
                  >
                    sil
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}
