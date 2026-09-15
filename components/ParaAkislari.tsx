'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HareketKaydi, Para } from '@/lib/tipler-varlik'
import { donemEtiket, tarihKisa, tl, usd } from '@/lib/bicim'
import { EKSEN_STILI, eksenTL, eksenUSD } from './grafik/ortak'

/**
 * PARA AKISLARI: portfoye ne zaman ne kadar para koydum, karsiliginda ne aldim.
 * Kaynak varlik_hareket: Alim/Giris eklenen, Satim/Cikis cekilen. Tutari
 * yazilmamis hareket (baslangic pozisyonu) listede gorunur ama toplama girmez —
 * uydurma tutar yok. Duzeltme adet duzeltmesidir, para akisi degildir.
 */

const EKLEYEN = new Set(['Alım', 'Giriş'])
const CEKEN = new Set(['Satım', 'Çıkış'])

const adet = (n: string) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(Number(n))

export default function ParaAkislari({
  hareketler, para = 'TRY', usdtry = null,
}: {
  hareketler: HareketKaydi[]
  para?: Para
  /** Gunun kuru; hareketin kendi kuru yoksa dolar cevirisi bununla yapilir. */
  usdtry?: number | null
}) {
  const dolar = para === 'USD' && usdtry !== null && usdtry > 0
  const bicim = dolar ? usd : tl

  const satirlar = useMemo(() => {
    return hareketler
      .filter((h) => h.tur !== 'Düzeltme')
      .map((h) => {
        const tutarTl = h.tutar === null ? null : Number(h.tutar)
        const kur = h.usdtry ? Number(h.usdtry) : usdtry
        const tutar = tutarTl === null ? null : dolar ? tutarTl / (kur && kur > 0 ? kur : usdtry!) : tutarTl
        const yon = EKLEYEN.has(h.tur) ? 1 : CEKEN.has(h.tur) ? -1 : 0
        return { ...h, kod: h.varlik?.kod ?? `#${h.varlik_id}`, tutar, yon, kur }
      })
      .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.id - a.id)
  }, [hareketler, dolar, usdtry])

  const eklenen = satirlar.filter((s) => s.yon > 0 && s.tutar !== null).reduce((t, s) => t + s.tutar!, 0)
  const cekilen = satirlar.filter((s) => s.yon < 0 && s.tutar !== null).reduce((t, s) => t + s.tutar!, 0)
  const tutarsiz = satirlar.filter((s) => s.tutar === null && s.yon !== 0).length

  const aylik = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of satirlar) {
      if (s.tutar === null || s.yon === 0) continue
      const ay = s.tarih.slice(0, 7)
      m.set(ay, (m.get(ay) ?? 0) + s.yon * s.tutar)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ay, net]) => ({ ay, net }))
  }, [satirlar])

  const kisa = dolar ? eksenUSD : eksenTL

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Para akışları</h2>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Ne zaman ne kadar koydun, karşılığında ne aldın. Getiri hesabında bunlar akış sayılır, kazanç değil.
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
        <span>Eklenen <span className="rakam font-medium" style={{ color: 'var(--artis-iyi)' }}>{bicim(eklenen)}</span></span>
        <span>Çekilen <span className="rakam font-medium" style={{ color: cekilen > 0 ? 'var(--kritik)' : undefined }}>{bicim(cekilen)}</span></span>
        <span>Net <span className="rakam font-medium">{bicim(eklenen - cekilen)}</span></span>
        {tutarsiz > 0 && (
          <span style={{ color: 'var(--ink-muted)' }}>
            {tutarsiz} giriş tutarsız (başlangıç pozisyonu) — toplamda yok
          </span>
        )}
      </div>

      {aylik.length > 0 && (
        <div className="mt-3 h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aylik} margin={{ top: 18, right: 8, bottom: 0, left: 0 }} barCategoryGap="35%">
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="ay" tickFormatter={donemEtiket} tick={EKSEN_STILI} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
              <YAxis tickFormatter={kisa} tick={EKSEN_STILI} tickLine={false} axisLine={false} width={64} />
              <Tooltip
                cursor={{ fill: 'var(--plane)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)' }}>
                      <div className="font-medium">{donemEtiket(String(label))}</div>
                      <div className="rakam">net {bicim(Number(payload[0].value))}</div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="net" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {aylik.map((a) => <Cell key={a.ay} fill={a.net >= 0 ? 'var(--seri-1)' : 'var(--kritik)'} />)}
                <LabelList dataKey="net" position="top" formatter={(v: unknown) => bicim(Number(v))} style={{ fontSize: 11, fill: 'var(--ink-2)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {satirlar.length === 0 ? (
        <p className="py-6 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>Henüz hareket yok.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                <th className="py-1 font-normal">Tarih</th>
                <th className="py-1 font-normal">Varlık</th>
                <th className="py-1 font-normal">Tür</th>
                <th className="py-1 text-right font-normal">Adet</th>
                <th className="py-1 text-right font-normal">Birim fiyat</th>
                <th className="py-1 text-right font-normal">Tutar</th>
                <th className="py-1 pl-3 font-normal">Not</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--hair)' }}>
                  <td className="rakam py-1.5 whitespace-nowrap">{tarihKisa(s.tarih)}</td>
                  <td className="py-1.5 font-medium">{s.kod}</td>
                  <td className="py-1.5" style={{ color: s.yon > 0 ? 'var(--artis-iyi)' : s.yon < 0 ? 'var(--kritik)' : 'var(--ink-muted)' }}>{s.tur}</td>
                  <td className="rakam py-1.5 text-right">{adet(s.miktar)}</td>
                  <td className="rakam py-1.5 text-right" style={{ color: 'var(--ink-muted)' }}>
                    {s.birim_fiyat === null ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(Number(s.birim_fiyat))}
                  </td>
                  <td className="rakam py-1.5 text-right font-medium" style={{ color: s.tutar === null ? 'var(--ink-muted)' : undefined }}>
                    {s.tutar === null ? 'tutar yok' : `${s.yon < 0 ? '−' : ''}${bicim(s.tutar)}`}
                  </td>
                  <td className="max-w-[260px] truncate py-1.5 pl-3 text-[11px]" style={{ color: 'var(--ink-muted)' }} title={s.not_ ?? s.kaynak ?? ''}>
                    {s.not_ ?? s.kaynak ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
