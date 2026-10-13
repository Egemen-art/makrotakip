'use client'

import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import type { KategoriSerisi } from '@/lib/tipler'
import { donemEtiket, tl, tlKurus, trSirala } from '@/lib/bicim'
import { NOTR_RENK, SERI_RENKLERI, SecimGrubu, yuvaAta, type YuvaKaydi } from './ortak'

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

type Aralik = '1' | '6' | '12'
const ARALIKLAR: { deger: Aralik; ad: string }[] = [
  { deger: '1', ad: 'Aylık' },
  { deger: '6', ad: '6 aylık' },
  { deger: '12', ad: '1 yıllık' },
]
const EN_FAZLA_GIDER = 7
const EN_FAZLA_GELIR = 3
const DIGER = 'Diğer'
const KALAN = 'Kalan'
const ACIK = 'Açık (birikimden)'
const BUTCE = 'Bütçe'
const NOTR = 'var(--axis)'

type Dugum = { name: string; renk: string; tur: 'gelir' | 'butce' | 'gider' | 'kalan' | 'acik' | 'diger' }

function hesapla(kayitlar: KategoriSerisi[], seciliAy: string, aralik: Aralik) {
  const aylar = [...new Set(kayitlar.filter((k) => k.donem <= seciliAy).map((k) => k.donem))].sort().slice(-Number(aralik))
  const pencere = new Set(aylar)
  const topla = (yon: 'Gelir' | 'Gider') => {
    const m = new Map<string, number>()
    for (const k of kayitlar) {
      if (k.yon !== yon || !pencere.has(k.donem)) continue
      m.set(k.kategori, (m.get(k.kategori) ?? 0) + Number(k.toplam))
    }
    return [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || trSirala(a[0], b[0]))
  }
  const katla = (s: [string, number][], n: number, digerAdi: string) =>
    s.length > n + 1 ? [...s.slice(0, n), [digerAdi, s.slice(n).reduce((t, [, v]) => t + v, 0)] as [string, number]] : s
  const gelir = katla(topla('Gelir'), EN_FAZLA_GELIR, 'Diğer gelir')
  const giderTum = topla('Gider')
  const gider = katla(giderTum, EN_FAZLA_GIDER, DIGER)
  const G = gelir.reduce((t, [, v]) => t + v, 0)
  const H = gider.reduce((t, [, v]) => t + v, 0)
  return { aylar, gelir, gider, G, H, katlanan: Math.max(0, giderTum.length - EN_FAZLA_GIDER) }
}

export default function KategoriAkis({
  kayitlar, seciliAy, kayit,
}: {
  kayitlar: KategoriSerisi[]
  seciliAy: string
  kayit: YuvaKaydi
}) {
  const [aralik, setAralik] = useState<Aralik>('1')
  // Dar ekranda (telefon) etiketler kisalir, kenar boslugu daralir.
  const [dar, setDar] = useState(false)
  useEffect(() => {
    const olc = () => setDar(window.innerWidth < 640)
    olc()
    window.addEventListener('resize', olc)
    return () => window.removeEventListener('resize', olc)
  }, [])
  const h = useMemo(() => hesapla(kayitlar, seciliAy, aralik), [kayitlar, seciliAy, aralik])

  // Renk kimligi pastayla ortak: gider kategorileri yuva kaydindan.
  const adlar = useMemo(() => h.gider.map(([ad]) => ad).filter((ad) => ad !== DIGER), [h.gider])
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

  const oran = h.G > 0 ? (h.H / h.G) * 100 : null
  const ilk = h.aylar[0], son = h.aylar.at(-1)
  const pencereEtiketi = !ilk ? '—' : ilk === son ? donemEtiket(ilk) : `${donemEtiket(ilk)} – ${donemEtiket(son!)} · ${h.aylar.length} ay`
  const sagDugum = veri.nodes.filter((d) => d.tur !== 'gelir' && d.tur !== 'acik' && d.tur !== 'butce').length
  const yukseklik = Math.max(300, sagDugum * 44 + 40)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SecimGrubu secenekler={ARALIKLAR} deger={aralik} degistir={setAralik} etiket="Pencere" />
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
              harcandı · <span className="rakam">{tl(h.H)}</span> gider / <span className="rakam">{tl(h.G)}</span> gelir
            </span>
            <span className="rakam text-[12px]" style={{ color: h.G >= h.H ? 'var(--artis-iyi)' : 'var(--kritik)' }}>
              {h.G >= h.H ? `${tl(h.G - h.H)} kaldı` : `${tl(h.H - h.G)} açık`}
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
                node={(p) => <AkisDugumu {...p} dugum={veri.nodes[p.index]} butce={Math.max(h.G, h.H)} dar={dar} />}
                link={(p) => <AkisBagi {...p} {...bagRengi(p.payload as unknown as { source: Partial<Dugum>; target: Partial<Dugum> })} />}
              >
                <Tooltip content={<AkisIpucu toplam={Math.max(h.G, h.H)} gelir={h.G} />} />
              </Sankey>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            {dar ? 'Bütçeden gider kategorilerine' : 'Sol: gelir kaynakları · orta: bütçe · sağ: gider kategorileri'}
            {h.katlanan > 0 && ` · "${DIGER}" ${h.katlanan + 1} kategoriyi topluyor`}
            {' '}· Aktarımlar (yatırıma giden para) gider sayılmaz, burada yok.
          </p>
        </>
      )}
    </div>
  )
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
  x, y, width, height, dugum, payload, butce, dar,
}: {
  x: number; y: number; width: number; height: number
  dugum?: Dugum
  payload: { name: string; value: number; depth: number }
  butce: number
  dar: boolean
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
      <rect x={x} y={y} width={width} height={Math.max(height, 2)} rx={3} fill={dugum.renk} />
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
