'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AylikKategori, KategoriSerisi, Yon } from '@/lib/tipler'
import PastaGorunumu from './KategoriPasta'
import { donemEtiket, tl, trSirala } from '@/lib/bicim'
import {
  EKSEN_STILI, Ipucu, SERI_RENKLERI, SecimGrubu, eksenTL, ustSinir, yuvaAta, type YuvaKaydi,
} from './ortak'

type Bucket = 'hafta' | 'ay' | 'yil'
type Gorunum = 'cubuk' | 'pasta'
type Seriler = Record<Bucket, KategoriSerisi[]>

const BUCKET_ADI: Record<Bucket, string> = { hafta: 'Haftalık', ay: 'Aylık', yil: 'Yıllık' }
const EN_FAZLA_SERI = SERI_RENKLERI.length

export default function KategoriGrafigi({
  seriler, seciliAy, altKategoriler,
}: {
  seriler: Seriler
  /** Panoda secili ay ('YYYY-MM'). Pasta gorunumunun "Aylik / 6 aylik / 1 yillik" penceresi buraya baglidir. */
  seciliAy: string
  /** v_aylik_kategori — dilime tiklayinca alt kategori kirilimi buradan. */
  altKategoriler: AylikKategori[]
}) {
  const [gorunum, setGorunum] = useState<Gorunum>('cubuk')
  const [yon, setYon] = useState<Yon>('Gider')
  // Renk kaydi iki gorunumun ORTAGI: Cubuk'ta turuncu olan "Ev" Pasta'da da turuncudur.
  // Yon degisince sifirlanir (gider ve gelir kategorileri ayri evrenler).
  const [yuvalar, setYuvalar] = useState<Record<string, number>>({})
  const kayit: YuvaKaydi = {
    yuvalar,
    garanti: (adlar) => setYuvalar((onceki) => yuvaAta(onceki, adlar)),
  }
  function yonDegistir(y: Yon) { setYon(y); setYuvalar({}) }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SecimGrubu<Gorunum>
          secenekler={[{ deger: 'cubuk', ad: 'Çubuk' }, { deger: 'pasta', ad: 'Pasta' }]}
          deger={gorunum}
          degistir={setGorunum}
          etiket="Görünüm"
        />
        <SecimGrubu<Yon>
          secenekler={[{ deger: 'Gider', ad: 'Gider' }, { deger: 'Gelir', ad: 'Gelir' }]}
          deger={yon}
          degistir={yonDegistir}
          etiket="Yön"
        />
      </div>

      {/* key={yon}: yon degisince secim sifirdan kurulur. */}
      {gorunum === 'cubuk'
        ? <CubukGorunumu key={yon} seriler={seriler} yon={yon} kayit={kayit} />
        : <PastaGorunumu key={yon} kayitlar={seriler.ay} yon={yon} seciliAy={seciliAy} kayit={kayit} altKategoriler={altKategoriler} />}
    </div>
  )
}

/* ───────────────────────── Cubuk ───────────────────────── */

function CubukGorunumu({ seriler, yon, kayit }: { seriler: Seriler; yon: Yon; kayit: YuvaKaydi }) {
  const [bucket, setBucket] = useState<Bucket>('ay')
  const [tumDonemler, setTumDonemler] = useState(false)
  const [secili, setSecili] = useState<string[] | null>(null)

  const kayitlar = seriler[bucket]

  // Bu yon icin kategoriler ve toplamlari, buyukten kucuge.
  const { kategoriler, toplamlar } = useMemo(() => {
    const t = new Map<string, number>()
    for (const k of kayitlar) {
      if (k.yon !== yon) continue
      t.set(k.kategori, (t.get(k.kategori) ?? 0) + Number(k.toplam))
    }
    const sirali = [...t.entries()]
      .sort((a, b) => b[1] - a[1] || trSirala(a[0], b[0]))
      .map(([ad]) => ad)
    return { kategoriler: sirali, toplamlar: t }
  }, [kayitlar, yon])

  // Ilk acilista en buyuk 5 kategori secili gelir.
  const etkinSecim = secili ?? kategoriler.slice(0, 5)
  // Render'da saf hesap (ilk karede dogru renk); effect ortak kaydi ayni sonuca esitler.
  const etkinYuvalar = useMemo(() => yuvaAta(kayit.yuvalar, etkinSecim), [kayit.yuvalar, etkinSecim])
  const { garanti } = kayit
  useEffect(() => { garanti(etkinSecim) }, [garanti, etkinSecim])

  function degistir(kategori: string) {
    const varMi = etkinSecim.includes(kategori)
    if (!varMi && etkinSecim.length >= EN_FAZLA_SERI) return
    setSecili(varMi ? etkinSecim.filter((k) => k !== kategori) : [...etkinSecim, kategori])
  }
  function sifirla() { setSecili(null) }

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
    Math.max(0, ...veri.flatMap((s) => etkinSecim.map((k) => Number(s[k] ?? 0)))),
  )
  const tekSeri = etkinSecim.length === 1

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SecimGrubu<Bucket>
          secenekler={(['hafta', 'ay', 'yil'] as Bucket[]).map((b) => ({ deger: b, ad: BUCKET_ADI[b] }))}
          deger={bucket}
          degistir={setBucket}
          etiket="Dönem"
        />
        <KategoriAcilir
          secenekler={kategoriler.map((ad) => ({ ad, toplam: toplamlar.get(ad) ?? 0 }))}
          secili={etkinSecim}
          yuvalar={etkinYuvalar}
          degistir={degistir}
          sifirla={sifirla}
          enFazla={EN_FAZLA_SERI}
        />
        <button
          type="button"
          onClick={() => setTumDonemler((v) => !v)}
          className="rounded-lg px-2.5 py-1 text-[12px]"
          style={{ border: '1px solid var(--hair)', color: 'var(--ink-2)' }}
        >
          {tumDonemler ? 'Son 12 dönem' : 'Tüm dönemler'}
        </button>
      </div>

      {etkinSecim.length === 0 ? (
        <p className="py-16 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Karşılaştırmak için listeden en az bir kategori seç.
        </p>
      ) : (
        <>
          {tekSeri && (
            <p className="mb-1 text-[12px]" style={{ color: 'var(--ink-2)' }}>
              <span
                aria-hidden
                className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ background: SERI_RENKLERI[etkinYuvalar[etkinSecim[0]] ?? 0] }}
              />
              {etkinSecim[0]}
            </p>
          )}
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
        </>
      )}
    </div>
  )
}

/** Asagi acilan kategori listesi: tutara gore buyukten kucuge, tutar yaninda. */
function KategoriAcilir({
  secenekler, secili, yuvalar, degistir, sifirla, enFazla,
}: {
  secenekler: { ad: string; toplam: number }[]
  secili: string[]
  yuvalar: Record<string, number>
  degistir: (ad: string) => void
  sifirla: () => void
  enFazla: number
}) {
  const [acik, setAcik] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    const disariTik = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false)
    }
    const kacis = (e: KeyboardEvent) => { if (e.key === 'Escape') setAcik(false) }
    document.addEventListener('mousedown', disariTik)
    document.addEventListener('keydown', kacis)
    return () => {
      document.removeEventListener('mousedown', disariTik)
      document.removeEventListener('keydown', kacis)
    }
  }, [acik])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={acik}
        onClick={() => setAcik((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium"
        style={{ border: '1px solid var(--hair)', color: 'var(--ink)', background: acik ? 'var(--plane)' : 'transparent' }}
      >
        Kategoriler
        <span className="rakam" style={{ color: 'var(--ink-muted)' }}>{secili.length}/{enFazla}</span>
        <span aria-hidden style={{ color: 'var(--ink-muted)' }}>{acik ? '▴' : '▾'}</span>
      </button>

      {acik && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Kategori seçimi"
          className="kart absolute left-0 z-20 mt-1 w-[320px] max-w-[calc(100vw-2rem)] p-1 shadow-lg"
          style={{ background: 'var(--surface)' }}
        >
          <div
            className="flex items-center justify-between px-2 pb-1 pt-1 text-[11px]"
            style={{ color: 'var(--ink-muted)', borderBottom: '1px solid var(--hair)' }}
          >
            <span>Tutara göre · en fazla {enFazla}</span>
            <button type="button" onClick={sifirla} className="font-medium" style={{ color: 'var(--seri-1)' }}>
              İlk 5&apos;e dön
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto pt-1">
            {secenekler.map(({ ad, toplam }) => {
              const secildi = secili.includes(ad)
              const doluMu = !secildi && secili.length >= enFazla
              return (
                <label
                  key={ad}
                  role="option"
                  aria-selected={secildi}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-[var(--plane)]"
                  style={{ opacity: doluMu ? 0.45 : 1, cursor: doluMu ? 'not-allowed' : 'pointer' }}
                  title={doluMu ? `En fazla ${enFazla} kategori karşılaştırılabilir` : undefined}
                >
                  <input
                    type="checkbox"
                    checked={secildi}
                    disabled={doluMu}
                    onChange={() => degistir(ad)}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: secildi ? SERI_RENKLERI[yuvalar[ad] ?? 0] : 'var(--axis)' }}
                  />
                  <span className="truncate" style={{ color: secildi ? 'var(--ink)' : 'var(--ink-2)' }}>{ad}</span>
                  <span className="rakam ml-auto shrink-0" style={{ color: 'var(--ink-muted)' }}>{tl(toplam)}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
