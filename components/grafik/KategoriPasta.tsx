'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AylikKategori, GunSatiri, KategoriSerisi, Yon } from '@/lib/tipler'
import { gunlukKirilim } from '@/app/eylemler'
import { donemEtiket, tarihKisa, tl, tlKurus, trSirala, yuzde } from '@/lib/bicim'
import {
  EKSEN_STILI, Ipucu, NOTR_RENK, SERI_RENKLERI, SecimGrubu, eksenTL, yuvaAta, type YuvaKaydi,
} from './ortak'


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

/** ham: sorguya giden gercek deger ('—' dahil); ad: ekranda gorunen. */
type DetaySatir = { ad: string; ham: string; toplam: number; adet: number }

/** Tek bir ayda, secili kategorinin alt kategorileri — buyukten kucuge. */
function ayinAltlari(kayitlar: AylikKategori[], yon: Yon, kategori: string, donem: string): DetaySatir[] {
  return kayitlar
    .filter((k) => k.yon === yon && k.kategori === kategori && k.ay === donem && Number(k.toplam) > 0)
    .map((k) => ({ ad: k.alt === '—' ? '(alt kategori yok)' : k.alt, ham: k.alt, toplam: Number(k.toplam), adet: k.adet }))
    .sort((a, b) => b.toplam - a.toplam || trSirala(a.ad, b.ad))
}

/** Tek bir ayda, "Diger"e katlanan kategorilerin tutarlari — buyukten kucuge. */
function ayinKategorileri(kayitlar: KategoriSerisi[], yon: Yon, adlar: string[], donem: string): DetaySatir[] {
  const kume = new Set(adlar)
  return kayitlar
    .filter((k) => k.yon === yon && k.donem === donem && kume.has(k.kategori) && Number(k.toplam) > 0)
    .map((k) => ({ ad: k.kategori, ham: k.kategori, toplam: Number(k.toplam), adet: k.adet }))
    .sort((a, b) => b.toplam - a.toplam || trSirala(a.ad, b.ad))
}

/** Kirilimin altindaki ay ay seyir. Her cubugun uzerinde tutari yazar. */
function AylikSeyirGrafigi({
  veri, ad, renk, ay, ayDegistir, satirlar, seciliSatir, satirSec, kategoriSatiri, gunler, gunDurumu,
}: {
  veri: { donem: string; toplam: number }[]
  ad: string
  renk: string
  /** Tiklanan ay ('YYYY-MM'); detayi grafigin altinda acilir. */
  ay: string | null
  ayDegistir: (donem: string | null) => void
  /** Secili ayin kirilimi; ay yokken bos. */
  satirlar: DetaySatir[]
  /** Ay kiriliminda tiklanan satir (alt kategori adi) ve secici. */
  seciliSatir: string | null
  satirSec: (r: DetaySatir) => void
  /** Satirlar kategori mi (Diger secildiyse) yoksa alt kategori mi? */
  kategoriSatiri: boolean
  gunler: GunSatiri[] | null
  gunDurumu: 'yok' | 'yukleniyor' | 'hazir' | 'hata'
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
            <ul className="max-h-[420px] overflow-y-auto">
              {satirlar.map((r) => {
                const bu = seciliSatir === r.ad
                return (
                  <li key={r.ad}>
                    {/* Kategori satiri secilirse ayni senaryo o kategori icin kurulur;
                        alt kategori satiri ise o ayin GUNLERINE iner. */}
                    <button
                      type="button"
                      onClick={() => satirSec(r)}
                      aria-pressed={bu}
                      className="grid w-full grid-cols-[minmax(90px,1fr)_auto_auto] items-center gap-x-3 rounded-md px-1 py-1 text-left text-[12px] hover:bg-[var(--plane)] sm:grid-cols-[minmax(120px,1fr)_minmax(80px,2fr)_auto_auto]"
                      style={{ background: bu ? 'var(--plane)' : undefined }}
                    >
                      <span className="truncate">
                        <span aria-hidden style={{ color: 'var(--ink-muted)' }}>{bu ? '▾ ' : '▸ '}</span>
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
                    </button>

                    {bu && !kategoriSatiri && (
                      <GunDetayi satirlar={gunler} durum={gunDurumu} renk={renk} />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Ay kiriliminda secilen alt kategorinin o ay icindeki gunleri. */
function GunDetayi({
  satirlar, durum, renk,
}: {
  satirlar: GunSatiri[] | null
  durum: 'yok' | 'yukleniyor' | 'hazir' | 'hata'
  renk: string
}) {
  if (durum === 'yukleniyor') {
    return <p className="py-2 pl-5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>günler yükleniyor…</p>
  }
  if (durum === 'hata') {
    return <p className="py-2 pl-5 text-[11px]" style={{ color: 'var(--kritik)' }}>Günler getirilemedi.</p>
  }
  if (!satirlar || satirlar.length === 0) {
    return <p className="py-2 pl-5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>Gün kaydı yok.</p>
  }

  const enBuyuk = Math.max(...satirlar.map((r) => Number(r.tutar)))
  // Ayni gunun ilk satirinda tarih yazilir; tekrar eden tarih gurultu olur.
  const ilkGunMu = satirlar.map((r, i) => i === 0 || satirlar[i - 1].tarih !== r.tarih)

  return (
    <ul className="mb-1 ml-1 mt-0.5 border-l pl-3" style={{ borderColor: 'var(--hair)' }}>
      {satirlar.map((r, i) => {
        const yeniGun = ilkGunMu[i]
        return (
          <li
            key={i}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2 py-[3px] text-[11px] sm:grid-cols-[auto_minmax(0,1fr)_minmax(60px,1fr)_auto]"
          >
            <span className="rakam w-[54px] shrink-0" style={{ color: yeniGun ? 'var(--ink-2)' : 'transparent' }}>
              {tarihKisa(r.tarih).replace(/ \d{4}$/, '')}
            </span>
            <span className="truncate" style={{ color: 'var(--ink-2)' }}>
              {r.aciklama || r.hesap || '—'}
              {r.bolum === 'arsiv' && (
                <span className="ml-1.5" style={{ color: 'var(--ink-muted)' }}>· arşiv</span>
              )}
            </span>
            <span className="hidden h-1.5 overflow-hidden rounded-full sm:block" style={{ background: 'var(--grid)' }} aria-hidden>
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(2, (Number(r.tutar) / enBuyuk) * 100)}%`, background: renk, opacity: 0.75 }}
              />
            </span>
            <span className="rakam text-right font-medium">{tlKurus(r.tutar)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default function PastaGorunumu({
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
  function aralikDegistir(a: PastaAralik) { setAralik(a); setSecili(null); setSeyirAy(null); gunleriSifirla() }
  function sec(ad: string | undefined) {
    if (!ad) return
    setSecili((s) => (s === ad ? null : ad))
    setSeyirAy(null)
    gunleriSifirla()
  }
  // Ay kiriliminda tiklanan satir ve o satirin gunleri. Gun verisi sayfayla
  // gelmiyor: yalnizca tiklaninca sunucu eyleminden cekilir.
  const [satir, setSatir] = useState<string | null>(null)
  const [gunler, setGunler] = useState<GunSatiri[] | null>(null)
  const [gunDurumu, setGunDurumu] = useState<'yok' | 'yukleniyor' | 'hazir' | 'hata'>('yok')
  const [, gunBasla] = useTransition()
  function gunleriSifirla() { setSatir(null); setGunler(null); setGunDurumu('yok') }
  function ayDegistir(donem: string | null) {
    setSeyirAy((a) => (a === donem ? null : donem))
    gunleriSifirla()
  }
  useEffect(() => {
    if (!secili) return
    // Escape icten disa kapatir: gun > ay > kirilim.
    const kacis = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (satir) gunleriSifirla()
      else if (seyirAy) { setSeyirAy(null); gunleriSifirla() }
      else setSecili(null)
    }
    document.addEventListener('keydown', kacis)
    return () => document.removeEventListener('keydown', kacis)
  }, [secili, seyirAy, satir])
  const hesap = useMemo(
    () => dilimleriHesapla(kayitlar, yon, seciliAy, aralik),
    [kayitlar, yon, seciliAy, aralik],
  )
  // Diger'in icinden secilen kategori pastada dilim degildir ama kendi rengini
  // alir: kimlik rengi listede de ayni kalsin.
  const adlar = useMemo(() => {
    const dilimAdlari = hesap.dilimler.filter((d) => d.ad !== DIGER).map((d) => d.ad)
    return secili && secili !== DIGER && !dilimAdlari.includes(secili)
      ? [...dilimAdlari, secili]
      : dilimAdlari
  }, [hesap.dilimler, secili])
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
        satirlar: katlananlar.map((d) => ({ ...d, ham: d.ad })),
        payda: toplam,
        seyirAdlari: katlananlar.map((d) => d.ad),
        kategoriSatiri: true,
        dilimDisi: false,
      }
    }
    const satirlar = altKirilim(altKategoriler, yon, secili, aylar)
    // Diger'in icinden secilen kategori dilim listesinde yok: toplami pencereden hesaplanir.
    const dilim = dilimler.find((d) => d.ad === secili)
    const pencere = new Set(aylar)
    const kategoriToplami = dilim
      ? dilim.toplam
      : kayitlar
          .filter((k) => k.yon === yon && k.kategori === secili && pencere.has(k.donem))
          .reduce((t, k) => t + Number(k.toplam), 0)
    return {
      baslik: `${secili} · alt kategoriler`,
      satirlar,
      payda: kategoriToplami,
      seyirAdlari: [secili],
      kategoriSatiri: false,
      dilimDisi: !dilim,
    }
  }, [secili, katlananlar, toplam, altKategoriler, yon, aylar, dilimler, kayitlar])
  // Seyir pasta penceresinden bagimsizdir: her zaman secili ayda biten 12 ay.
  const seyir = useMemo(
    () => (kirilim ? aylikSeyir(kayitlar, yon, kirilim.seyirAdlari, seciliAy) : []),
    [kirilim, kayitlar, yon, seciliAy],
  )
  function satirSec(r: DetaySatir) {
    // Kategori satiri (Diger icindekiler): ayni senaryoyu o kategori icin kur.
    if (kirilim?.kategoriSatiri) { sec(r.ad); return }
    if (satir === r.ad) { gunleriSifirla(); return }
    if (!secili || !seyirAy) return
    setSatir(r.ad)
    setGunler(null)
    setGunDurumu('yukleniyor')
    const istek = { yon, kategori: secili, alt: r.ham, ay: seyirAy }
    gunBasla(async () => {
      const sonuc = await gunlukKirilim(istek)
      if (sonuc.hata) { setGunDurumu('hata'); return }
      setGunler(sonuc.satirlar)
      setGunDurumu('hazir')
    })
  }

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
              {kirilim.dilimDisi && (
                <>
                  <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--ink-muted)' }}>· Diğer içinden</span>
                  <button
                    type="button"
                    onClick={() => sec(DIGER)}
                    className="ml-2 text-[11px] font-medium"
                    style={{ color: 'var(--seri-1)' }}
                  >
                    ← Diğer&apos;e dön
                  </button>
                </>
              )}
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
                const satirIcerigi = (
                  <>
                    <span className="truncate">
                      {kirilim.kategoriSatiri && <span aria-hidden style={{ color: 'var(--ink-muted)' }}>▸ </span>}
                      {r.ad}
                    </span>
                    {/* Tek renk, buyukluk: secili kategorinin rengiyle ince cubuk */}
                    <span className="hidden h-2 overflow-hidden rounded-full sm:block" style={{ background: 'var(--grid)' }} aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (r.toplam / enBuyuk) * 100)}%`, background: renk(secili!) }} />
                    </span>
                    <span className="rakam text-right font-medium">{tl(r.toplam)}</span>
                    <span className="rakam w-12 text-right" style={{ color: 'var(--ink-muted)' }}>
                      {kirilim.payda > 0 ? yuzde(r.toplam / kirilim.payda) : '—'}
                    </span>
                  </>
                )
                const duzen = 'grid grid-cols-[minmax(90px,1fr)_auto_auto] items-center gap-x-3 py-1 text-[12px] sm:grid-cols-[minmax(120px,1fr)_minmax(80px,2fr)_auto_auto]'
                return (
                  <li key={r.ad}>
                    {/* Diger'in icindeki satirlar KATEGORI: tiklaninca ayni senaryo
                        (12 aylik seyir > ay > gun) o kategori icin kurulur. */}
                    {kirilim.kategoriSatiri ? (
                      <button
                        type="button"
                        onClick={() => sec(r.ad)}
                        className={`${duzen} w-full rounded-md px-1 text-left hover:bg-[var(--surface)]`}
                      >
                        {satirIcerigi}
                      </button>
                    ) : (
                      <div className={`${duzen} px-1`}>{satirIcerigi}</div>
                    )}
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
            seciliSatir={satir}
            satirSec={satirSec}
            kategoriSatiri={kirilim.kategoriSatiri}
            gunler={gunler}
            gunDurumu={gunDurumu}
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
