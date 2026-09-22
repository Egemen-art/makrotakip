'use client'

import { useMemo, useState } from 'react'
import {
  Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type {
  Para, PortfoyOlcumPerformans, PortfoyPerformans, VarlikDeger, VarlikOlcumPerformans, VarlikPerformans,
} from '@/lib/tipler-varlik'
import { GRUP_ETIKETI, SINIF_ETIKETI, SINIF_GRUBU } from '@/lib/tipler-varlik'
import { tarihKisa, tl, usd, yuzde } from '@/lib/bicim'
import { BIRIM_ADI, birimAnlamli, birimFiyat, birimMetni } from '@/lib/birim'
import { donemBasligi, donemGetirisi, donemZinciri, type Donem } from '@/lib/donem'
import { gunlukZincir, olcumZinciri, type ZincirSatiri } from '@/lib/zincir'
import { deflatorKur, donemEnflasyonu, reelZincir, SERI_ETIKETI, type EnflasyonSatiri, type EnflasyonSerisi } from '@/lib/enflasyon'
import { EKSEN_STILI, SERI_RENKLERI } from './grafik/ortak'
import GunIci from './GunIci'

/**
 * Portfoy dagilimi (pasta) + SENIN performansin (TWR).
 * Pasta gruplara gore; dilime tiklayinca o grubun kalemleri, kaleme
 * tiklayinca o kalemin getirisi. Alttaki cizgi NE SECILIYSE onun secili
 * donemdeki getirisi: toplam portfoy, bir grup (kalemleri toplanip zincir
 * kurulur, lib/zincir) ya da tek kalem. Gun gorunumunde cizgi yerine o
 * gunun olcumleri — o da secime gore suzulur.
 */

// Renk KIMLIGE bagli: grup sirasi sabit, ekranda hangi gruplar varsa olsun.
const GRUP_SIRASI = ['hisse', 'fon', 'altin', 'bes', 'nakit', 'mevduat', 'diger']
const grupRengi = (g: string) => SERI_RENKLERI[Math.max(0, GRUP_SIRASI.indexOf(g)) % SERI_RENKLERI.length]

/** Isaretli tutar: kazanc +, kayip −. */
const tutarMetni = (n: number, bicim: (x: number) => string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${bicim(Math.abs(n))}`

const yuzdeMetni = (v: string | null | undefined) => {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  return `${n > 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} %`
}

export default function PortfoyPerformansGorunumu({
  degerler, toplam, kalemler, donem, gunIci, para = 'TRY', usdtry = null, reel = false, abdSeri = 'cpi', enflasyon = [],
}: {
  degerler: VarlikDeger[]
  toplam: PortfoyPerformans[]
  kalemler: VarlikPerformans[]
  donem: Donem
  /** Gun gorunumunde: secili gunun olcumleri (olcumden olcume zincir). */
  gunIci?: { toplam: PortfoyOlcumPerformans[]; kalemler: VarlikOlcumPerformans[] }
  para?: Para
  /** Gunun kuru: bugunku dagilim bununla cevrilir. Performans zinciri her gunun kendi kuruyla gelir. */
  usdtry?: number | null
  /** Reel gorunum (karar 53): zincir fiyat endeksine bolunur. */
  reel?: boolean
  abdSeri?: Exclude<EnflasyonSerisi, 'tufe'>
  enflasyon?: EnflasyonSatiri[]
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

  const gunlukR = (k: { gun_yuzde: string | null; gun_yuzde_usd: string | null }) =>
    Number((dolar ? k.gun_yuzde_usd : k.gun_yuzde) ?? 0)
  const gunlukDeger = (k: { deger_tl: string | null; deger_usd: string | null }) =>
    Number((dolar ? k.deger_usd : k.deger_tl) ?? 0)

  // Reel gorunum: secili para biriminin serisi (₺ -> TUFE, $ -> CPI/PCE).
  const enfSeri: EnflasyonSerisi = dolar ? abdSeri : 'tufe'
  const deflator = useMemo(() => (reel ? deflatorKur(enflasyon, enfSeri) : null), [reel, enflasyon, enfSeri])
  const reelAktif = reel && deflator !== null

  // Tek yol: nominal gunluk zincir kur, reel istendiyse endekse bol, sonra donem kesiti.
  // Gecici bayragi: zincirin herhangi bir gunu henuz aciklanmamis aya dusuyorsa.
  const kesit = (satirlar: ZincirSatiri[]) => {
    const z = reelAktif ? reelZincir(satirlar, deflator!) : { satirlar, gecici: false, eksik: false }
    const zincir = donemZinciri(z.satirlar, donem, (x) => x.r, (x) => x.deger, (x) => x.akis)
    // Reel gorunumde nominal kesit de tutulur: "nominal · enflasyon · reel" satiri icin.
    // Parasal kazanc her iki kesitte de ayni (nominal), cunku deger ve akis degismiyor.
    const nominal = reelAktif ? donemZinciri(satirlar, donem, (x) => x.r, (x) => x.deger, (x) => x.akis) : zincir
    return { zincir, nominal, gecici: z.gecici, eksik: z.eksik }
  }
  const toplamZinciri = (): ZincirSatiri[] =>
    [...toplam].sort((a, b) => a.tarih.localeCompare(b.tarih))
      .map((t) => ({ tarih: t.tarih, r: gunlukR(t), deger: gunlukDeger(t), akis: Number((dolar ? t.akis_usd : t.akis_tl) ?? 0) }))

  // Kalem bazinda DONEM getirisi — listede yanina yazilir; null = donemde olcum yok.
  const donemGetirileri = useMemo(() => {
    const m = new Map<number, number | null>()
    const gruplu = new Map<number, VarlikPerformans[]>()
    for (const k of kalemler) gruplu.set(k.varlik_id, [...(gruplu.get(k.varlik_id) ?? []), k])
    for (const [id, satirlar] of gruplu) m.set(id, donemGetirisi(kesit(gunlukZincir(satirlar, dolar)).zincir))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalemler, donem, dolar, reelAktif, deflator])

  // Grup bazinda DONEM getirisi: kalemlerin degeri ve akisi gun gun toplanip
  // ayni TWR formulu uygulanir (lib/zincir) — grup zinciri veritabaninda yok.
  const grupGetirileri = useMemo(() => {
    const gruplu = new Map<string, VarlikPerformans[]>()
    for (const k of kalemler) {
      const g = SINIF_GRUBU[k.sinif] ?? 'diger'
      gruplu.set(g, [...(gruplu.get(g) ?? []), k])
    }
    const m = new Map<string, number | null>()
    for (const [g, satirlar] of gruplu) m.set(g, donemGetirisi(kesit(gunlukZincir(satirlar, dolar)).zincir))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalemler, donem, dolar, reelAktif, deflator])

  function grupSec(ad: string | undefined) {
    if (!ad) return
    setGrup((g) => (g === ad ? null : ad))
    setVarlikId(null)
  }

  // Cizgi: ne secildiyse onun donem kesiti — kalem, grup ya da toplam portfoy.
  const { zincir: seri, nominal: nominalSeri, gecici: seriGecici } = useMemo(() => {
    if (varlikId === null && grup === null) return kesit(toplamZinciri())
    const uyeler = kalemler.filter((k) =>
      varlikId !== null ? k.varlik_id === varlikId : (SINIF_GRUBU[k.sinif] ?? 'diger') === grup)
    return kesit(gunlukZincir(uyeler, dolar))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varlikId, grup, kalemler, toplam, donem, dolar, reelAktif, deflator])

  // Gun gorunumu de secime uyar: o gunun olcumleri secilen kalem/grup icin.
  const gunIciSecili = useMemo(() => {
    if (!gunIci) return undefined
    if (varlikId === null && grup === null) return gunIci
    const uyeler = gunIci.kalemler.filter((k) =>
      varlikId !== null ? k.varlik_id === varlikId : (SINIF_GRUBU[k.sinif] ?? 'diger') === grup)
    return { toplam: olcumZinciri(uyeler), kalemler: uyeler }
  }, [gunIci, varlikId, grup])
  // Secili KALEMIN birim fiyati: tarih -> kendi kotasyon para birimindeki fiyat.
  // Grup ya da toplam secildiyse birim fiyat tanimsiz (farkli kalemler, farkli birim).
  const birimler = useMemo(() => {
    if (varlikId === null) return null
    const v = degerler.find((d) => d.varlik_id === varlikId)
    if (!v || !birimAnlamli(v.miktar)) return null
    const m = new Map<string, number>()
    for (const k of kalemler) {
      if (k.varlik_id !== varlikId) continue
      const f = birimFiyat(k, v.fiyat_para)
      if (f !== null) m.set(k.tarih, f)
    }
    return m.size === 0 ? null : { harita: m, para: v.fiyat_para, sinif: v.sinif }
  }, [varlikId, degerler, kalemler])

  const son = seri.at(-1)
  const donemAdi = donemBasligi(donem)
  // Donemdeki enflasyon: kesitin ilk ve son gunu arasinda endeks degisimi.
  const donemEnf = reelAktif && seri.length >= 2 ? donemEnflasyonu(deflator!, seri[0].tarih, seri[seri.length - 1].tarih) : null
  const nominalSon = nominalSeri.at(-1)
  const seciliVarlik = varlikId === null ? null : degerler.find((d) => d.varlik_id === varlikId) ?? null
  const seciliGrup = grup ? gruplar.find((g) => g.ad === grup) ?? null : null
  const seciliGrupAdi = seciliVarlik
    ? SINIF_GRUBU[seciliVarlik.sinif] ?? 'diger'
    : seciliGrup?.ad ?? null
  const cizgiRengi = seciliGrupAdi ? grupRengi(seciliGrupAdi) : 'var(--seri-1)'
  // Baslikta ve gun ici gorunumunde kullanilan anlik birim fiyat metni.
  const anlikBirim = seciliVarlik && birimAnlamli(seciliVarlik.miktar) && seciliVarlik.birim_fiyat !== null
    ? birimMetni(Number(seciliVarlik.birim_fiyat), seciliVarlik.fiyat_para, seciliVarlik.sinif)
    : null
  const secimAdi = seciliVarlik
    ? seciliVarlik.kod
    : seciliGrup
      ? GRUP_ETIKETI[seciliGrup.ad] ?? seciliGrup.ad
      : null

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Dağılım ve performans</h2>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Getiri para akışlarından arındırılmış; eklediğin para kazanç, çektiğin kayıp sayılmaz.
          {dolar && ' Dolar zinciri her günü kendi kuruyla çevirir.'}
          {reelAktif && ` Reel: ${SERI_ETIKETI[enfSeri]} ile deflate edilmiş${deflator!.sonAy ? `, son veri ${deflator!.sonAy}` : ''}.`}
          {reel && !reelAktif && <span style={{ color: 'var(--ciddi)' }}> Reel istendi ama {SERI_ETIKETI[enfSeri]} verisi yok; nominal gösteriliyor.</span>}
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
                    {(() => {
                      const gr = grupGetirileri.get(g.ad) ?? null
                      return (
                        <span
                          className="rakam w-20 shrink-0 text-right text-[11px]"
                          title={`Grubun getirisi, ${donemAdi} (para akışlarından arındırılmış)`}
                          style={{ color: gr === null ? 'var(--ink-muted)' : gr > 0 ? 'var(--artis-iyi)' : gr < 0 ? 'var(--kritik)' : 'var(--ink-muted)' }}
                        >
                          {gr === null ? 'ölçüm yok' : yuzdeMetni(String(gr))}
                        </span>
                      )
                    })()}
                  </button>

                  {/* Dilim secildi: grubun kalemleri, her birinin kendi getirisiyle */}
                  {bu && (
                    <ul className="mb-1 ml-2 border-l pl-2" style={{ borderColor: 'var(--hair)' }}>
                      {g.uyeler.map((u) => {
                        const secili = varlikId === u.varlik_id
                        const k = donemGetirileri.get(u.varlik_id) ?? null
                        const uDeger = cevir(Number(u.deger_tl))
                        // Anlik birim fiyat: kalemin KENDI kotasyon para biriminde
                        // (ekranin ₺/$ secimi degeri cevirir, kotasyonu degil).
                        const uBirim = birimAnlamli(u.miktar) && u.birim_fiyat !== null
                          ? birimMetni(Number(u.birim_fiyat), u.fiyat_para, u.sinif)
                          : null
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
                                {uBirim && (
                                  <span
                                    className="rakam ml-1.5 text-[11px]"
                                    style={{ color: 'var(--ink-muted)' }}
                                    title={`Anlık birim fiyat · ${Number(u.miktar).toLocaleString('tr-TR', { maximumFractionDigits: 6 })} ${BIRIM_ADI[u.sinif]}${u.fiyat_tarihi ? ` · ${tarihKisa(u.fiyat_tarihi)}` : ''}${u.fiyat_kaynagi ? ` · ${u.fiyat_kaynagi}` : ''}`}
                                  >
                                    {uBirim}
                                  </span>
                                )}
                              </span>
                              <span className="rakam ml-auto shrink-0">{bicim(uDeger)}</span>
                              <span className="rakam w-12 shrink-0 text-right text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                                {toplamDeger > 0 ? yuzde(uDeger / toplamDeger) : '—'}
                              </span>
                              <span
                                className="rakam w-20 shrink-0 text-right text-[11px]"
                                title={`Getiri, ${donemAdi} (para akışlarından arındırılmış)`}
                                style={{ color: k === null ? 'var(--ink-muted)' : k > 0 ? 'var(--artis-iyi)' : k < 0 ? 'var(--kritik)' : 'var(--ink-muted)' }}
                              >
                                {k === null ? 'ölçüm yok' : `getiri ${yuzdeMetni(String(k))}`}
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

      {/* ── Performans: gun gorunumunde gun ici olcumler, digerinde donem cizgisi ── */}
      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--hair)' }}>
        {donem.kod === 'gun' && gunIciSecili ? (
          <>
            {reelAktif && <p className="mb-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>Gün içi ölçümler nominaldir; gün içinde enflasyon ihmal edilir.</p>}
            <GunIci
              gun={donem.gun} toplam={gunIciSecili.toplam} kalemler={gunIciSecili.kalemler}
              para={para} secimAdi={secimAdi}
              birim={seciliVarlik && birimAnlamli(seciliVarlik.miktar)
                ? { varlikId: seciliVarlik.varlik_id, para: seciliVarlik.fiyat_para, sinif: seciliVarlik.sinif }
                : undefined}
            />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: cizgiRengi }} />
                {secimAdi ? `${secimAdi} · getiri` : 'Toplam portföy · getiri'}
                <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  {donemAdi} · {dolar ? '$ bazında' : '₺ bazında'}{reelAktif ? ` · reel (${SERI_ETIKETI[enfSeri]})` : ''}
                </span>
                {reelAktif && seriGecici && (
                  <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ciddi)' }} title={`Son açıklanan ay ${deflator!.sonAy}; sonrası son 3 ayın ortalamasıyla (aylık ${deflator!.geciciAylik.toFixed(2)} %) geçici`}>
                    geçici
                  </span>
                )}
                {anlikBirim && (
                  <span className="rakam ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }} title="Kalemin anlık birim fiyatı">
                    birim {anlikBirim}
                  </span>
                )}
                {seri.length > 0 && (
                  <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    {tarihKisa(seri[0].tarih)} → {tarihKisa(seri[seri.length - 1].tarih)} · {seri.length} ölçüm
                  </span>
                )}
              </p>
              {son && seri.length >= 2 && (
                <span className="text-right">
                  <span
                    className="rakam block text-[17px] font-semibold leading-tight"
                    style={{ color: son.yuzde > 0 ? 'var(--artis-iyi)' : son.yuzde < 0 ? 'var(--kritik)' : 'var(--ink)' }}
                  >
                    {yuzdeMetni(String(son.yuzde))}
                  </span>
                  <span
                    className="rakam block text-[12px]"
                    title="Dönemin parasal karşılığı: değer farkından para akışları düşülmüş"
                    style={{ color: son.kazanc > 0 ? 'var(--artis-iyi)' : son.kazanc < 0 ? 'var(--kritik)' : 'var(--ink-muted)' }}
                  >
                    {tutarMetni(son.kazanc, bicim)}
                  </span>
                </span>
              )}
            </div>

            {reelAktif && seri.length >= 2 && nominalSon && donemEnf && (
              <p className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px]" style={{ color: 'var(--ink-2)' }}>
                <span>Nominal <span className="rakam font-medium" style={{ color: nominalSon.yuzde > 0 ? 'var(--artis-iyi)' : nominalSon.yuzde < 0 ? 'var(--kritik)' : 'var(--ink)' }}>{yuzdeMetni(String(nominalSon.yuzde))}</span>
                  <span className="rakam ml-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>({tutarMetni(nominalSon.kazanc, bicim)})</span>
                </span>
                <span>Enflasyon <span className="rakam font-medium">{yuzdeMetni(String(donemEnf.yuzde))}</span>
                  <span className="ml-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>({SERI_ETIKETI[enfSeri]}, {tarihKisa(seri[0].tarih)} → {tarihKisa(seri[seri.length - 1].tarih)}{donemEnf.gecici ? ', geçici' : ''})</span>
                </span>
                <span>Reel <span className="rakam font-medium" style={{ color: son!.yuzde > 0 ? 'var(--artis-iyi)' : son!.yuzde < 0 ? 'var(--kritik)' : 'var(--ink)' }}>{yuzdeMetni(String(son!.yuzde))}</span>
                  <span className="ml-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>= (1 + nominal) / (1 + enflasyon) − 1</span>
                </span>
              </p>
            )}

            {seri.length < 2 ? (
              <p className="py-6 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                {seri.length === 0
                  ? 'Bu aralıkta ölçüm yok.'
                  : `Bu aralıkta tek ölçüm var (${tarihKisa(seri[0].tarih)}); getiri bir sonraki günün ölçümüyle başlar.`}
              </p>
            ) : (
              <div className="mt-2 h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={seri} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="tarih" tickFormatter={(t) => tarihKisa(t).replace(/ \d{4}$/, '')} tick={EKSEN_STILI} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
                    <YAxis tickFormatter={(v) => `${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} %`} tick={EKSEN_STILI} tickLine={false} axisLine={false} width={62} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as { yuzde: number; deger: number; kazanc: number }
                        // Tek kalem secildiyse o gunun birim fiyati da yazilir.
                        const b = birimler?.harita.get(String(label)) ?? null
                        return (
                          <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)' }}>
                            <div className="font-medium">{tarihKisa(String(label))}</div>
                            <div className="rakam">
                              {yuzdeMetni(String(p.yuzde))}
                              <span style={{ color: p.kazanc > 0 ? 'var(--artis-iyi)' : p.kazanc < 0 ? 'var(--kritik)' : 'var(--ink-muted)' }}> · {tutarMetni(p.kazanc, bicim)}</span>
                            </div>
                            <div className="rakam text-[11px]" style={{ color: 'var(--ink-muted)' }}>değer {bicim(p.deger)}</div>
                            {birimler && b !== null && (
                              <div className="rakam text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                                birim {birimMetni(b, birimler.para, birimler.sinif)}
                              </div>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Line type="monotone" dataKey="yuzde" stroke={cizgiRengi} strokeWidth={2} dot={seri.length < 20} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
