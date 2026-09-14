'use client'

import { useMemo, useState } from 'react'
import {
  Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type { Para, PortfoyPerformans, VarlikDeger, VarlikPerformans } from '@/lib/tipler-varlik'
import { GRUP_ETIKETI, SINIF_ETIKETI, SINIF_GRUBU } from '@/lib/tipler-varlik'
import { donemEtiket, tarihKisa, tl, usd, yuzde } from '@/lib/bicim'
import { EKSEN_STILI, SERI_RENKLERI } from './grafik/ortak'

/**
 * Portfoy dagilimi (pasta) + SENIN performansin (TWR).
 * Pasta gruplara gore; dilime tiklayinca o grubun kalemleri, kaleme
 * tiklayinca o kalemin getirisi. Alttaki cizgi secili olanin kumulatif
 * getirisi: toplam portfoy, bir grup degil — grup getirisi tutulmuyor —
 * ya da tek kalem.
 */

// Renk KIMLIGE bagli: grup sirasi sabit, ekranda hangi gruplar varsa olsun.
const GRUP_SIRASI = ['hisse', 'fon', 'altin', 'bes', 'nakit', 'mevduat', 'diger']
const grupRengi = (g: string) => SERI_RENKLERI[Math.max(0, GRUP_SIRASI.indexOf(g)) % SERI_RENKLERI.length]

const yuzdeMetni = (v: string | null | undefined) => {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  return `${n > 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} %`
}

export default function PortfoyPerformansGorunumu({
  degerler, toplam, kalemler, para = 'TRY', usdtry = null,
}: {
  degerler: VarlikDeger[]
  toplam: PortfoyPerformans[]
  kalemler: VarlikPerformans[]
  para?: Para
  /** Gunun kuru: bugunku dagilim bununla cevrilir. Performans zinciri her gunun kendi kuruyla gelir. */
  usdtry?: number | null
}) {
  const [grup, setGrup] = useState<string | null>(null)
  const [varlikId, setVarlikId] = useState<number | null>(null)
  const dolar = para === 'USD' && usdtry !== null && usdtry > 0
  const cevir = (n: number) => (dolar ? n / usdtry! : n)
  const bicim = dolar ? usd : tl

  const gruplar = useMemo(() => {
    const t = new Map<string, { deger: number; uyeler: VarlikDeger[] }>()
    for (const d of degerler) {
      if (Number(d.miktar) === 0 || d.deger_tl === null) continue
      const g = SINIF_GRUBU[d.sinif] ?? 'diger'
      const kayit = t.get(g) ?? { deger: 0, uyeler: [] }
      kayit.deger += cevir(Number(d.deger_tl))
      kayit.uyeler.push(d)
      t.set(g, kayit)
    }
    return [...t.entries()]
      .map(([ad, k]) => ({ ad, deger: k.deger, uyeler: k.uyeler.sort((a, b) => Number(b.deger_tl) - Number(a.deger_tl)) }))
      .sort((a, b) => b.deger - a.deger)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [degerler, dolar, usdtry])
  const toplamDeger = gruplar.reduce((t, g) => t + g.deger, 0)

  // Kalem bazinda son kumulatif getiri — listede yanina yazilir.
  const sonGetiri = useMemo(() => {
    const m = new Map<number, VarlikPerformans>()
    for (const k of kalemler) {
      const eski = m.get(k.varlik_id)
      if (!eski || k.tarih > eski.tarih) m.set(k.varlik_id, k)
    }
    return m
  }, [kalemler])

  function grupSec(ad: string | undefined) {
    if (!ad) return
    setGrup((g) => (g === ad ? null : ad))
    setVarlikId(null)
  }

  // Cizgi: secili kalem varsa onun zinciri, yoksa toplam.
  const seri = useMemo(() => {
    if (varlikId !== null) {
      return kalemler
        .filter((k) => k.varlik_id === varlikId)
        .sort((a, b) => a.tarih.localeCompare(b.tarih))
        .map((k) => ({
          tarih: k.tarih,
          yuzde: Number((dolar ? k.kumulatif_yuzde_usd : k.kumulatif_yuzde) ?? 0),
          deger: Number((dolar ? k.deger_usd : k.deger_tl) ?? 0),
        }))
    }
    return toplam
      .slice()
      .sort((a, b) => a.tarih.localeCompare(b.tarih))
      .map((t) => ({
        tarih: t.tarih,
        yuzde: Number((dolar ? t.kumulatif_yuzde_usd : t.kumulatif_yuzde) ?? 0),
        deger: Number((dolar ? t.deger_usd : t.deger_tl) ?? 0),
      }))
  }, [varlikId, kalemler, toplam, dolar])
  const son = seri.at(-1)
  const seciliVarlik = varlikId === null ? null : degerler.find((d) => d.varlik_id === varlikId) ?? null
  const cizgiRengi = seciliVarlik ? grupRengi(SINIF_GRUBU[seciliVarlik.sinif] ?? 'diger') : 'var(--seri-1)'
  const seciliGrup = grup ? gruplar.find((g) => g.ad === grup) ?? null : null

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Dağılım ve performans</h2>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Getiri para akışlarından arındırılmış; eklediğin para kazanç, çektiğin kayıp sayılmaz.
          {dolar && ' Dolar zinciri her günü kendi kuruyla çevirir.'}
        </span>
      </div>

      {gruplar.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>Henüz değerlenmiş kalem yok.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-start gap-6">
          <div className="relative h-[220px] w-[220px] shrink-0 [&_.recharts-surface_g:focus]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gruplar} dataKey="deger" nameKey="ad" cx="50%" cy="50%"
                  innerRadius={62} outerRadius={100} paddingAngle={1.5}
                  stroke="var(--surface)" strokeWidth={2} startAngle={90} endAngle={-270}
                  isAnimationActive={false}
                  onClick={(_, i) => grupSec(gruplar[i]?.ad)}
                  style={{ cursor: 'pointer' }}
                >
                  {gruplar.map((g) => (
                    <Cell key={g.ad} fill={grupRengi(g.ad)} fillOpacity={grup && grup !== g.ad ? 0.3 : 1} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0]
                    return (
                      <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)' }}>
                        {GRUP_ETIKETI[String(p.name)] ?? p.name} · <span className="rakam font-medium">{bicim(Number(p.value))}</span>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>toplam</span>
              <span className="rakam text-[16px] font-semibold leading-tight">{bicim(toplamDeger)}</span>
            </div>
          </div>

          <ul className="min-w-[220px] flex-1">
            {gruplar.map((g) => {
              const bu = grup === g.ad
              return (
                <li key={g.ad}>
                  <button
                    type="button" onClick={() => grupSec(g.ad)} aria-pressed={bu}
                    className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] hover:bg-[var(--plane)]"
                    style={{ background: bu ? 'var(--plane)' : undefined, opacity: grup && !bu ? 0.55 : 1 }}
                  >
                    <span aria-hidden className="inline-block h-2 w-2 shrink-0 self-center rounded-full" style={{ background: grupRengi(g.ad) }} />
                    <span className="truncate" style={{ fontWeight: bu ? 600 : 400 }}>{GRUP_ETIKETI[g.ad] ?? g.ad}</span>
                    <span className="rakam ml-auto shrink-0 font-medium">{bicim(g.deger)}</span>
                    <span className="rakam w-12 shrink-0 text-right text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                      {yuzde(g.deger / toplamDeger)}
                    </span>
                    <span className="w-20 shrink-0" aria-hidden />
                  </button>

                  {/* Dilim secildi: grubun kalemleri, her birinin kendi getirisiyle */}
                  {bu && (
                    <ul className="mb-1 ml-2 border-l pl-2" style={{ borderColor: 'var(--hair)' }}>
                      {g.uyeler.map((u) => {
                        const secili = varlikId === u.varlik_id
                        const p = sonGetiri.get(u.varlik_id)
                        const kv = p ? (dolar ? p.kumulatif_yuzde_usd : p.kumulatif_yuzde) : null
                        const k = kv === null || kv === undefined ? null : Number(kv)
                        const uDeger = cevir(Number(u.deger_tl))
                        // Tek olcum varsa getiri henuz yok: "%0" degil "ilk gun" — pay sanilmasin.
                        const ilkGun = !!p && p.tarih === p.baslangic
                        return (
                          <li key={u.varlik_id}>
                            <button
                              type="button" onClick={() => setVarlikId((v) => (v === u.varlik_id ? null : u.varlik_id))}
                              aria-pressed={secili}
                              className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-[12px] hover:bg-[var(--plane)]"
                              style={{ background: secili ? 'var(--plane)' : undefined }}
                            >
                              <span className="truncate" style={{ fontWeight: secili ? 600 : 400 }}>
                                {u.kod}
                                <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{SINIF_ETIKETI[u.sinif]}</span>
                              </span>
                              <span className="rakam ml-auto shrink-0">{bicim(uDeger)}</span>
                              <span className="rakam w-12 shrink-0 text-right text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                                {toplamDeger > 0 ? yuzde(uDeger / toplamDeger) : '—'}
                              </span>
                              <span
                                className="rakam w-20 shrink-0 text-right text-[11px]"
                                title="Kümülatif getiri (para akışlarından arındırılmış)"
                                style={{ color: k === null || ilkGun ? 'var(--ink-muted)' : k > 0 ? 'var(--artis-iyi)' : k < 0 ? 'var(--kritik)' : 'var(--ink-muted)' }}
                              >
                                {kv === null || kv === undefined ? '—' : ilkGun ? 'ilk gün' : `getiri ${yuzdeMetni(kv)}`}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── Performans cizgisi ─────────────────────────────────────────── */}
      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--hair)' }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: cizgiRengi }} />
            {seciliVarlik ? `${seciliVarlik.kod} · kümülatif getiri` : seciliGrup ? `Toplam portföy · kümülatif getiri (grup için kalem seç)` : 'Toplam portföy · kümülatif getiri'}
            <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{dolar ? '$ bazında' : '₺ bazında'}</span>
            {seri.length > 0 && (
              <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {tarihKisa(seri[0].tarih)}&apos;den beri · {seri.length} ölçüm
              </span>
            )}
          </p>
          {son && (
            <span
              className="rakam text-[17px] font-semibold"
              style={{ color: son.yuzde > 0 ? 'var(--artis-iyi)' : son.yuzde < 0 ? 'var(--kritik)' : 'var(--ink)' }}
            >
              {yuzdeMetni(String(son.yuzde))}
            </span>
          )}
        </div>

        {seri.length < 2 ? (
          <p className="py-6 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            {seri.length === 0 ? 'Henüz ölçüm yok — "Fiyatları güncelle" ilk ölçümü yazar.' : 'İlk ölçüm alındı; çizgi ikinci ölçümle başlar.'}
          </p>
        ) : (
          <div className="mt-2 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seri} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="tarih" tickFormatter={(t) => tarihKisa(t).replace(/ \d{4}$/, '')} tick={EKSEN_STILI} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
                <YAxis tickFormatter={(v) => `${v} %`} tick={EKSEN_STILI} tickLine={false} axisLine={false} width={52} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as { yuzde: number; deger: number }
                    return (
                      <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)' }}>
                        <div className="font-medium">{donemEtiket(String(label)) === String(label) ? tarihKisa(String(label)) : tarihKisa(String(label))}</div>
                        <div className="rakam">{yuzdeMetni(String(p.yuzde))} · {bicim(p.deger)}</div>
                      </div>
                    )
                  }}
                />
                <Line type="monotone" dataKey="yuzde" stroke={cizgiRengi} strokeWidth={2} dot={seri.length < 20} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
