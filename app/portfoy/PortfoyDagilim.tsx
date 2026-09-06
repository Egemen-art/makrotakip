'use client'

import { useMemo, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { PortfoyGetiri } from '@/lib/tipler'
import { tarihKisa, tl, tlKurus, yuzde } from '@/lib/bicim'
import { EKSEN_STILI, Ipucu, SERI_RENKLERI, SecimGrubu, eksenTL, eksenUSD, ustSinir } from '@/components/grafik/ortak'
import { bicimle, bicimleKurus, cevir, type Para } from '@/lib/portfoy'

type Sinif = 'ppf' | 'vadeli_mevduat' | 'hisse_abd' | 'hisse_bist' | 'altin_fiziksel' | 'altin_etf' | 'nakit' | 'bes'
type Gorunum = 'liste' | 'pasta'

/**
 * Renk KIMLIGE baglidir: her sinifin yuvasi sabittir (KALEMLER sirasi),
 * degeri sifirlanip geri gelse de ayni rengi alir. Sira/rank ile boyanmaz.
 */
const KALEMLER: { ad: Sinif; etiket: string; birim?: 'gram' | 'usd' }[] = [
  { ad: 'ppf',            etiket: 'PPF' },
  { ad: 'vadeli_mevduat', etiket: 'Vadeli mevduat' },
  { ad: 'hisse_abd',      etiket: 'Hisse (ABD)',      birim: 'usd' },
  { ad: 'hisse_bist',     etiket: 'Hisse (BİST)' },
  { ad: 'altin_fiziksel', etiket: 'Altın (fiziksel)', birim: 'gram' },
  { ad: 'altin_etf',      etiket: 'Altın (ETF)' },
  { ad: 'nakit',          etiket: 'Nakit' },
  { ad: 'bes',            etiket: 'BES' },
]
const renk = (ad: Sinif) => SERI_RENKLERI[KALEMLER.findIndex((k) => k.ad === ad)]
const say = (n: string | null | undefined) => Number(n ?? 0)
const oran = (simdi: number, once: number) => (once > 0 ? (simdi - once) / once : null)

export default function PortfoyDagilim({ satirlar, para = 'TRY' }: { satirlar: PortfoyGetiri[]; para?: Para }) {
  const [gorunum, setGorunum] = useState<Gorunum>('liste')
  const [secili, setSecili] = useState<Sinif | null>(null)

  const sirali = useMemo(() => [...satirlar].sort((a, b) => a.tarih.localeCompare(b.tarih)), [satirlar])
  const son = sirali.at(-1)
  if (!son) return null
  const b = bicimle(para)
  const toplam = cevir(say(son.toplam_tl), son, para) ?? 0

  const dilimler = KALEMLER
    .map((k) => ({ ...k, tutar: cevir(say(son[k.ad]), son, para) ?? 0 }))
    .filter((k) => k.tutar > 0)
    .sort((a, b) => b.tutar - a.tutar)

  const sec = (ad: Sinif) => setSecili((s) => (s === ad ? null : ad))

  const liste = (
    <ul className="min-w-[240px] flex-1">
      {dilimler.map((k) => {
        const pay = k.tutar / toplam
        const bu = secili === k.ad
        const soluk = secili !== null && !bu
        return (
          <li key={k.ad}>
            <button
              type="button"
              onClick={() => sec(k.ad)}
              aria-pressed={bu}
              className="w-full rounded-md px-1.5 py-1.5 text-left hover:bg-[var(--plane)]"
              style={{ background: bu ? 'var(--plane)' : undefined, opacity: soluk ? 0.55 : 1 }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink)', fontWeight: bu ? 600 : 400 }}>
                  <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: renk(k.ad) }} />
                  {k.etiket}
                </span>
                <span className="rakam text-[13px]">
                  {b(k.tutar)}
                  <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{yuzde(pay)}</span>
                </span>
              </div>
              {gorunum === 'liste' && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--grid)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pay * 100}%`, background: renk(k.ad) }} />
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <section className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Son dağılım</h2>
          <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            {tarihKisa(son.tarih)} · bir yatırıma tıkla, seyrini ve getirisini gör
          </p>
        </div>
        <SecimGrubu<Gorunum>
          secenekler={[{ deger: 'liste', ad: 'Liste' }, { deger: 'pasta', ad: 'Pasta' }]}
          deger={gorunum} degistir={setGorunum} etiket="Görünüm"
        />
      </div>

      <div className="kart p-4">
        {gorunum === 'liste' ? liste : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative h-[240px] w-[240px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dilimler} dataKey="tutar" nameKey="etiket" cx="50%" cy="50%"
                    innerRadius={68} outerRadius={108} paddingAngle={1.5}
                    stroke="var(--surface)" strokeWidth={2} startAngle={90} endAngle={-270}
                    isAnimationActive={false}
                    onClick={(_, i) => { const d = dilimler[i]; if (d) sec(d.ad) }}
                    style={{ cursor: 'pointer' }}
                  >
                    {dilimler.map((d) => (
                      <Cell key={d.ad} fill={renk(d.ad)} fillOpacity={secili && secili !== d.ad ? 0.3 : 1} />
                    ))}
                  </Pie>
                  <Tooltip content={<PastaIpucu toplam={toplam} para={para} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>toplam</span>
                <span className="rakam text-[17px] font-semibold leading-tight">{b(toplam)}</span>
              </div>
            </div>
            {liste}
          </div>
        )}

        {secili && <KalemDetayi sinif={secili} sirali={sirali} para={para} kapat={() => setSecili(null)} />}
      </div>
    </section>
  )
}

/* ── Secili kalemin seyri ve getirisi ─────────────────────────────────── */

function KalemDetayi({ sinif, sirali, para, kapat }: { sinif: Sinif; sirali: PortfoyGetiri[]; para: Para; kapat: () => void }) {
  const k = KALEMLER.find((x) => x.ad === sinif)!
  const b = bicimle(para)
  const bk = bicimleKurus(para)
  const seri = sirali.map((s) => {
    const degerTl = say(s[sinif])
    // Secilen parada deger; USD'de o kaydin kendi kuruyla. Kur yoksa 0 (grafikte bosluk yerine sifir — nadir).
    const deger = cevir(degerTl, s, para) ?? 0
    // Birim bilgisi: gram = TL / gram fiyati, USD = TL / kur — kur kayitta varsa. Birim fiyat da secilen parada.
    const birimFiyatTl = k.birim === 'gram' ? say(s.altin_gram_tl) : k.birim === 'usd' ? say(s.usdtry) : 0
    const miktar = k.birim && birimFiyatTl > 0 ? degerTl / birimFiyatTl : null
    const birimFiyat = birimFiyatTl > 0 ? (cevir(birimFiyatTl, s, para) ?? null) : null
    return { tarih: s.tarih, deger, birimFiyat, miktar, akis: cevir(say(s.eklenen_cekilen), s, para) ?? 0 }
  })
  const son = seri.at(-1)!, onceki = seri.at(-2) ?? null, ilk = seri[0]
  const dOnceki = onceki ? son.deger - onceki.deger : null
  const dIlk = seri.length > 1 ? son.deger - ilk.deger : null
  // Birim fiyat getirisi (yalniz gram/usd): miktar sabitse bu, saf fiyat getirisidir.
  const fiyatGetiri = onceki?.birimFiyat && son.birimFiyat ? oran(son.birimFiyat, onceki.birimFiyat) : null
  const miktarDegisti = onceki?.miktar !== null && onceki?.miktar !== undefined && son.miktar !== null
    ? Math.abs(son.miktar - onceki.miktar) > 0.005 : false
  const tavan = ustSinir(Math.max(...seri.map((s) => s.deger)))
  const r = renk(sinif)
  const birimEtiketi = k.birim === 'gram' ? 'gram' : k.birim === 'usd' ? '$' : null

  return (
    <div className="mt-4 rounded-lg p-3" style={{ border: '1px solid var(--hair)', background: 'var(--plane)' }}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold">
          <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: r }} />
          {k.etiket} · seyir ve getiri
        </span>
        <button type="button" onClick={kapat} className="text-[12px]" style={{ color: 'var(--ink-muted)' }} aria-label="Kapat">kapat ✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kutu etiket="Değer" deger={b(son.deger)} alt={tarihKisa(son.tarih)} />
        <Kutu
          etiket="Önceki kayda göre"
          deger={dOnceki === null ? '—' : b(dOnceki)}
          alt={onceki ? `${tarihKisa(onceki.tarih)} · ${yuzde(oran(son.deger, onceki.deger))}` : 'önceki kayıt yok'}
          renk={dOnceki === null ? undefined : dOnceki >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)'}
        />
        <Kutu
          etiket="İlk kayda göre"
          deger={dIlk === null ? '—' : b(dIlk)}
          alt={seri.length > 1 ? `${tarihKisa(ilk.tarih)} · ${yuzde(oran(son.deger, ilk.deger))}` : 'tek kayıt'}
          renk={dIlk === null ? undefined : dIlk >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)'}
        />
        {k.birim === 'usd' && para === 'USD' ? (
          // Dolar modunda hisse ABD'nin "birim fiyati" 1$ olurdu — anlamli olan kurun kendisi ve degisimi.
          <Kutu
            etiket="USD/TRY kuru"
            deger={say(sirali.at(-1)!.usdtry) > 0 ? say(sirali.at(-1)!.usdtry).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '—'}
            alt={(() => { const o = sirali.at(-2); const r = o && say(o.usdtry) > 0 && say(sirali.at(-1)!.usdtry) > 0 ? oran(say(sirali.at(-1)!.usdtry), say(o.usdtry)) : null; return r === null ? 'önceki kayıtta kur yok' : `önceki kayda göre ${yuzde(r)}` })()}
          />
        ) : birimEtiketi && son.miktar !== null ? (
          <Kutu
            etiket={k.birim === 'gram' ? 'Miktar · gram fiyatı' : 'Miktar · USD/TRY'}
            deger={`${son.miktar.toLocaleString('tr-TR', { maximumFractionDigits: k.birim === 'gram' ? 3 : 2 })} ${birimEtiketi}`}
            alt={fiyatGetiri === null
              ? `birim ${bk(son.birimFiyat)}`
              : `birim ${bk(son.birimFiyat)} · fiyat ${yuzde(fiyatGetiri)}${miktarDegisti ? ' · miktar değişti' : ' · miktar aynı'}`}
            renk={fiyatGetiri === null ? undefined : fiyatGetiri >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)'}
          />
        ) : (
          <Kutu etiket="Portföy payı" deger={yuzde(son.deger / say(sirali.at(-1)!.toplam_tl))} alt="son kayıtta" />
        )}
      </div>

      {seri.length >= 2 ? (
        <div className="mt-3 h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={seri} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id={`dolgu-${sinif}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={r} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={r} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="tarih" tickFormatter={tarihKisa} tick={EKSEN_STILI} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
              <YAxis tickFormatter={para === 'USD' ? eksenUSD : eksenTL} tick={EKSEN_STILI} tickLine={false} axisLine={false} width={58} domain={[0, tavan]} />
              <Tooltip content={<Ipucu donemMi={false} bicim={bk} />} labelFormatter={(d) => tarihKisa(String(d))} cursor={{ stroke: 'var(--axis)' }} />
              <Area type="monotone" dataKey="deger" name={k.etiket} stroke={r} strokeWidth={2} fill={`url(#dolgu-${sinif})`}
                dot={{ r: 4, fill: r, stroke: 'var(--surface)', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 text-[12px]" style={{ color: 'var(--ink-muted)' }}>Seyir için en az iki anlık görüntü gerekiyor.</p>
      )}

      {/* Kayit tablosu: tarih · miktar · birim fiyat · TL · o kayittaki para akisi */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-[12px]">
          <thead>
            <tr style={{ color: 'var(--ink-muted)' }}>
              <th className="py-1 text-left font-medium">Tarih</th>
              {birimEtiketi && <th className="py-1 text-right font-medium">Miktar</th>}
              {birimEtiketi && <th className="py-1 text-right font-medium">Birim fiyat</th>}
              <th className="py-1 text-right font-medium">Değer</th>
              <th className="py-1 text-right font-medium">Değişim</th>
              <th className="py-1 text-right font-medium">Portföye giriş/çıkış</th>
            </tr>
          </thead>
          <tbody>
            {[...seri].reverse().map((s, i, arr) => {
              const onc = arr[i + 1]
              const d = onc ? s.deger - onc.deger : null
              return (
                <tr key={s.tarih} style={{ borderTop: '1px solid var(--hair)' }}>
                  <td className="rakam py-1">{tarihKisa(s.tarih)}</td>
                  {birimEtiketi && <td className="rakam py-1 text-right">{s.miktar === null ? '—' : `${s.miktar.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${birimEtiketi}`}</td>}
                  {birimEtiketi && <td className="rakam py-1 text-right">{s.birimFiyat === null ? '—' : bk(s.birimFiyat)}</td>}
                  <td className="rakam py-1 text-right font-medium">{b(s.deger)}</td>
                  <td className="rakam py-1 text-right" style={{ color: d === null ? 'var(--ink-muted)' : d >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)' }}>
                    {d === null ? '—' : `${d >= 0 ? '+' : ''}${b(d)}`}
                  </td>
                  <td className="rakam py-1 text-right" style={{ color: 'var(--ink-muted)' }}>{s.akis ? b(s.akis) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        Değişim = iki kayıt arasındaki değer farkı. Para giriş/çıkışı yalnızca <em>portföy toplamı</em> için tutuluyor
        (sağ sütun), kalem bazında değil — o yüzden bir kaleme para eklendiyse buradaki artış getiri + katkıdır.
        {birimEtiketi ? ' Bu kalemde miktar ve birim fiyat ayrı görünür: miktar aynıysa "fiyat" yüzdesi saf getiridir.' : ''}
        {para === 'USD' ? ' Dolar değerleri her kaydın kendi günündeki USD/TRY kuruyla çevrildi.' : ''}
      </p>
    </div>
  )
}

function Kutu({ etiket, deger, alt, renk: r }: { etiket: string; deger: string; alt?: string; renk?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--hair)' }}>
      <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{etiket}</div>
      <div className="rakam mt-0.5 text-[16px] font-semibold leading-tight" style={{ color: r ?? 'var(--ink)' }}>{deger}</div>
      {alt && <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{alt}</div>}
    </div>
  )
}

function PastaIpucu({ active, payload, toplam, para }: { active?: boolean; payload?: { name?: string; value?: number; payload?: { ad?: Sinif } }[]; toplam: number; para: Para }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  if (!p.name || p.value === undefined) return null
  const ad = p.payload?.ad
  return (
    <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
      <div className="flex items-center gap-2 whitespace-nowrap">
        {ad && <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: renk(ad) }} />}
        <span style={{ color: 'var(--ink-2)' }}>{p.name}</span>
        <span className="rakam ml-3 font-medium">{bicimleKurus(para)(p.value)}</span>
        <span className="rakam" style={{ color: 'var(--ink-muted)' }}>{yuzde(p.value / toplam)}</span>
      </div>
    </div>
  )
}
