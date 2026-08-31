'use client'

import { useState, useTransition } from 'react'
import type { PortfoyGetiri } from '@/lib/tipler'
import { bugun, tarihKisa, tl, tlKurus, yuzde } from '@/lib/bicim'
import { portfoyKaydet, portfoySil } from './eylemler'

const kutu: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)',
}

const ALANLAR = [
  ['ppf', 'PPF'], ['vadeli_mevduat', 'Vadeli mevduat'],
  ['hisse_abd', 'Hisse (ABD)'], ['hisse_bist', 'Hisse (BİST)'],
  ['altin_fiziksel', 'Altın (fiziksel)'], ['altin_etf', 'Altın (ETF)'],
  ['nakit', 'Nakit'], ['bes', 'BES'],
] as const

export default function PortfoyYonetimi({ satirlar }: { satirlar: PortfoyGetiri[] }) {
  const [acik, setAcik] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, basla] = useTransition()

  const tersSirali = [...satirlar].reverse()

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Geçmiş</h2>
        <button
          onClick={() => setAcik((v) => !v)}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white"
          style={{ background: 'var(--seri-1)' }}
        >
          {acik ? 'Formu kapat' : '+ Anlık görüntü ekle'}
        </button>
      </div>

      {acik && (
        <div className="kart mb-3 p-3">
          <form
            action={(form) => {
              setHata(null)
              basla(async () => {
                const s = await portfoyKaydet(form)
                if (s.tamam) setAcik(false)
                else setHata(s.hata)
              })
            }}
            className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4"
          >
            <Alan etiket="Tarih">
              <input type="date" name="tarih" required defaultValue={bugun()} className="w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            </Alan>
            {ALANLAR.map(([ad, etiket]) => (
              <Alan key={ad} etiket={etiket}>
                <input name={ad} inputMode="decimal" defaultValue="0" className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
              </Alan>
            ))}
            <Alan etiket="Eklenen / Çekilen ₺">
              <input
                name="eklenen_cekilen" inputMode="decimal" required defaultValue="0"
                className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]"
                style={{ ...kutu, borderColor: 'var(--uyari)' }}
              />
            </Alan>
            <Alan etiket="USD/TRY">
              <input name="usdtry" inputMode="decimal" className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            </Alan>
            <Alan etiket="Altın gram ₺">
              <input name="altin_gram_tl" inputMode="decimal" className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            </Alan>
            <Alan etiket="Not">
              <input name="not_" className="w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            </Alan>

            <p className="text-[11px] sm:col-span-3 lg:col-span-4" style={{ color: 'var(--ink-muted)' }}>
              Para giriş/çıkışı olmadıysa <strong>Eklenen / Çekilen</strong> alanına 0 yaz —
              boş bırakılırsa getiri olduğundan yüksek çıkar. Aynı tarihte kayıt varsa güncellenir.
            </p>

            {hata && (
              <p role="alert" className="text-[12px] sm:col-span-3 lg:col-span-4" style={{ color: 'var(--kritik)' }}>{hata}</p>
            )}

            <div className="sm:col-span-3 lg:col-span-4">
              <button
                type="submit" disabled={bekliyor}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--seri-1)' }}
              >
                {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="kart overflow-x-auto">
        <table className="w-full min-w-[680px] text-[13px]">
          <thead>
            <tr style={{ color: 'var(--ink-muted)' }}>
              <th className="px-3 py-2 text-left font-medium">Tarih</th>
              <th className="px-3 py-2 text-right font-medium">Toplam</th>
              <th className="px-3 py-2 text-right font-medium">Eklenen / Çekilen</th>
              <th className="px-3 py-2 text-right font-medium">Net getiri</th>
              <th className="px-3 py-2 text-right font-medium">Getiri %</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tersSirali.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--hair)' }}>
                <td className="rakam px-3 py-2">{tarihKisa(s.tarih)}</td>
                <td className="rakam px-3 py-2 text-right font-medium">{tl(s.toplam_tl)}</td>
                <td className="rakam px-3 py-2 text-right" style={{ color: 'var(--ink-2)' }}>
                  {tlKurus(s.eklenen_cekilen)}
                </td>
                <td
                  className="rakam px-3 py-2 text-right"
                  style={{ color: s.net_getiri === null ? 'var(--ink-muted)' : Number(s.net_getiri) >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)' }}
                >
                  {s.net_getiri === null ? '—' : tl(s.net_getiri)}
                </td>
                <td className="rakam px-3 py-2 text-right" style={{ color: 'var(--ink-2)' }}>
                  {s.getiri_yuzde === null ? '—' : yuzde(Number(s.getiri_yuzde))}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => {
                      if (!confirm(`${tarihKisa(s.tarih)} kaydı silinsin mi?`)) return
                      basla(async () => {
                        const r = await portfoySil(s.id)
                        if (!r.tamam) setHata(r.hata)
                      })
                    }}
                    disabled={bekliyor}
                    className="text-[12px] disabled:opacity-50" style={{ color: 'var(--kritik)' }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Alan({ etiket, children }: { etiket: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{etiket}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  )
}
