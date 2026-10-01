'use client'

import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HareketKaydi, Para, VarlikKar, VarlikPerformans } from '@/lib/tipler-varlik'
import { SINIF_ETIKETI } from '@/lib/tipler-varlik'
import { tarihKisa, tl, tlKurus, usd, usdKurus } from '@/lib/bicim'
import { EKSEN_STILI, eksenTL, eksenUSD } from './grafik/ortak'
import { hareketYerlestir, yonluTutar } from '@/lib/akis'

/**
 * KAZANC — "cebime ne girdi, ne cikti". TWR'den (getiri yuzdesi) ayri bir soru:
 * TWR para akisindan arindirilmis performanstir; burasi ORTALAMA MALIYET
 * yontemiyle gercek kar: gerceklesen (satilanlardan) + gerceklesmemis (acik
 * pozisyonun degeri - maliyeti). Kaynak v_varlik_kar (finans.varlik_kar()).
 *
 * Maliyeti bilinmeyen kalemler (BES, nakit: tutarsiz giris) toplamlara GIRMEZ
 * ve ayri listelenir — degerin tamami kar gibi gorunmesin.
 *
 * Cizgi: net yatirilan (basamak, seri-2) ile deger (seri-1); aradaki bosluk kar.
 * Iki seri ayni olcekte (para), tek eksen.
 */

const DEGER = 'var(--seri-1)'
const YATIRILAN = 'var(--seri-2)'

const sayi2 = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)
const isaretli = (n: number, bicim: (x: number) => string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${bicim(Math.abs(n))}`
const yuzdeMetni = (n: number) => `${n > 0 ? '+' : ''}${sayi2(n)} %`
const renk = (n: number) => (n > 0 ? 'var(--artis-iyi)' : n < 0 ? 'var(--kritik)' : 'var(--ink-muted)')
const num = (v: string | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v))

export default function Kazanc({
  kar, hareketler, kalemler, para = 'TRY', usdtry = null,
}: {
  kar: VarlikKar[]
  hareketler: HareketKaydi[]
  kalemler: VarlikPerformans[]
  para?: Para
  usdtry?: number | null
}) {
  const dolar = para === 'USD' && usdtry !== null && usdtry > 0
  const bicim = dolar ? usd : tl
  const bicimK = dolar ? usdKurus : tlKurus
  /** TL tutari ekran parasina cevir; hareketin kendi kuru varsa o, yoksa gunun kuru. */
  const cevir = (tlN: number, kur?: number | null) => (dolar ? tlN / (kur && kur > 0 ? kur : usdtry!) : tlN)

  // Maliyeti bilinenler toplama girer; bilinmeyenler (BES, nakit) ayri.
  const bilinen = useMemo(() => kar.filter((k) => !k.maliyet_bilinmiyor && k.kaynak_tur !== 'nakit'), [kar])
  const bilinmeyen = useMemo(() => kar.filter((k) => k.maliyet_bilinmiyor || k.kaynak_tur === 'nakit'), [kar])
  const bilinenId = useMemo(() => new Set(bilinen.map((k) => k.varlik_id)), [bilinen])

  /**
   * Kalem rakamlari ekran parasinda. $ gorunumde USD kalem kendi dolar
   * zincirinden (gercek $ kar), TL kalem gunun kuruyla cevrilir (yaklasik).
   */
  const satir = (k: VarlikKar) => {
    const usdKalem = dolar && k.para === 'USD' && k.acik_maliyet_dvz !== null
    const maliyet = usdKalem ? num(k.acik_maliyet_dvz) : cevir(num(k.acik_maliyet_tl))
    const deger = usdKalem ? num(k.guncel_deger_dvz) : cevir(num(k.guncel_deger_tl))
    const gerceklesen = usdKalem ? num(k.gerceklesen_dvz) : cevir(num(k.gerceklesen_tl))
    const gerceklesmemis = k.gerceklesmemis_tl === null ? null : usdKalem ? num(k.gerceklesmemis_dvz) : cevir(num(k.gerceklesmemis_tl))
    const toplam = gerceklesmemis === null ? null : gerceklesen + gerceklesmemis
    // Oran: toplam kara karsilik ALISA giden para (brut, komisyon dahil). USD kalemde gercek $ alis.
    const alisTabani = usdKalem ? num(k.alis_dvz) : cevir(num(k.alis_tl))
    const oran = toplam === null || alisTabani <= 0 ? null : (toplam / alisTabani) * 100
    const acik = num(k.acik_adet) > 0
    return { k, alis: alisTabani, maliyet, deger, gerceklesen, gerceklesmemis, toplam, oran, acik }
  }

  const satirlar = useMemo(() => bilinen.map(satir).sort((a, b) => (b.toplam ?? 0) - (a.toplam ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bilinen, dolar, usdtry])

  const toplamlar = useMemo(() => {
    const t = { yatirilan: 0, deger: 0, gerceklesen: 0, gerceklesmemis: 0, alis: 0 }
    for (const s of satirlar) {
      // Net yatirilan = alis - satis = maliyet - gerceklesen (ayni sey, iki yoldan).
      t.yatirilan += s.maliyet - s.gerceklesen
      t.deger += s.deger
      t.gerceklesen += s.gerceklesen
      t.gerceklesmemis += s.gerceklesmemis ?? 0
      t.alis += s.alis
    }
    return { ...t, kar: t.gerceklesen + t.gerceklesmemis }
  }, [satirlar])

  /**
   * Cizgi: olcum tarihlerinde bilinen kalemlerin toplam degeri ile o ana kadarki
   * net yatirilan. Akis, olcum gorunumunun kendi rakami (akis_tl/usd): hareket
   * hangi olcume dustuyse orada sayilir, degerle ayni anda. Son noktadan geriye
   * dogru kurulur: bugunku net yatirilan (v_varlik_kar) eksi henuz olcume
   * girmemis hareketler = son olcumdeki net yatirilan.
   */
  const { cizgi, oncekiAkis, bekleyen } = useMemo(() => {
    const degerler = new Map<string, number>()
    const akislar = new Map<string, number>()
    for (const r of kalemler) {
      if (!bilinenId.has(r.varlik_id)) continue
      degerler.set(r.tarih, (degerler.get(r.tarih) ?? 0) + num(dolar ? r.deger_usd : r.deger_tl))
      akislar.set(r.tarih, (akislar.get(r.tarih) ?? 0) + num(dolar ? r.akis_usd : r.akis_tl))
    }
    const tarihler = [...degerler.keys()].sort()
    const yer = hareketYerlestir(hareketler.filter((h) => bilinenId.has(h.varlik_id)), kalemler, tarihler)
    const tutar = (h: HareketKaydi) => cevir(yonluTutar(h), h.usdtry ? Number(h.usdtry) : null)
    const bekleyenNet = yer.bekleyen.reduce((t, h) => t + tutar(h), 0)

    const satirlar: { tarih: string; deger: number; yatirilan: number; kar: number }[] = []
    let yat = toplamlar.yatirilan - bekleyenNet
    for (let i = tarihler.length - 1; i >= 0; i--) {
      const t = tarihler[i]
      const deger = degerler.get(t)!
      satirlar.unshift({ tarih: t, deger, yatirilan: yat, kar: deger - yat })
      yat -= akislar.get(t) ?? 0
    }
    return { cizgi: satirlar, oncekiAkis: yer.onceki.length, bekleyen: { adet: yer.bekleyen.length, net: bekleyenNet } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalemler, hareketler, bilinenId, dolar, usdtry, toplamlar.yatirilan])

  const ekseni = dolar ? eksenUSD : eksenTL

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Kazanç</h2>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Ortalama maliyet yöntemi. Getiri yüzdesinden ayrı soru: oradaki &quot;yatırımcı olarak ne kadar iyiydim&quot;, buradaki &quot;cebime ne girdi&quot;.
          {dolar && ' $ görünümde ABD kalemleri kendi dolar maliyetiyle, ₺ kalemler günün kuruyla.'}
        </span>
      </div>

      {/* Baslik rakamlari */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Net yatırılan</div>
          <div className="rakam text-[18px] font-semibold leading-tight" title="Alışlar − satışlar: cepten çıkan net para">{bicim(toplamlar.yatirilan)}</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Bugünkü değer</div>
          <div className="rakam text-[18px] font-semibold leading-tight">{bicim(toplamlar.deger)}</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Kâr</div>
          <div className="rakam text-[18px] font-semibold leading-tight" style={{ color: renk(toplamlar.kar) }}>{isaretli(toplamlar.kar, bicim)}</div>
          <div className="rakam text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            gerçekleşen {isaretli(toplamlar.gerceklesen, bicim)} · açık {isaretli(toplamlar.gerceklesmemis, bicim)}
          </div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Kâr oranı</div>
          <div className="rakam text-[18px] font-semibold leading-tight" style={{ color: renk(toplamlar.kar) }} title="Kâr / net yatırılan">
            {toplamlar.yatirilan > 0 ? yuzdeMetni((toplamlar.kar / toplamlar.yatirilan) * 100) : '—'}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>net yatırılana göre</div>
        </div>
      </div>

      {/* Yatirilan vs deger */}
      {cizgi.length >= 2 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px]">
            {[{ ad: 'Değer', r: DEGER }, { ad: 'Net yatırılan', r: YATIRILAN }].map((s) => (
              <span key={s.ad} className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.r }} />
                <span style={{ color: 'var(--ink-2)' }}>{s.ad}</span>
              </span>
            ))}
            <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              Aradaki boşluk kâr. {tarihKisa(cizgi[0].tarih)} → {tarihKisa(cizgi[cizgi.length - 1].tarih)}
              {oncekiAkis > 0 && ` · ölçümden önceki ${oncekiAkis} hareket başlangıç noktasının içinde`}
              {bekleyen.adet > 0 && ` · son ölçümden sonraki ${bekleyen.adet} hareket (${isaretli(bekleyen.net, bicim)}) henüz çizgide değil`}
            </span>
          </div>
          <div className="mt-2 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cizgi} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="tarih" tickFormatter={(t) => tarihKisa(t).replace(/ \d{4}$/, '')} tick={EKSEN_STILI} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
                <YAxis tickFormatter={ekseni} tick={EKSEN_STILI} tickLine={false} axisLine={false} width={64} domain={['auto', 'auto']} />
                <Tooltip
                  cursor={{ stroke: 'var(--axis)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as { deger: number; yatirilan: number; kar: number }
                    return (
                      <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)' }}>
                        <div className="font-medium">{tarihKisa(String(label))}</div>
                        <div className="flex items-center gap-2"><span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: DEGER }} /><span style={{ color: 'var(--ink-2)' }}>Değer</span><span className="rakam ml-auto">{bicimK(p.deger)}</span></div>
                        <div className="flex items-center gap-2"><span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: YATIRILAN }} /><span style={{ color: 'var(--ink-2)' }}>Net yatırılan</span><span className="rakam ml-auto">{bicimK(p.yatirilan)}</span></div>
                        <div className="rakam mt-1 border-t pt-1" style={{ borderColor: 'var(--hair)', color: renk(p.kar) }}>
                          kâr {isaretli(p.kar, bicimK)}{p.yatirilan > 0 && ` · ${yuzdeMetni((p.kar / p.yatirilan) * 100)}`}
                        </div>
                      </div>
                    )
                  }}
                />
                <Line type="stepAfter" dataKey="yatirilan" name="Net yatırılan" stroke={YATIRILAN} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="deger" name="Değer" stroke={DEGER} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Kalem tablosu */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              <th className="py-1 font-normal">Kalem</th>
              <th className="py-1 text-right font-normal" title="Açık pozisyonun ortalama maliyeti">Maliyet</th>
              <th className="py-1 text-right font-normal">Değer</th>
              <th className="py-1 text-right font-normal" title="Satılanlardan kesinleşen kâr/zarar">Gerçekleşen</th>
              <th className="py-1 text-right font-normal" title="Açık pozisyon: değer − maliyet">Açık</th>
              <th className="py-1 text-right font-normal">Toplam</th>
              <th className="py-1 text-right font-normal" title="Toplam kâr / alışa giden para">Oran</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map(({ k, maliyet, deger, gerceklesen, gerceklesmemis, toplam, oran, acik }) => (
              <tr key={k.varlik_id} style={{ borderTop: '1px solid var(--hair)', opacity: acik ? 1 : 0.7 }}>
                <td className="py-1.5">
                  <span className="font-medium">{k.kod}</span>
                  <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{SINIF_ETIKETI[k.sinif]}{!acik && ' · kapandı'}</span>
                  {acik && k.ort_maliyet !== null && (
                    <span className="rakam ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }} title="Ortalama alış fiyatı, kalemin kendi para biriminde">
                      ort. {k.para === 'USD' ? '$' : '₺'}{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: Number(k.ort_maliyet) < 100 ? 4 : 2 }).format(Number(k.ort_maliyet))}
                    </span>
                  )}
                </td>
                <td className="rakam py-1.5 text-right" style={{ color: 'var(--ink-2)' }}>{acik ? bicim(maliyet) : '—'}</td>
                <td className="rakam py-1.5 text-right" style={{ color: 'var(--ink-2)' }}>{acik ? bicim(deger) : '—'}</td>
                <td className="rakam py-1.5 text-right" style={{ color: gerceklesen === 0 ? 'var(--ink-muted)' : renk(gerceklesen) }}>{gerceklesen === 0 ? '—' : isaretli(gerceklesen, bicim)}</td>
                <td className="rakam py-1.5 text-right" style={{ color: gerceklesmemis === null || !acik ? 'var(--ink-muted)' : renk(gerceklesmemis) }}>{!acik || gerceklesmemis === null ? '—' : isaretli(gerceklesmemis, bicim)}</td>
                <td className="rakam py-1.5 text-right font-medium" style={{ color: toplam === null ? 'var(--ink-muted)' : renk(toplam) }}>{toplam === null ? '—' : isaretli(toplam, bicim)}</td>
                <td className="rakam py-1.5 text-right text-[11px]" style={{ color: oran === null ? 'var(--ink-muted)' : renk(oran) }}>{oran === null ? '—' : yuzdeMetni(oran)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--hair)' }}>
              <td className="py-1.5 font-medium">Toplam</td>
              <td className="rakam py-1.5 text-right font-medium">{bicim(toplamlar.yatirilan + toplamlar.gerceklesen)}</td>
              <td className="rakam py-1.5 text-right font-medium">{bicim(toplamlar.deger)}</td>
              <td className="rakam py-1.5 text-right font-medium" style={{ color: renk(toplamlar.gerceklesen) }}>{isaretli(toplamlar.gerceklesen, bicim)}</td>
              <td className="rakam py-1.5 text-right font-medium" style={{ color: renk(toplamlar.gerceklesmemis) }}>{isaretli(toplamlar.gerceklesmemis, bicim)}</td>
              <td className="rakam py-1.5 text-right font-semibold" style={{ color: renk(toplamlar.kar) }}>{isaretli(toplamlar.kar, bicim)}</td>
              <td className="rakam py-1.5 text-right text-[11px] font-medium" style={{ color: renk(toplamlar.kar) }}>{toplamlar.yatirilan > 0 ? yuzdeMetni((toplamlar.kar / toplamlar.yatirilan) * 100) : '—'}</td>
            </tr>
          </tbody>
        </table>
        {bilinmeyen.length > 0 && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Toplamın dışında — maliyeti bilinmiyor: {bilinmeyen.map((k) => `${k.kod} (${bicim(cevir(num(k.guncel_deger_tl)))})`).join(', ')}.
            {' '}Elle değerlenen kalemlerde alış maliyeti girilirse buraya girer.
          </p>
        )}
      </div>
    </div>
  )
}
