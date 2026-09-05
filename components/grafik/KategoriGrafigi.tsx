'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import type { KategoriSerisi, Yon } from '@/lib/tipler'
import { donemEtiket, tl, tlKurus, trSirala, yuzde } from '@/lib/bicim'
import {
  EKSEN_STILI, Ipucu, NOTR_RENK, SERI_RENKLERI, SecimGrubu, eksenTL, ustSinir,
} from './ortak'

type Bucket = 'hafta' | 'ay' | 'yil'
type Gorunum = 'cubuk' | 'pasta'
type Seriler = Record<Bucket, KategoriSerisi[]>

const BUCKET_ADI: Record<Bucket, string> = { hafta: 'Haftalık', ay: 'Aylık', yil: 'Yıllık' }
const EN_FAZLA_SERI = SERI_RENKLERI.length

/**
 * Renk yuvasi atamasi: hayatta kalanlar yuvasini korur, yalnizca yeni gelenler
 * bostaki en kucuk yuvayi alir. Renk KIMLIGE baglidir, siraya degil — secim ya da
 * donem degisince mevcut kategoriler yeniden boyanmaz.
 */
function yuvaAta(onceki: Record<string, number>, adlar: string[]) {
  const yeni: Record<string, number> = {}
  for (const ad of adlar) if (onceki[ad] !== undefined) yeni[ad] = onceki[ad]
  const dolu = new Set(Object.values(yeni))
  for (const ad of adlar) {
    if (yeni[ad] !== undefined) continue
    let bos = 0
    while (dolu.has(bos)) bos++
    yeni[ad] = bos
    dolu.add(bos)
  }
  // Icerik degismediyse ayni nesne: setState no-op olur, effect dongusu kurulmaz.
  const eskiAnahtarlar = Object.keys(onceki)
  const ayniMi =
    eskiAnahtarlar.length === adlar.length && adlar.every((ad) => onceki[ad] === yeni[ad])
  return ayniMi ? onceki : yeni
}

type YuvaKaydi = {
  yuvalar: Record<string, number>
  /** Gorunur kategorilere yuva garanti eder; ortak olanlar rengini korur. */
  garanti: (adlar: string[]) => void
}

export default function KategoriGrafigi({
  seriler, seciliAy,
}: {
  seriler: Seriler
  /** Panoda secili ay ('YYYY-MM'). Pasta gorunumunun "Aylik / 6 aylik / 1 yillik" penceresi buraya baglidir. */
  seciliAy: string
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
        : <PastaGorunumu key={yon} kayitlar={seriler.ay} yon={yon} seciliAy={seciliAy} kayit={kayit} />}
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

/* ───────────────────────── Pasta ───────────────────────── */

type PastaAralik = '1' | '6' | '12'
const PASTA_ARALIKLARI: { deger: PastaAralik; ad: string }[] = [
  { deger: '1', ad: 'Aylık' },
  { deger: '6', ad: '6 aylık' },
  { deger: '12', ad: '1 yıllık' },
]
const DIGER = 'Diğer'
/** Pasta en fazla 6 dilim: 5 kategori + Diger. Daha fazlasi okunmaz. */
const EN_FAZLA_DILIM = 5

type Dilim = { ad: string; toplam: number }

/** Secili ayda biten N aylik pencerede kategori toplamlari; 5 + Diger'e katlanir. */
function dilimleriHesapla(kayitlar: KategoriSerisi[], yon: Yon, seciliAy: string, aralik: PastaAralik) {
  const adet = Number(aralik)
  const aylar = [...new Set(kayitlar.filter((k) => k.yon === yon && k.donem <= seciliAy).map((k) => k.donem))]
    .sort()
    .slice(-adet)
  const pencere = new Set(aylar)

  const t = new Map<string, number>()
  for (const k of kayitlar) {
    if (k.yon !== yon || !pencere.has(k.donem)) continue
    t.set(k.kategori, (t.get(k.kategori) ?? 0) + Number(k.toplam))
  }
  const sirali = [...t.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || trSirala(a[0], b[0]))
    .map(([ad, toplam]) => ({ ad, toplam }))

  let dilimler: Dilim[] = sirali
  if (sirali.length > EN_FAZLA_DILIM + 1) {
    const bas = sirali.slice(0, EN_FAZLA_DILIM)
    const kalan = sirali.slice(EN_FAZLA_DILIM).reduce((s, d) => s + d.toplam, 0)
    dilimler = [...bas, { ad: DIGER, toplam: kalan }]
  }
  const toplam = dilimler.reduce((s, d) => s + d.toplam, 0)
  return { dilimler, toplam, aylar, katlanan: Math.max(0, sirali.length - EN_FAZLA_DILIM) }
}

function PastaGorunumu({
  kayitlar, yon, seciliAy, kayit,
}: {
  kayitlar: KategoriSerisi[]
  yon: Yon
  seciliAy: string
  kayit: YuvaKaydi
}) {
  const [aralik, setAralik] = useState<PastaAralik>('1')
  const hesap = useMemo(
    () => dilimleriHesapla(kayitlar, yon, seciliAy, aralik),
    [kayitlar, yon, seciliAy, aralik],
  )
  const adlar = useMemo(
    () => hesap.dilimler.filter((d) => d.ad !== DIGER).map((d) => d.ad),
    [hesap.dilimler],
  )
  const yuvalar = useMemo(() => yuvaAta(kayit.yuvalar, adlar), [kayit.yuvalar, adlar])
  const { garanti } = kayit
  useEffect(() => { garanti(adlar) }, [garanti, adlar])
  const renk = (ad: string) => (ad === DIGER ? NOTR_RENK : SERI_RENKLERI[yuvalar[ad] ?? 0])

  const { dilimler, toplam, aylar, katlanan } = hesap
  const ilk = aylar[0]
  const son = aylar.at(-1)
  const pencereEtiketi =
    !ilk ? '—'
    : ilk === son ? donemEtiket(ilk)
    : `${donemEtiket(ilk)} – ${donemEtiket(son!)} · ${aylar.length} ay`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SecimGrubu secenekler={PASTA_ARALIKLARI} deger={aralik} degistir={setAralik} etiket="Pencere" />
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{pencereEtiketi}</span>
      </div>

      {toplam === 0 ? (
        <p className="py-16 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Bu pencerede {yon.toLocaleLowerCase('tr')} kaydı yok.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative h-[240px] w-[240px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dilimler}
                  dataKey="toplam"
                  nameKey="ad"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={108}
                  paddingAngle={1.5}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {dilimler.map((d) => <Cell key={d.ad} fill={renk(d.ad)} />)}
                </Pie>
                <Tooltip content={<PastaIpucu toplam={toplam} renk={renk} />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Ortadaki toplam — sayi grafigin kendisi, etrafi ona hizmet eder. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>toplam {yon.toLocaleLowerCase('tr')}</span>
              <span className="rakam text-[17px] font-semibold leading-tight">{tl(toplam)}</span>
            </div>
          </div>

          {/* Liste: kimlik hicbir zaman yalniz renkle tasinmaz. */}
          <ul className="min-w-[220px] flex-1">
            {dilimler.map((d) => (
              <li key={d.ad} className="flex items-baseline gap-2 py-1.5 text-[13px]">
                <span
                  aria-hidden
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 self-center rounded-full"
                  style={{ background: renk(d.ad) }}
                />
                <span className="truncate" style={{ color: d.ad === DIGER ? 'var(--ink-muted)' : 'var(--ink)' }}>
                  {d.ad}
                  {d.ad === DIGER && katlanan > 0 && (
                    <span className="ml-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>· {katlanan} kategori</span>
                  )}
                </span>
                <span className="rakam ml-auto shrink-0 font-medium">{tl(d.toplam)}</span>
                <span className="rakam w-12 shrink-0 text-right text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                  {yuzde(d.toplam / toplam)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PastaIpucu({
  active, payload, toplam, renk,
}: {
  active?: boolean
  payload?: { name?: string; value?: number }[]
  toplam: number
  renk: (ad: string) => string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  if (!p.name || p.value === undefined) return null
  return (
    <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: renk(p.name) }} />
        <span style={{ color: 'var(--ink-2)' }}>{p.name}</span>
        <span className="rakam ml-3 font-medium">{tlKurus(p.value)}</span>
        <span className="rakam" style={{ color: 'var(--ink-muted)' }}>{yuzde(p.value / toplam)}</span>
      </div>
    </div>
  )
}
