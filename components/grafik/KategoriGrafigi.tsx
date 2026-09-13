'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AylikKategori, KategoriSerisi, Yon } from '@/lib/tipler'
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
/** Kirilimin altindaki seyir grafigi: secili ayda biten 12 ay. */
const SEYIR_AY = 12

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
  let katlananlar: Dilim[] = []
  if (sirali.length > EN_FAZLA_DILIM + 1) {
    const bas = sirali.slice(0, EN_FAZLA_DILIM)
    katlananlar = sirali.slice(EN_FAZLA_DILIM)
    const kalan = katlananlar.reduce((s, d) => s + d.toplam, 0)
    dilimler = [...bas, { ad: DIGER, toplam: kalan }]
  }
  const toplam = dilimler.reduce((s, d) => s + d.toplam, 0)
  return { dilimler, toplam, aylar, katlananlar, katlanan: katlananlar.length }
}

/** Secili kategorinin alt kategori toplamlari, ayni pencerede, buyukten kucuge. */
function altKirilim(kayitlar: AylikKategori[], yon: Yon, kategori: string, aylar: string[]) {
  const pencere = new Set(aylar)
  const t = new Map<string, number>()
  for (const k of kayitlar) {
    if (k.yon !== yon || k.kategori !== kategori || !pencere.has(k.ay)) continue
    t.set(k.alt, (t.get(k.alt) ?? 0) + Number(k.toplam))
  }
  return [...t.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || trSirala(a[0], b[0]))
    .map(([ad, toplam]) => ({ ad: ad === '—' ? '(alt kategori yok)' : ad, toplam }))
}

/** Ay ekseni: 'Eyl' — yil yalnizca Ocak'ta ('Oca 2026'), 12 etiket sigsin diye. */
const ayKisa = (donem: string) =>
  donem.slice(5) === '01' ? donemEtiket(donem) : donemEtiket(donem).split(' ')[0]

/** Secili kategorilerin (Diger icin katlananlarin) ay ay toplami — secili ayda biten 12 ay. */
function aylikSeyir(kayitlar: KategoriSerisi[], yon: Yon, adlar: string[], seciliAy: string) {
  const kume = new Set(adlar)
  const aylar = [...new Set(kayitlar.filter((k) => k.yon === yon && k.donem <= seciliAy).map((k) => k.donem))]
    .sort()
    .slice(-SEYIR_AY)
  const t = new Map<string, number>()
  for (const k of kayitlar) {
    if (k.yon !== yon || !kume.has(k.kategori)) continue
    t.set(k.donem, (t.get(k.donem) ?? 0) + Number(k.toplam))
  }
  // Kaydi olmayan ay 0 olarak durur: "o ay harcamadim" da bir bilgidir.
  return aylar.map((donem) => ({ donem, toplam: t.get(donem) ?? 0 }))
}

type DetaySatir = { ad: string; toplam: number; adet: number }

/** Tek bir ayda, secili kategorinin alt kategorileri — buyukten kucuge. */
function ayinAltlari(kayitlar: AylikKategori[], yon: Yon, kategori: string, donem: string): DetaySatir[] {
  return kayitlar
    .filter((k) => k.yon === yon && k.kategori === kategori && k.ay === donem && Number(k.toplam) > 0)
    .map((k) => ({ ad: k.alt === '—' ? '(alt kategori yok)' : k.alt, toplam: Number(k.toplam), adet: k.adet }))
    .sort((a, b) => b.toplam - a.toplam || trSirala(a.ad, b.ad))
}

/** Tek bir ayda, "Diger"e katlanan kategorilerin tutarlari — buyukten kucuge. */
function ayinKategorileri(kayitlar: KategoriSerisi[], yon: Yon, adlar: string[], donem: string): DetaySatir[] {
  const kume = new Set(adlar)
  return kayitlar
    .filter((k) => k.yon === yon && k.donem === donem && kume.has(k.kategori) && Number(k.toplam) > 0)
    .map((k) => ({ ad: k.kategori, toplam: Number(k.toplam), adet: k.adet }))
    .sort((a, b) => b.toplam - a.toplam || trSirala(a.ad, b.ad))
}

/** Kirilimin altindaki ay ay seyir. Her cubugun uzerinde tutari yazar. */
function AylikSeyirGrafigi({ veri, ad, renk, ay, ayDegistir, satirlar }: {
  veri: { donem: string; toplam: number }[]
  ad: string
  renk: string
  /** Tiklanan ay ('YYYY-MM'); detayi grafigin altinda acilir. */
  ay: string | null
  ayDegistir: (donem: string | null) => void
  /** Secili ayin kirilimi; ay yokken bos. */
  satirlar: DetaySatir[]
}) {
  const enBuyuk = Math.max(0, ...veri.map((v) => v.toplam))
  const ayToplami = ay ? (veri.find((v) => v.donem === ay)?.toplam ?? 0) : 0
  if (veri.length === 0 || enBuyuk === 0) return null
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--hair)' }}>
      <p className="mb-1 text-[12px]" style={{ color: 'var(--ink-2)' }}>
        <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: renk }} />
        {ad} · son {veri.length} ay
        <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          bir aya tıkla, o ayın detayı açılsın
        </span>
      </p>
      {/* 12 etiketli cubuk dar ekrana sigmaz: kirpmak yerine yatay kaydirilir. */}
      <div className="overflow-x-auto">
        {/* Recharts tiklanan katmani (tabindex=-1) odakliyor; tarayici halkasi secili cubugun
            uzerine gurultu ekliyor. Klavyeyle odaklanan sarmalayicinin halkasi yerinde kalir. */}
        <div className="h-[190px] min-w-[520px] [&_.recharts-surface_g:focus]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={veri} margin={{ top: 18, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="donem"
              tickFormatter={ayKisa}
              tick={EKSEN_STILI}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              interval={0}
            />
            {/* Deger her cubugun uzerinde yazili; ikinci bir sayi sutunu gereksiz.
                Eksen gizli oldugu icin tavan yuvarlanmaz — cubuklar alani doldurur. */}
            <YAxis hide domain={[0, enBuyuk * 1.18]} />
            <Tooltip content={<Ipucu />} cursor={{ fill: 'var(--grid)', opacity: 0.45 }} />
            <Bar
              dataKey="toplam"
              name={ad}
              fill={renk}
              radius={[4, 4, 0, 0]}
              maxBarSize={34}
              isAnimationActive={false}
              onClick={(_, i) => ayDegistir(veri[i]?.donem ?? null)}
              style={{ cursor: 'pointer' }}
            >
              {veri.map((v) => (
                <Cell key={v.donem} fill={renk} fillOpacity={ay && ay !== v.donem ? 0.3 : 1} />
              ))}
              <LabelList
                dataKey="toplam"
                position="top"
                offset={6}
                fontSize={10}
                fill="var(--ink-2)"
                className="rakam"
                formatter={(v) => (typeof v === 'number' && v > 0 ? eksenTL(v) : '')}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>

      {ay && (
        <div className="mt-2 rounded-lg p-3" style={{ border: '1px solid var(--hair)', background: 'var(--surface)' }}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-semibold">
              <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: renk }} />
              {ad} · {donemEtiket(ay)}
              <span className="rakam ml-2 font-medium" style={{ color: 'var(--ink-2)' }}>{tl(ayToplami)}</span>
            </span>
            <button
              type="button"
              onClick={() => ayDegistir(null)}
              className="shrink-0 text-[12px]"
              style={{ color: 'var(--ink-muted)' }}
              aria-label="Ay detayını kapat"
            >
              kapat ✕
            </button>
          </div>
          {satirlar.length === 0 ? (
            <p className="py-3 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>Bu ayda kayıt yok.</p>
          ) : (
            <ul className="max-h-[260px] overflow-y-auto">
              {satirlar.map((r) => (
                <li key={r.ad} className="grid grid-cols-[minmax(90px,1fr)_auto_auto] items-center gap-x-3 py-1 text-[12px] sm:grid-cols-[minmax(120px,1fr)_minmax(80px,2fr)_auto_auto]">
                  <span className="truncate">
                    {r.ad}
                    <span className="rakam ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>· {r.adet} işlem</span>
                  </span>
                  <span className="hidden h-2 overflow-hidden rounded-full sm:block" style={{ background: 'var(--grid)' }} aria-hidden>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(2, (r.toplam / satirlar[0].toplam) * 100)}%`, background: renk }}
                    />
                  </span>
                  <span className="rakam text-right font-medium">{tl(r.toplam)}</span>
                  <span className="rakam w-12 text-right" style={{ color: 'var(--ink-muted)' }}>
                    {ayToplami > 0 ? yuzde(r.toplam / ayToplami) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function PastaGorunumu({
  kayitlar, yon, seciliAy, kayit, altKategoriler,
}: {
  kayitlar: KategoriSerisi[]
  yon: Yon
  seciliAy: string
  kayit: YuvaKaydi
  altKategoriler: AylikKategori[]
}) {
  const [aralik, setAralik] = useState<PastaAralik>('1')
  // Tiklanan dilim: alt kategori kirilimi acilir. Pencere degisince kapanir.
  const [secili, setSecili] = useState<string | null>(null)
  // Seyir grafiginde tiklanan ay. Dilim ya da pencere degisince kapanir.
  const [seyirAy, setSeyirAy] = useState<string | null>(null)
  function aralikDegistir(a: PastaAralik) { setAralik(a); setSecili(null); setSeyirAy(null) }
  function sec(ad: string | undefined) {
    if (!ad) return
    setSecili((s) => (s === ad ? null : ad))
    setSeyirAy(null)
  }
  function ayDegistir(donem: string | null) { setSeyirAy((a) => (a === donem ? null : donem)) }
  useEffect(() => {
    if (!secili) return
    // Escape once ay detayini, sonra kirilimi kapatir — icten disa.
    const kacis = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (seyirAy) setSeyirAy(null)
      else setSecili(null)
    }
    document.addEventListener('keydown', kacis)
    return () => document.removeEventListener('keydown', kacis)
  }, [secili, seyirAy])
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

  const { dilimler, toplam, aylar, katlanan, katlananlar } = hesap
  const kirilim = useMemo(() => {
    if (!secili) return null
    if (secili === DIGER) {
      return {
        baslik: 'Diğer · katlanan kategoriler',
        satirlar: katlananlar,
        payda: toplam,
        seyirAdlari: katlananlar.map((d) => d.ad),
      }
    }
    const satirlar = altKirilim(altKategoriler, yon, secili, aylar)
    const kategoriToplami = dilimler.find((d) => d.ad === secili)?.toplam ?? 0
    return { baslik: `${secili} · alt kategoriler`, satirlar, payda: kategoriToplami, seyirAdlari: [secili] }
  }, [secili, katlananlar, toplam, altKategoriler, yon, aylar, dilimler])
  // Seyir pasta penceresinden bagimsizdir: her zaman secili ayda biten 12 ay.
  const seyir = useMemo(
    () => (kirilim ? aylikSeyir(kayitlar, yon, kirilim.seyirAdlari, seciliAy) : []),
    [kirilim, kayitlar, yon, seciliAy],
  )
  // Tiklanan ayin kirilimi: normal dilimde alt kategoriler, Diger'de katlanan kategoriler.
  const ayDetayi = useMemo<DetaySatir[]>(() => {
    if (!secili || !seyirAy) return []
    if (secili === DIGER) return ayinKategorileri(kayitlar, yon, katlananlar.map((d) => d.ad), seyirAy)
    return ayinAltlari(altKategoriler, yon, secili, seyirAy)
  }, [secili, seyirAy, katlananlar, kayitlar, yon, altKategoriler])
  const ilk = aylar[0]
  const son = aylar.at(-1)
  const pencereEtiketi =
    !ilk ? '—'
    : ilk === son ? donemEtiket(ilk)
    : `${donemEtiket(ilk)} – ${donemEtiket(son!)} · ${aylar.length} ay`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SecimGrubu secenekler={PASTA_ARALIKLARI} deger={aralik} degistir={aralikDegistir} etiket="Pencere" />
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{pencereEtiketi}</span>
      </div>

      {toplam === 0 ? (
        <p className="py-16 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Bu pencerede {yon.toLocaleLowerCase('tr')} kaydı yok.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative h-[240px] w-[240px] shrink-0 [&_.recharts-surface_g:focus]:outline-none">
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
                  onClick={(_, i) => sec(dilimler[i]?.ad)}
                  style={{ cursor: 'pointer' }}
                >
                  {dilimler.map((d) => (
                    <Cell
                      key={d.ad}
                      fill={renk(d.ad)}
                      fillOpacity={secili && secili !== d.ad ? 0.3 : 1}
                    />
                  ))}
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
            {dilimler.map((d) => {
              const bu = secili === d.ad
              const soluk = secili !== null && !bu
              return (
                <li key={d.ad}>
                  <button
                    type="button"
                    onClick={() => sec(d.ad)}
                    aria-pressed={bu}
                    className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] hover:bg-[var(--plane)]"
                    style={{ background: bu ? 'var(--plane)' : undefined, opacity: soluk ? 0.55 : 1 }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 self-center rounded-full"
                      style={{ background: renk(d.ad) }}
                    />
                    <span className="truncate" style={{ color: d.ad === DIGER ? 'var(--ink-muted)' : 'var(--ink)', fontWeight: bu ? 600 : 400 }}>
                      {d.ad}
                      {d.ad === DIGER && katlanan > 0 && (
                        <span className="ml-1 text-[11px] font-normal" style={{ color: 'var(--ink-muted)' }}>· {katlanan} kategori</span>
                      )}
                    </span>
                    <span className="rakam ml-auto shrink-0 font-medium">{tl(d.toplam)}</span>
                    <span className="rakam w-12 shrink-0 text-right text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                      {yuzde(d.toplam / toplam)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {kirilim && (
        <div className="mt-4 rounded-lg p-3" style={{ border: '1px solid var(--hair)', background: 'var(--plane)' }}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-semibold">
              <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: renk(secili!) }} />
              {kirilim.baslik}
              <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--ink-muted)' }}>{pencereEtiketi}</span>
            </span>
            <button
              type="button"
              onClick={() => setSecili(null)}
              className="shrink-0 text-[12px]"
              style={{ color: 'var(--ink-muted)' }}
              aria-label="Kırılımı kapat"
            >
              kapat ✕
            </button>
          </div>
          {kirilim.satirlar.length === 0 ? (
            <p className="py-4 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>Bu pencerede kırılım yok.</p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {kirilim.satirlar.map((r) => {
                const enBuyuk = kirilim.satirlar[0].toplam
                return (
                  <li key={r.ad} className="grid grid-cols-[minmax(90px,1fr)_auto_auto] items-center gap-x-3 py-1 text-[12px] sm:grid-cols-[minmax(120px,1fr)_minmax(80px,2fr)_auto_auto]">
                    <span className="truncate">{r.ad}</span>
                    {/* Tek renk, buyukluk: secili kategorinin rengiyle ince cubuk */}
                    <span className="hidden h-2 overflow-hidden rounded-full sm:block" style={{ background: 'var(--grid)' }} aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (r.toplam / enBuyuk) * 100)}%`, background: renk(secili!) }} />
                    </span>
                    <span className="rakam text-right font-medium">{tl(r.toplam)}</span>
                    <span className="rakam w-12 text-right" style={{ color: 'var(--ink-muted)' }}>
                      {kirilim.payda > 0 ? yuzde(r.toplam / kirilim.payda) : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <AylikSeyirGrafigi
            veri={seyir}
            ad={secili!}
            renk={renk(secili!)}
            ay={seyirAy}
            ayDegistir={ayDegistir}
            satirlar={ayDetayi}
          />
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
