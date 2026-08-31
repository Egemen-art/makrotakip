'use client'

import { useState, useTransition } from 'react'
import type { Kural, Taksonomi, Tip } from '@/lib/tipler'
import { TIPLER } from '@/lib/tipler'
import { tarihKisa, trSirala } from '@/lib/bicim'
import { kuralKaydet, kuralSil } from './eylemler'

const kutu: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)',
}

export default function KuralTablosu({
  kurallar, taksonomi,
}: {
  kurallar: Kural[]
  taksonomi: Taksonomi[]
}) {
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, basla] = useTransition()

  const kategoriler = [...new Set(taksonomi.map((t) => t.kategori))].sort(trSirala)

  return (
    <>
      {hata && (
        <p role="alert" className="kart mt-3 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>
          {hata}
        </p>
      )}
      <div className="kart mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr style={{ color: 'var(--ink-muted)' }}>
              <th className="px-3 py-2 text-left font-medium">Desen</th>
              <th className="px-3 py-2 text-left font-medium">Kategori</th>
              <th className="px-3 py-2 text-left font-medium">Tip</th>
              <th className="px-3 py-2 text-right font-medium">Güven</th>
              <th className="px-3 py-2 text-right font-medium">İsabet</th>
              <th className="px-3 py-2 text-left font-medium">Kaynak</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {kurallar.map((k) => (
              <tr key={k.id} style={{ borderTop: '1px solid var(--hair)' }}>
                {duzenlenen === k.id ? (
                  <td colSpan={7} className="p-3">
                    <form
                      action={(form) => {
                        setHata(null)
                        basla(async () => {
                          const s = await kuralKaydet(form)
                          if (s.tamam) setDuzenlenen(null)
                          else setHata(s.hata)
                        })
                      }}
                      className="grid gap-2 sm:grid-cols-3"
                    >
                      <input type="hidden" name="id" value={k.id} />
                      <input name="desen" defaultValue={k.desen} aria-label="Desen" className="rakam rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
                      <select name="kategori" defaultValue={k.kategori} aria-label="Kategori" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}>
                        {kategoriler.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input name="alt_kategori" defaultValue={k.alt_kategori ?? ''} aria-label="Alt kategori" placeholder="Alt kategori" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
                      <select name="tip" defaultValue={k.tip} aria-label="Tip" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}>
                        {TIPLER.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input name="guven" defaultValue={k.guven} aria-label="Güven" inputMode="decimal" className="rakam rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
                      <input name="not_" defaultValue={k.not_ ?? ''} aria-label="Not" placeholder="Not" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
                      <div className="flex gap-2 sm:col-span-3">
                        <button type="submit" disabled={bekliyor} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50" style={{ background: 'var(--seri-1)' }}>
                          Kaydet
                        </button>
                        <button type="button" onClick={() => setDuzenlenen(null)} className="rounded-lg px-3 py-1.5 text-[13px]" style={{ border: '1px solid var(--hair)', color: 'var(--ink-2)' }}>
                          Vazgeç
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="rakam px-3 py-2 font-medium">{k.desen}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>
                      {k.kategori}
                      {k.alt_kategori && k.alt_kategori !== '—' && (
                        <span style={{ color: 'var(--ink-muted)' }}> › {k.alt_kategori}</span>
                      )}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--ink-muted)' }}>{k.tip}</td>
                    <td className="rakam px-3 py-2 text-right">{Number(k.guven).toFixed(2)}</td>
                    <td className="rakam px-3 py-2 text-right">{k.isabet ?? 0}</td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                      {k.kaynak ?? '—'}
                      <div className="text-[11px]">{tarihKisa(k.guncellendi?.slice(0, 10))}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button onClick={() => setDuzenlenen(k.id)} className="text-[12px]" style={{ color: 'var(--seri-1)' }}>
                        Düzenle
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`"${k.desen}" kuralı silinsin mi?`)) return
                          basla(async () => {
                            const s = await kuralSil(k.id)
                            if (!s.tamam) setHata(s.hata)
                          })
                        }}
                        disabled={bekliyor}
                        className="ml-3 text-[12px] disabled:opacity-50" style={{ color: 'var(--kritik)' }}
                      >
                        Sil
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
