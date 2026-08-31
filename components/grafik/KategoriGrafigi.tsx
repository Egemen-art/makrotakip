'use client'

import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { KategoriSerisi, Yon } from '@/lib/tipler'
import { donemEtiket, trSirala } from '@/lib/bicim'
import { EKSEN_STILI, Ipucu, SERI_RENKLERI, eksenTL, ustSinir } from './ortak'

type Bucket = 'hafta' | 'ay' | 'yil'
const BUCKET_ADI: Record<Bucket, string> = { hafta: 'Haftalık', ay: 'Aylık', yil: 'Yıllık' }
const EN_FAZLA_SERI = SERI_RENKLERI.length

export default function KategoriGrafigi({
  seriler,
}: {
  seriler: Record<Bucket, KategoriSerisi[]>
}) {
  const [bucket, setBucket] = useState<Bucket>('ay')
  const [yon, setYon] = useState<Yon>('Gider')
  const [tumDonemler, setTumDonemler] = useState(false)

  // Kategori -> renk yuvasi. Secim degistiginde hayatta kalanlar yuvasini korur;
  // yalnizca yeni eklenenler bostaki en kucuk yuvayi alir (renk kimlige bagli, sirasina degil).
  const [yuvalar, setYuvalar] = useState<Record<string, number>>({})
  const [secili, setSecili] = useState<string[] | null>(null)

  const kayitlar = seriler[bucket]

  // Bu yon icin kategoriler, toplam buyuklugune gore.
  const kategoriler = useMemo(() => {
    const toplamlar = new Map<string, number>()
    for (const k of kayitlar) {
      if (k.yon !== yon) continue
      toplamlar.set(k.kategori, (toplamlar.get(k.kategori) ?? 0) + Number(k.toplam))
    }
    return [...toplamlar.entries()]
      .sort((a, b) => b[1] - a[1] || trSirala(a[0], b[0]))
      .map(([ad]) => ad)
  }, [kayitlar, yon])

  // Ilk acilista en buyuk 5 kategori secili gelir.
  const etkinSecim = secili ?? kategoriler.slice(0, 5)
  const etkinYuvalar = useMemo(() => {
    if (secili) return yuvalar
    return Object.fromEntries(etkinSecim.map((k, i) => [k, i]))
  }, [secili, yuvalar, etkinSecim])

  function degistir(kategori: string) {
    const varMi = etkinSecim.includes(kategori)
    if (!varMi && etkinSecim.length >= EN_FAZLA_SERI) return

    const yeniSecim = varMi
      ? etkinSecim.filter((k) => k !== kategori)
      : [...etkinSecim, kategori]

    const yeniYuvalar = { ...etkinYuvalar }
    if (varMi) {
      delete yeniYuvalar[kategori]
    } else {
      const dolu = new Set(Object.values(yeniYuvalar))
      let bos = 0
      while (dolu.has(bos)) bos++
      yeniYuvalar[kategori] = bos
    }
    setYuvalar(yeniYuvalar)
    setSecili(yeniSecim)
  }

  const donemler = useMemo(() => {
    const hepsi = [...new Set(kayitlar.filter((k) => k.yon === yon).map((k) => k.donem))].sort()
    return tumDonemler ? hepsi : hepsi.slice(-12)
  }, [kayitlar, yon, tumDonemler])

  const veri = useMemo(() => {
    const indeks = new Map<string, number>()
    for (const k of kayitlar) {
      if (k.yon !== yon || !etkinSecim.includes(k.kategori)) continue
      indeks.set(`${k.donem}|${k.kategori}`, Number(k.toplam))
    }
    return donemler.map((d) => {
      const satir: Record<string, string | number> = { donem: d }
      for (const kat of etkinSecim) satir[kat] = indeks.get(`${d}|${kat}`) ?? 0
      return satir
    })
  }, [kayitlar, yon, etkinSecim, donemler])

  const tavan = ustSinir(
    Math.max(0, ...veri.flatMap((s) =>
      etkinSecim.map((k) => Number(s[k] ?? 0)))),
  )
  const tekSeri = etkinSecim.length === 1

  return (
    <div>
      {/* Filtreler tek satirda, grafigin uzerinde */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SecimGrubu
          secenekler={(['hafta', 'ay', 'yil'] as Bucket[]).map((b) => ({ deger: b, ad: BUCKET_ADI[b] }))}
          deger={bucket}
          degistir={(d) => setBucket(d as Bucket)}
          etiket="Dönem"
        />
        <SecimGrubu
          secenekler={[{ deger: 'Gider', ad: 'Gider' }, { deger: 'Gelir', ad: 'Gelir' }]}
          deger={yon}
          degistir={(d) => { setYon(d as Yon); setSecili(null); setYuvalar({}) }}
          etiket="Yön"
        />
        <button
          onClick={() => setTumDonemler((v) => !v)}
          className="rounded-lg px-2.5 py-1 text-[12px]"
          style={{ border: '1px solid var(--hair)', color: 'var(--ink-2)' }}
        >
          {tumDonemler ? 'Son 12 dönem' : 'Tüm dönemler'}
        </button>
      </div>

      {/* Kategori secici — secili olanlar seri rengiyle isaretli */}
      <div
        className="mb-3 flex max-h-[76px] flex-wrap gap-1.5 overflow-y-auto pr-1"
        role="group"
        aria-label="Kategori seçimi"
      >
        {kategoriler.map((kat) => {
          const acik = etkinSecim.includes(kat)
          const yuva = etkinYuvalar[kat]
          const doluMu = !acik && etkinSecim.length >= EN_FAZLA_SERI
          return (
            <button
              key={kat}
              onClick={() => degistir(kat)}
              aria-pressed={acik}
              disabled={doluMu}
              title={doluMu ? `En fazla ${EN_FAZLA_SERI} kategori karşılaştırılabilir` : kat}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] disabled:opacity-40"
              style={{
                border: '1px solid var(--hair)',
                background: acik ? 'var(--plane)' : 'transparent',
                color: acik ? 'var(--ink)' : 'var(--ink-muted)',
              }}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: acik && yuva !== undefined ? SERI_RENKLERI[yuva] : 'var(--axis)',
                }}
              />
              {kat}
            </button>
          )
        })}
      </div>

      {etkinSecim.length === 0 ? (
        <p className="py-16 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Karşılaştırmak için en az bir kategori seç.
        </p>
      ) : (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={veri} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="donem"
                tickFormatter={donemEtiket}
                tick={EKSEN_STILI}
                tickLine={false}
                axisLine={{ stroke: 'var(--axis)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={eksenTL}
                tick={EKSEN_STILI}
                tickLine={false}
                axisLine={false}
                width={58}
                domain={[0, tavan]}
              />
              <Tooltip content={<Ipucu />} cursor={{ fill: 'var(--grid)', opacity: 0.45 }} />
              {!tekSeri && (
                <Legend
                  verticalAlign="top"
                  align="left"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  formatter={(deger) => (
                    <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>{deger}</span>
                  )}
                />
              )}
              {etkinSecim.map((kat) => (
                <Bar
                  key={kat}
                  dataKey={kat}
                  name={kat}
                  fill={SERI_RENKLERI[etkinYuvalar[kat] ?? 0]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function SecimGrubu({
  secenekler, deger, degistir, etiket,
}: {
  secenekler: { deger: string; ad: string }[]
  deger: string
  degistir: (d: string) => void
  etiket: string
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      role="group"
      aria-label={etiket}
      style={{ border: '1px solid var(--hair)' }}
    >
      {secenekler.map((s) => {
        const acik = s.deger === deger
        return (
          <button
            key={s.deger}
            onClick={() => degistir(s.deger)}
            aria-pressed={acik}
            className="rounded-md px-2.5 py-1 text-[12px] font-medium"
            style={{
              background: acik ? 'var(--seri-1)' : 'transparent',
              color: acik ? '#fff' : 'var(--ink-2)',
            }}
          >
            {s.ad}
          </button>
        )
      })}
    </div>
  )
}
