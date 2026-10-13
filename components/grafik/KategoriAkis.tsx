'use client'

import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import type { AylikKategori, KategoriSerisi, Yon } from '@/lib/tipler'
import { donemEtiket, tl, tlKurus, trSirala } from '@/lib/bicim'
import {
  AnahtarDugmesi, NOTR_RENK, PENCERELER, SERI_RENKLERI, SecimGrubu, yuvaAta, type Pencere, type YuvaKaydi,
} from './ortak'
import { KategoriDetayi } from './KategoriPasta'
import { CikanlarNotu, duzensizleriCikar } from './duzenli'

/**
 * AKIS (Sankey) — gelir nereden geldi, nereye gitti. Pasta "giderin icinde
 * kim ne kadar" der; akis bunu gelire baglar: sol gelir kaynaklari, orta
 * butce, sag gider kategorileri. Gelir giderden fazlaysa fark "Kalan" kolu,
 * azsa "Açık" kolu olur — iki taraf daima dengede, hicbir lira kaybolmaz.
 *
 * Ust grup (zorunlu / esnek gibi) UYDURULMAZ: taksonomide boyle bir alan
 * yok; kategoriler defterdeki haliyle gelir. Renkler pastayla ayni kimlik
 * kaydindan (ayni kategori ayni renk). Aktarim (Transfer) burada yoktur:
 * kategori serisi yalniz Gider ve Gelir tasir.
 */

const EN_FAZLA_GIDER = 7
const EN_FAZLA_GELIR = 3
const DIGER = 'Diğer'
const DIGER_GELIR = 'Diğer gelir'
const KALAN = 'Kalan'
const ACIK = 'Açık (birikimden)'
const BUTCE = 'Bütçe'
const NOTR = 'var(--axis)'

type Dugum = { name: string; renk: string; tur: 'gelir' | 'butce' | 'gider' | 'kalan' | 'acik' | 'diger' }

const pencereAylari = (kayitlar: KategoriSerisi[], seciliAy: string, aralik: Pencere) =>
  [...new Set(kayitlar.filter((k) => k.donem <= seciliAy).map((k) => k.donem))].sort().slice(-Number(aralik))

/** aylar: pencere (pencereAylari); duzensizler cikarilsa da pencere kaymasin diye disaridan. */
function hesapla(kayitlar: KategoriSerisi[], aylar: string[], ortalama = false) {
  const pencere = new Set(aylar)
  // Ortalama: her tutar pencere ay sayisina bolunur — "ortalama bir ay".
  const bolen = ortalama ? Math.max(1, aylar.length) : 1
  const topla = (yon: 'Gelir' | 'Gider') => {
    const m = new Map<string, number>()
    for (const k of kayitlar) {
      if (k.yon !== yon || !pencere.has(k.donem)) continue
      m.set(k.kategori, (m.get(k.kategori) ?? 0) + Number(k.toplam) / bolen)
    }
    return [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || trSirala(a[0], b[0]))
  }
  const katla = (s: [string, number][], n: number, digerAdi: string) =>
    s.length > n + 1 ? [...s.slice(0, n), [digerAdi, s.slice(n).reduce((t, [, v]) => t + v, 0)] as [string, number]] : s
  const gelirTum = topla('Gelir')
  const gelir = katla(gelirTum, EN_FAZLA_GELIR, DIGER_GELIR)
  const giderTum = topla('Gider')
  const gider = katla(giderTum, EN_FAZLA_GIDER, DIGER)
  const G = gelir.reduce((t, [, v]) => t + v, 0)
  const H = gider.reduce((t, [, v]) => t + v, 0)
  // Detay paneli icin: katlanan kategoriler ("Diger" tiklaninca listelenir).
  const katlananGider = giderTum.length > EN_FAZLA_GIDER + 1 ? giderTum.slice(EN_FAZLA_GIDER) : []
  const katlananGelir = gelirTum.length > EN_FAZLA_GELIR + 1 ? gelirTum.slice(EN_FAZLA_GELIR) : []
  const nesne = (x: [string, number][]) => x.map(([ad, toplam]) => ({ ad, toplam }))
  return {
    aylar, gelir, gider, G, H, katlanan: katlananGider.length, bolen,
    detay: {
      Gider: { dilimler: nesne(gider), katlananlar: nesne(katlananGider), toplam: H, digerAdi: DIGER },
      Gelir: { dilimler: nesne(gelir), katlananlar: nesne(katlananGelir), toplam: G, digerAdi: DIGER_GELIR },
    },
  }
}

export default function KategoriAkis({
  kayitlar, seciliAy, kayit, altKategoriler,
}: {
  kayitlar: KategoriSerisi[]
  seciliAy: string
  kayit: YuvaKaydi
  /** v_aylik_kategori — kola tiklayinca alt kategori kirilimi buradan. */
  altKategoriler: AylikKategori[]
}) {
  const [aralik, setAralik] = useState<Pencere>('1')
  const [ortalama, setOrtalama] = useState(false)
  // Ortalamanin alt secenegi: her ay tekrarlanmayan gider ve gelirler (duzenli.tsx) cikar.
  const [duzenliIstek, setDuzenli] = useState(false)
  const duzenli = duzenliIstek && ortalama
  // Tiklanan kol/kategori: altta pastadaki ayni detay paneli acilir.
  const [secim, setSecim] = useState<{ ad: string; yon: Yon } | null>(null)
  function aralikDegistir(a: Pencere) {
    setAralik(a); setSecim(null)
    if (a === '1') { setOrtalama(false); setDuzenli(false) }
  }
  // Tek ayin ortalamasi kendisidir: Aylik'tayken ortalama acilirsa pencere 1 yila genisler.
  function ortalamaDegistir() {
    if (!ortalama && aralik === '1') setAralik('12')
    if (ortalama) setDuzenli(false)
    setOrtalama(!ortalama)
    setSecim(null)
  }
  function duzenliDegistir() { setDuzenli(!duzenliIstek); setSecim(null) }
  function sec(ad: string, yon: Yon) {
    setSecim((s) => (s && s.ad === ad && s.yon === yon ? null : { ad, yon }))
  }
  // Dar ekranda (telefon) etiketler kisalir, kenar boslugu daralir.
  const [dar, setDar] = useState(false)
  useEffect(() => {
    const olc = () => setDar(window.innerWidth < 640)
    olc()
    window.addEventListener('resize', olc)
    return () => window.removeEventListener('resize', olc)
  }, [])
  const aylarPencere = useMemo(() => pencereAylari(kayitlar, seciliAy, aralik), [kayitlar, seciliAy, aralik])
  // Duzensizler cikinca akis, detay paneli ve seyir AYNI suzulmus veriyi okur.
  const suzulmus = useMemo(
    () => (duzenli ? duzensizleriCikar(kayitlar, altKategoriler, aylarPencere) : null),
    [duzenli, kayitlar, altKategoriler, aylarPencere],
  )
  const veriKayit = suzulmus?.kayitlar ?? kayitlar
  const veriAlt = suzulmus?.altKategoriler ?? altKategoriler
  const h = useMemo(() => hesapla(veriKayit, aylarPencere, ortalama), [veriKayit, aylarPencere, ortalama])

  // Renk kimligi pastayla ortak: gider kategorileri yuva kaydindan.
  const adlar = useMemo(() => {
    const a = h.gider.map(([ad]) => ad).filter((ad) => ad !== DIGER)
    // "Diger"in icinden secilen kategori de kendi kimlik rengini alsin.
    return secim && secim.yon === 'Gider' && secim.ad !== DIGER && !a.includes(secim.ad) ? [...a, secim.ad] : a
  }, [h.gider, secim])
  const yuvalar = useMemo(() => yuvaAta(kayit.yuvalar, adlar), [kayit.yuvalar, adlar])
  const { garanti } = kayit
  useEffect(() => { garanti(adlar) }, [garanti, adlar])

  const veri = useMemo(() => {
    const dugumler: Dugum[] = []
    const baglar: { source: number; target: number; value: number }[] = []
    const ekle = (d: Dugum) => dugumler.push(d) - 1
    // Dar ekranda gelir sutunu yok: gelir / gider / acik baslikta yazili, grafik butceden baslar.
    const kaynaklar = dar ? [] : h.gelir.map(([ad, v]) => ({ i: ekle({ name: ad, renk: NOTR, tur: 'gelir' }), v }))
    const acik = !dar && h.H > h.G ? ekle({ name: ACIK, renk: 'var(--kritik)', tur: 'acik' }) : -1
    const butce = ekle({ name: BUTCE, renk: 'var(--ink-2)', tur: 'butce' })
    for (const k of kaynaklar) baglar.push({ source: k.i, target: butce, value: k.v })
    if (acik >= 0) baglar.push({ source: acik, target: butce, value: h.H - h.G })
    for (const [ad, v] of h.gider) {
      const renk = ad === DIGER ? NOTR_RENK : SERI_RENKLERI[yuvalar[ad] ?? 0]
      const i = ekle({ name: ad, renk, tur: ad === DIGER ? 'diger' : 'gider' })
      baglar.push({ source: butce, target: i, value: v })
    }
    if (h.G > h.H) {
      const i = ekle({ name: KALAN, renk: 'var(--ink-muted)', tur: 'kalan' })
      baglar.push({ source: butce, target: i, value: h.G - h.H })
    }
    return { nodes: dugumler, links: baglar }
  }, [h, yuvalar, dar])

  const secili = (d?: Partial<Dugum>) => !!secim && !!d && d.name === secim.ad && tiklanabilir(d) === secim.yon
  const detay = secim ? h.detay[secim.yon] : null
  const detayRengi = (ad: string) => {
    if (!secim || secim.yon === 'Gelir') return 'var(--ink-2)'
    return ad === DIGER ? NOTR_RENK : SERI_RENKLERI[yuvalar[ad] ?? 0]
  }
  const oran = h.G > 0 ? (h.H / h.G) * 100 : null
  const ilk = h.aylar[0], son = h.aylar.at(-1)
  const pencereEtiketi = !ilk ? '—' : ilk === son ? donemEtiket(ilk) : `${donemEtiket(ilk)} – ${donemEtiket(son!)} · ${h.aylar.length} ay${ortalama ? ' · aylık ortalama' : ''}${duzenli ? ' · düzensizler hariç' : ''}`
  const sagDugum = veri.nodes.filter((d) => d.tur !== 'gelir' && d.tur !== 'acik' && d.tur !== 'butce').length
  const yukseklik = Math.max(300, sagDugum * 44 + 40)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <SecimGrubu secenekler={PENCERELER} deger={aralik} degistir={aralikDegistir} etiket="Pencere" />
          <AnahtarDugmesi acik={ortalama} degistir={ortalamaDegistir} ad="Ortalama" baslik="Seçili pencerenin aylık ortalaması" />
          {ortalama && (
            <AnahtarDugmesi
              acik={duzenli} degistir={duzenliDegistir} ad="Düzensizleri çıkar"
              baslik="Pencerenin ayların yarısı ya da daha azında görülen gider alt kategorileri (tek seferlik alımlar, seyahat…) ve gelir kategorileri (prim gibi) ortalamaya girmez"
            />
          )}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{pencereEtiketi}</span>
      </div>

      {h.G === 0 && h.H === 0 ? (
        <p className="py-16 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>Bu pencerede gelir ya da gider kaydı yok.</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="rakam text-[28px] font-semibold leading-none" style={{ color: oran !== null && oran > 100 ? 'var(--kritik)' : 'var(--ink)' }}>
              {oran === null ? '—' : `%${Math.round(oran)}`}
            </span>
            <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              harcandı · {ortalama && 'ayda ortalama '}<span className="rakam">{tl(h.H)}</span> gider / <span className="rakam">{tl(h.G)}</span> gelir
            </span>
            <span className="rakam text-[12px]" style={{ color: h.G >= h.H ? 'var(--artis-iyi)' : 'var(--kritik)' }}>
              {h.G >= h.H ? `${tl(h.G - h.H)} kaldı` : `${tl(h.H - h.G)} açık`}{ortalama && ' / ay'}
            </span>
          </div>

          <div className="w-full [&_*:focus:not(:focus-visible)]:outline-none" style={{ height: yukseklik }}>
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={veri}
                nodeWidth={10}
                nodePadding={16}
                linkCurvature={0.5}
                iterations={32}
                sort={false}
                margin={dar ? { top: 22, right: 150, bottom: 8, left: 4 } : { top: 22, right: 170, bottom: 8, left: 150 }}
                node={(p) => <AkisDugumu {...p} dugum={veri.nodes[p.index]} butce={Math.max(h.G, h.H)} dar={dar} soluk={!!secim && !secili(veri.nodes[p.index])} />}
                link={(p) => {
                  const b = p.payload as unknown as { source: Partial<Dugum>; target: Partial<Dugum> }
                  const r = bagRengi(b)
                  const ilgili = !secim || secili(b.source) || secili(b.target)
                  return <AkisBagi {...p} renk={r.renk} opaklik={ilgili ? r.opaklik : r.opaklik * 0.35} />
                }}
                onClick={(oge) => {
                  const pl = (oge as { payload?: Partial<Dugum> & { source?: Partial<Dugum>; target?: Partial<Dugum> } }).payload
                  if (!pl) return
                  // Kol tiklandiysa ucundaki kategori; dugum tiklandiysa kendisi.
                  const d = pl.source && pl.target ? (pl.target.tur === 'butce' ? pl.source : pl.target) : pl
                  const y = tiklanabilir(d)
                  if (y && d.name) sec(d.name, y)
                }}
                style={{ cursor: 'pointer' }}
              >
                <Tooltip content={<AkisIpucu toplam={Math.max(h.G, h.H)} gelir={h.G} />} />
              </Sankey>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            {dar ? 'Bütçeden gider kategorilerine' : 'Sol: gelir kaynakları · orta: bütçe · sağ: gider kategorileri'}
            {h.katlanan > 0 && ` · "${DIGER}" ${h.katlanan + 1} kategoriyi topluyor`}
            {' '}· Aktarımlar (yatırıma giden para) gider sayılmaz, burada yok.
            {!secim && ' · Bir kola ya da kategoriye tıkla, detayı altta açılsın.'}
          </p>
          {suzulmus && <CikanlarNotu cikanlar={suzulmus.cikanlar} ayAdedi={h.aylar.length} yonler={['Gelir', 'Gider']} />}

          {secim && detay && (
            <KategoriDetayi
              key={`${secim.yon}|${secim.ad}|${aralik}|${seciliAy}|${ortalama}|${duzenli}`}
              kayitlar={veriKayit} altKategoriler={veriAlt} yon={secim.yon} seciliAy={seciliAy}
              aylar={h.aylar} pencereEtiketi={pencereEtiketi}
              secili={secim.ad} digerAdi={detay.digerAdi} katlananlar={detay.katlananlar} dilimler={detay.dilimler} toplam={detay.toplam}
              renk={detayRengi} sec={(ad) => sec(ad, secim.yon)} kapat={() => setSecim(null)} bolen={h.bolen}
            />
          )}
        </>
      )}
    </div>
  )
}

/** Detay paneli acilabilen dugumler: gider (ve Diger) -> Gider, gelir -> Gelir. Butce/Kalan/Acik acilmaz. */
function tiklanabilir(d?: Partial<Dugum>): Yon | null {
  if (!d) return null
  if (d.tur === 'gider' || d.tur === 'diger') return 'Gider'
  if (d.tur === 'gelir') return 'Gelir'
  return null
}

/**
 * Bag rengi: butceye giren kollar kaynaginin (gelir notr, acik kritik), butceden
 * cikanlar hedefinin (kategori kimligi) rengini alir. Dugum nesneleri payload'da
 * kendi alanlariyla gelir; ad ile aranmaz — "Müzik" hem gelir hem gider olabilir.
 */
function bagRengi(p: { source: Partial<Dugum>; target: Partial<Dugum> }) {
  const girdi = p.target?.tur === 'butce'
  const renk = (girdi ? p.source?.renk : p.target?.renk) ?? NOTR
  // Notr gelir kollari genis ve cok; soluk kalir ki kategori kollari one ciksin.
  const opaklik = girdi && p.source?.tur !== 'acik' ? 0.2 : 0.32
  return { renk, opaklik }
}

function AkisDugumu({
  x, y, width, height, dugum, payload, butce, dar, soluk,
}: {
  x: number; y: number; width: number; height: number
  dugum?: Dugum
  payload: { name: string; value: number; depth: number }
  butce: number
  dar: boolean
  /** Baska bir kategori seciliyken bu dugum geri planda kalir. */
  soluk: boolean
}) {
  if (!dugum) return null
  const solda = dugum.tur === 'gelir' || dugum.tur === 'acik'
  const ortada = dugum.tur === 'butce'
  const sinir = dar ? 11 : 18
  const ad = payload.name.length > sinir ? `${payload.name.slice(0, sinir - 1)}…` : payload.name
  const pay = butce > 0 ? Math.round((payload.value / butce) * 100) : 0
  const yazi = dar ? 11 : 12
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 2)} rx={3} fill={dugum.renk} fillOpacity={soluk && dugum.tur !== 'butce' ? 0.35 : 1} />
      {ortada ? (
        <text x={dar ? x : x + width / 2} y={y - 6} textAnchor={dar ? 'start' : 'middle'} fontSize={11} fill="var(--ink-muted)">bütçe</text>
      ) : solda ? (
        // Sol sutun: etiket dugumun SOLUNDA, iki satir — kollarin ustune binmez.
        <text x={x - 8} y={y + height / 2} textAnchor="end" fontSize={yazi} fill="var(--ink)">
          <tspan x={x - 8} dy="-0.35em">{ad}</tspan>
          <tspan x={x - 8} dy="1.25em" fill="var(--ink-muted)" className="rakam">{tl(payload.value)}</tspan>
        </text>
      ) : (
        <text x={x + width + 8} y={y + height / 2} dominantBaseline="middle" fontSize={yazi} fill="var(--ink)">
          {ad}
          <tspan dx={6} fill="var(--ink-muted)" className="rakam">{tl(payload.value)}</tspan>
          {!dar && <tspan dx={4} fill="var(--ink-muted)" fontSize={11}>%{pay}</tspan>}
        </text>
      )}
    </g>
  )
}

function AkisBagi({
  sourceX, sourceY, targetX, targetY, sourceControlX, targetControlX, linkWidth, renk, opaklik,
}: {
  sourceX: number; sourceY: number; targetX: number; targetY: number
  sourceControlX: number; targetControlX: number; linkWidth: number
  renk: string; opaklik: number
}) {
  const [ust, setUst] = useState(false)
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={renk}
      strokeWidth={Math.max(linkWidth, 1)}
      strokeOpacity={ust ? Math.min(opaklik * 2, 0.7) : opaklik}
      onMouseEnter={() => setUst(true)}
      onMouseLeave={() => setUst(false)}
    />
  )
}

function AkisIpucu({
  active, payload, toplam, gelir,
}: {
  active?: boolean
  payload?: { payload?: { source?: { name: string }; target?: { name: string }; name?: string; value?: number; payload?: { source?: { name: string }; target?: { name: string }; value?: number } } }[]
  toplam: number
  gelir: number
}) {
  if (!active || !payload?.length) return null
  const ham = payload[0].payload
  const p = ham?.payload ?? ham
  if (!p) return null
  const deger = Number(p.value ?? 0)
  const baslik = p.source && p.target ? `${p.source.name} → ${p.target.name}` : (ham?.name ?? '')
  return (
    <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
      <div className="font-medium">{baslik}</div>
      <div className="rakam">{tlKurus(deger)}</div>
      <div className="rakam text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        {toplam > 0 && `bütçenin %${((deger / toplam) * 100).toFixed(1)}`}
        {gelir > 0 && ` · gelirin %${((deger / gelir) * 100).toFixed(1)}`}
      </div>
    </div>
  )
}
