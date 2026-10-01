'use client'

import { useMemo } from 'react'
import {
  Area, CartesianGrid, ComposedChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { HareketKaydi, Para, PortfoyPerformans, VarlikPerformans } from '@/lib/tipler-varlik'
import { hareketYerlestir, yonluTutar } from '@/lib/akis'
import { donemBasligi, donemKesiti, type Donem } from '@/lib/donem'
import { secimAdi, secimdeMi, useSecim } from './SecimBaglami'
import { tarihKisa, tl, tlKurus, usd, usdKurus } from '@/lib/bicim'
import { EKSEN_STILI, eksenTL, eksenUSD, ustSinir } from './grafik/ortak'

/**
 * PORTFOY BUYUKLUGU — getiri yuzdesinden bagimsiz, "kasada ne var" sorusu.
 * Alan: olcum gunlerindeki toplam deger (seri-1). Isaretler: o gun para
 * giren (seri-3) ya da cikan (seri-2) var. Boylece bir dusus gorunce
 * "piyasa mi dustu, ben mi para cektim" ayrimi tek bakista yapilir.
 *
 * Akis rakamlari olcum gorunumunden (v_portfoy_performans.akis): hareket,
 * gecerli_an'ina gore hangi olcume dustuyse o gune yazilir; olcumden sonra
 * girilen bugunku satis henuz hicbir gunde degildir ve "sonraki olcumu
 * bekliyor" diye ayri sayilir. Hareket listesi (hangi kalem, ne kadar) ipucu
 * icindir; lib/akis.ts ayni kurala gore gune yerlestirir.
 *
 * Tek olcek, tek eksen: deger ve akis ayni para biriminde.
 */

const DEGER = 'var(--seri-1)'
const GIRIS = 'var(--seri-3)'
const CIKIS = 'var(--seri-2)'

type Satir = { kod: string; etiket: string; tutar: number }
type Nokta = { tarih: string; deger: number; net: number; satirlar: Satir[] }

const num = (v: string | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v))
const isaretli = (n: number, bicim: (x: number) => string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${bicim(Math.abs(n))}`
const renk = (n: number) => (n > 0 ? 'var(--artis-iyi)' : n < 0 ? 'var(--kritik)' : 'var(--ink-muted)')

/** Eksen etiketi: seri tek yila sigiyorsa yil yazilmaz, iki yila yayiliyorsa yazilir. */
const eksenTarihiYap = (ilk: string | undefined, son: string | undefined) => {
  const ayniYil = !!ilk && !!son && ilk.slice(0, 4) === son.slice(0, 4)
  return (t: unknown) => (ayniYil ? tarihKisa(String(t)).replace(/ \d{4}$/, '') : tarihKisa(String(t)))
}

export default function PortfoyBuyuklugu({
  toplam, kalemler, hareketler, donem, para = 'TRY', usdtry = null,
}: {
  toplam: PortfoyPerformans[]
  kalemler: VarlikPerformans[]
  hareketler: HareketKaydi[]
  donem: Donem
  para?: Para
  usdtry?: number | null
}) {
  const dolar = para === 'USD' && usdtry !== null && usdtry > 0
  const bicim = dolar ? usd : tl
  const bicimK = dolar ? usdKurus : tlKurus
  const cevir = (tlN: number, kur?: number | null) => (dolar ? tlN / (kur && kur > 0 ? kur : usdtry!) : tlN)

  const secim = useSecim()
  const secimVar = secim.varlikId !== null || secim.grup !== null

  const { seri, onceki, oncekiNet, bekleyen, bekleyenNet, secimKodu } = useMemo(() => {
    // Secim varsa seri secili kalemlerin gun gun toplami (deger ve akis), yoksa portfoy toplami.
    const uyeler = secimVar ? kalemler.filter((k) => secimdeMi(secim, k)) : kalemler
    const uyeId = new Set(uyeler.map((k) => k.varlik_id))
    let seri: Nokta[]
    if (secimVar) {
      const gun = new Map<string, Nokta>()
      for (const k of uyeler) {
        const n = gun.get(k.tarih) ?? { tarih: k.tarih, deger: 0, net: 0, satirlar: [] }
        n.deger += num(dolar ? k.deger_usd : k.deger_tl)
        n.net += num(dolar ? k.akis_usd : k.akis_tl)
        gun.set(k.tarih, n)
      }
      seri = [...gun.values()].sort((a, b) => a.tarih.localeCompare(b.tarih))
    } else {
      seri = toplam
        .filter((t) => (dolar ? t.deger_usd : t.deger_tl) !== null)
        .map((t) => ({ tarih: t.tarih, deger: num(dolar ? t.deger_usd : t.deger_tl), net: num(dolar ? t.akis_usd : t.akis_tl), satirlar: [] }))
        .sort((a, b) => a.tarih.localeCompare(b.tarih))
    }
    const tarihler = seri.map((s) => s.tarih)
    const secimKodu = secim.varlikId === null ? null : (uyeler[0]?.kod ?? hareketler.find((h) => h.varlik_id === secim.varlikId)?.varlik?.kod ?? null)
    const yer = hareketYerlestir(hareketler.filter((h) => uyeId.has(h.varlik_id)), uyeler, tarihler)
    const tutar = (h: HareketKaydi) => cevir(yonluTutar(h), h.usdtry ? Number(h.usdtry) : null)

    for (const s of seri) {
      const gun = yer.gunler.get(s.tarih) ?? []
      const aciklanan = new Set<number>()
      for (const h of gun) {
        aciklanan.add(h.varlik_id)
        s.satirlar.push({ kod: h.varlik?.kod ?? `#${h.varlik_id}`, etiket: h.tur, tutar: tutar(h) })
      }
      // Hareketsiz akis (nakit bakiyesi gibi): olcum gorunumunun kendi rakami.
      for (const k of uyeler) {
        if (k.tarih !== s.tarih || aciklanan.has(k.varlik_id)) continue
        const a = num(dolar ? k.akis_usd : k.akis_tl)
        if (Math.abs(a) >= 0.5) s.satirlar.push({ kod: k.kod, etiket: 'değişim', tutar: a })
      }
    }
    const topla = (hs: HareketKaydi[]) => hs.reduce((t, h) => t + tutar(h), 0)
    // Donem kesiti: ilk nokta donem basi. Ondan onceki (ve o gune dusen) hareketler baslangic degerinin icinde.
    const kesit = donemKesiti(seri, donem)
    const basTarihi = kesit[0]?.tarih ?? null
    const oncekiHareket = [...yer.onceki, ...[...yer.gunler.entries()].filter(([t]) => basTarihi !== null && t <= basTarihi).flatMap(([, hs]) => hs)]
    return { seri: kesit, onceki: oncekiHareket.length, oncekiNet: topla(oncekiHareket), bekleyen: yer.bekleyen, bekleyenNet: topla(yer.bekleyen), secimKodu }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toplam, kalemler, hareketler, donem, dolar, usdtry, secim.varlikId, secim.grup])
  const baslikEki = secimAdi(secim, secimKodu)

  if (seri.length < 2) {
    return (
      <div className="kart p-4">
        <h2 className="text-[15px] font-semibold">Portföy büyüklüğü{baslikEki && <span style={{ color: 'var(--ink-2)' }}> · {baslikEki}</span>}</h2>
        <p className="py-6 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Grafik için en az iki ölçüm gerekiyor.
        </p>
      </div>
    )
  }

  const ilk = seri[0], son = seri[seri.length - 1]
  const degisim = son.deger - ilk.deger
  // Ilk nokta donem basidir: o gunun akisi baslangic degerinin icinde sayilir, isaretlenmez.
  const sonrasi = seri.slice(1)
  const netAkis = sonrasi.reduce((t, s) => t + s.net, 0)
  const piyasa = degisim - netAkis
  const girisGun = sonrasi.filter((s) => s.net >= 0.5).length
  const cikisGun = sonrasi.filter((s) => s.net <= -0.5).length
  const donemAdi = donemBasligi(donem)
  const tavan = ustSinir(Math.max(...seri.map((s) => s.deger)))
  const ekseni = dolar ? eksenUSD : eksenTL
  const eksenTarihi = eksenTarihiYap(ilk.tarih, son.tarih)

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Portföy büyüklüğü{baslikEki && <span style={{ color: 'var(--ink-2)' }}> · {baslikEki}</span>}</h2>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Kasada ne var, ne zaman para koydun ya da çektin. Bir düşüş gördüğünde piyasa mı, çekiş mi — işaretlere bak.
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Son ölçüm</div>
          <div className="rakam text-[18px] font-semibold leading-tight">{bicim(son.deger)}</div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{tarihKisa(son.tarih)}</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{donem.kod === 'tum' ? 'Başlangıç' : 'Dönem başı'}</div>
          <div className="rakam text-[18px] font-semibold leading-tight">{bicim(ilk.deger)}</div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{tarihKisa(ilk.tarih)}</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Net akış</div>
          <div className="rakam text-[18px] font-semibold leading-tight" title={`Dönemde (${donemAdi}) koyduğun − çektiğin`}>{isaretli(netAkis, bicim)}</div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{girisGun} giriş günü · {cikisGun} çıkış günü</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Piyasa etkisi</div>
          <div className="rakam text-[18px] font-semibold leading-tight" style={{ color: renk(piyasa) }} title="Değişim − net akış: akışlardan arındırılmış fark">
            {isaretli(piyasa, bicim)}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>toplam değişim {isaretli(degisim, bicim)}</div>
        </div>
      </div>

      {/* Efsane duz HTML (Recharts 3 Legend payload almiyor); isaretlerin anlami renk + metin. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: DEGER }} />
          <span style={{ color: 'var(--ink-2)' }}>Değer</span>
        </span>
        {[{ ad: 'Para girdi', r: GIRIS }, { ad: 'Para çıktı', r: CIKIS }].map((s) => (
          <span key={s.ad} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.r, boxShadow: '0 0 0 2px var(--surface)' }} />
            <span style={{ color: 'var(--ink-2)' }}>{s.ad}</span>
          </span>
        ))}
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          {donemAdi} · {tarihKisa(ilk.tarih)} → {tarihKisa(son.tarih)}
          {onceki > 0 && ` · öncesindeki ${onceki} hareket (${isaretli(oncekiNet, bicim)}) başlangıç değerinin içinde`}
        </span>
      </div>
      {bekleyen.length > 0 && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--uyari)' }}>
          Son ölçümden sonra girilen {bekleyen.length} hareket ({isaretli(bekleyenNet, bicim)}:{' '}
          {bekleyen.map((h) => `${h.varlik?.kod ?? h.varlik_id} ${h.tur.toLowerCase()}`).join(', ')}) henüz değere yansımadı; sonraki ölçümde görünür.
        </p>
      )}

      <div className="mt-2 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={seri} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="buyuklukDolgu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DEGER} stopOpacity={0.26} />
                <stop offset="100%" stopColor={DEGER} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="tarih" tickFormatter={eksenTarihi}
              tick={EKSEN_STILI} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24}
            />
            <YAxis tickFormatter={ekseni} tick={EKSEN_STILI} tickLine={false} axisLine={false} width={64} domain={[0, tavan]} />
            <Tooltip cursor={{ stroke: 'var(--axis)' }} content={<NoktaIpucu bicim={bicimK} />} />
            <Area
              type="monotone" dataKey="deger" name="Değer"
              stroke={DEGER} strokeWidth={2} fill="url(#buyuklukDolgu)"
              dot={false} activeDot={{ r: 5, fill: DEGER, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {/* Akis gunleri: isaret cizginin ustunde; renk yon, yaricap 5 = 10px, surface halkasi 2px. */}
            {sonrasi.filter((s) => Math.abs(s.net) >= 0.5).map((s) => (
              <ReferenceDot
                key={s.tarih} x={s.tarih} y={s.deger} r={5}
                fill={s.net >= 0 ? GIRIS : CIKIS} stroke="var(--surface)" strokeWidth={2}
                ifOverflow="visible"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Noktaya gelince: deger ve o olcume dusen akislar (kalem, tur, tutar). */
function NoktaIpucu({
  active, payload, label, bicim,
}: {
  active?: boolean
  payload?: { payload?: Nokta }[]
  label?: string | number
  bicim: (n: number) => string
}) {
  const n = payload?.[0]?.payload
  if (!active || !n) return null
  return (
    <div className="kart max-w-[300px] px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
      <div className="flex items-baseline gap-3">
        <span className="font-medium">{tarihKisa(String(label ?? n.tarih))}</span>
        <span className="rakam ml-auto font-semibold">{bicim(n.deger)}</span>
      </div>
      {n.satirlar.length > 0 && (
        <>
          <ul className="mt-1.5 border-t pt-1.5 text-[11px]" style={{ borderColor: 'var(--hair)' }}>
            {n.satirlar.map((a, i) => (
              <li key={i} className="flex items-baseline gap-1.5">
                <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 self-center rounded-full" style={{ background: a.tutar >= 0 ? GIRIS : CIKIS }} />
                <span className="font-medium">{a.kod}</span>
                <span style={{ color: 'var(--ink-2)' }}>{a.etiket}</span>
                <span className="rakam ml-auto shrink-0">{isaretli(a.tutar, bicim)}</span>
              </li>
            ))}
          </ul>
          <div className="rakam mt-1 flex justify-between border-t pt-1 text-[11px]" style={{ borderColor: 'var(--hair)' }}>
            <span style={{ color: 'var(--ink-2)' }}>net akış</span>
            <span style={{ color: renk(n.net) }}>{isaretli(n.net, bicim)}</span>
          </div>
        </>
      )}
    </div>
  )
}
