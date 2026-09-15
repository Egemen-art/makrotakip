'use client'

import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Para, PortfoyOlcumPerformans, VarlikOlcumPerformans } from '@/lib/tipler-varlik'
import { SINIF_ETIKETI } from '@/lib/tipler-varlik'
import { tarihKisa, tl, usd } from '@/lib/bicim'
import { EKSEN_STILI, eksenTL, eksenUSD } from './grafik/ortak'

/**
 * GUN ICI: secili gunun olcumleri (gunde 3 + elle tetiklenenler) ve olcumden
 * olcume fark. Fark para akisindan arindirilmistir: gun icinde alim yapildiysa
 * o tutar "kazanc" gibi gorunmez. Ilk olcumun farki bir onceki gunun son
 * olcumune goredir (gece farki) ve oyle etiketlenir.
 */

const SAAT = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
const GUN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' })
const saat = (iso: string) => SAAT.format(new Date(iso))
const gunu = (iso: string) => GUN.format(new Date(iso))

const yuzdeMetni = (n: number) =>
  `${n > 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} %`
const renk = (n: number) => (n > 0 ? 'var(--artis-iyi)' : n < 0 ? 'var(--kritik)' : 'var(--ink-muted)')

/** Adimlari zincirle: Π(1 + r) - 1, yuzde. */
const zincirle = (adimlar: number[]) => (adimlar.reduce((c, r) => c * (1 + r / 100), 1) - 1) * 100

export default function GunIci({
  gun, toplam, kalemler, para = 'TRY',
}: {
  gun: string
  toplam: PortfoyOlcumPerformans[]
  kalemler: VarlikOlcumPerformans[]
  para?: Para
}) {
  const dolar = para === 'USD'
  const bicim = dolar ? usd : tl
  const deger = (s: { deger_tl: string | null; deger_usd: string | null }) => Number((dolar ? s.deger_usd : s.deger_tl) ?? 0)
  const onceki = (s: { onceki_deger: string | null; onceki_deger_usd: string | null }) => {
    const v = dolar ? s.onceki_deger_usd : s.onceki_deger
    return v === null ? null : Number(v)
  }
  const akis = (s: { akis_tl: string | null; akis_usd: string | null }) => Number((dolar ? s.akis_usd : s.akis_tl) ?? 0)
  const adim = (s: { adim_yuzde: string | null; adim_yuzde_usd: string | null }) => Number((dolar ? s.adim_yuzde_usd : s.adim_yuzde) ?? 0)

  const olcumler = useMemo(
    () => toplam.filter((t) => t.tarih === gun).sort((a, b) => a.olcum_zamani.localeCompare(b.olcum_zamani)),
    [toplam, gun],
  )

  // Kalem bazinda: gunun ilk olcumu (gece farki) ve sonraki adimlar (gun ici).
  const kalemOzeti = useMemo(() => {
    const m = new Map<number, VarlikOlcumPerformans[]>()
    for (const k of kalemler) {
      if (k.tarih !== gun) continue
      m.set(k.varlik_id, [...(m.get(k.varlik_id) ?? []), k])
    }
    return [...m.values()]
      .map((satirlar) => {
        const s = satirlar.sort((a, b) => a.olcum_zamani.localeCompare(b.olcum_zamani))
        const son = s[s.length - 1]
        const gunIci = s.length >= 2 ? zincirle(s.slice(1).map(adim)) : null
        const gece = s[0].onceki_olcum ? adim(s[0]) : null
        const dunden = gece === null ? null : zincirle(s.map(adim))
        return { kod: son.kod, sinif: son.sinif, deger: deger(son), gunIci, dunden, nakit: son.kod === 'NAKIT' }
      })
      .sort((a, b) => b.deger - a.deger)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalemler, gun, dolar])

  const cizgi = olcumler.map((o) => ({ saat: saat(o.olcum_zamani), deger: deger(o) }))
  const ilk = olcumler[0]
  const son = olcumler[olcumler.length - 1]
  const gunIciToplam = olcumler.length >= 2 ? zincirle(olcumler.slice(1).map(adim)) : null

  if (olcumler.length === 0) {
    return (
      <p className="py-6 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        {tarihKisa(gun)} için ölçüm yok. Ölçümler 09:30, 15:30 ve 18:30&apos;da alınır; &quot;Fiyatları güncelle&quot; de bir ölçüm yazar.
      </p>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
          Gün içi ölçümler · {tarihKisa(gun)}
          <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            {olcumler.length} ölçüm · {dolar ? '$ bazında' : '₺ bazında'} · farklar para akışından arındırılmış
          </span>
        </p>
        {gunIciToplam !== null ? (
          <span className="rakam text-[17px] font-semibold" style={{ color: renk(gunIciToplam) }} title="Günün ilk ölçümünden son ölçümüne">
            {yuzdeMetni(gunIciToplam)} <span className="text-[11px] font-normal" style={{ color: 'var(--ink-muted)' }}>gün içi</span>
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>gün içi fark için ikinci ölçüm bekleniyor</span>
        )}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              <th className="py-1 font-normal">Saat</th>
              <th className="py-1 text-right font-normal">Değer</th>
              <th className="py-1 text-right font-normal">Fark</th>
              <th className="py-1 text-right font-normal">%</th>
              <th className="py-1 text-right font-normal">Akış</th>
              <th className="py-1 pl-3 font-normal">Neye göre</th>
            </tr>
          </thead>
          <tbody>
            {olcumler.map((o) => {
              const onc = onceki(o)
              const fark = onc === null ? null : deger(o) - onc - akis(o)
              const a = adim(o)
              const oncekiGun = o.onceki_olcum ? gunu(o.onceki_olcum) : null
              return (
                <tr key={o.olcum_zamani} style={{ borderTop: '1px solid var(--hair)' }}>
                  <td className="rakam py-1.5">{saat(o.olcum_zamani)}</td>
                  <td className="rakam py-1.5 text-right font-medium">{bicim(deger(o))}</td>
                  <td className="rakam py-1.5 text-right" style={{ color: fark === null ? 'var(--ink-muted)' : renk(fark) }}>
                    {fark === null ? '—' : `${fark > 0 ? '+' : ''}${bicim(fark)}`}
                  </td>
                  <td className="rakam py-1.5 text-right" style={{ color: onc === null ? 'var(--ink-muted)' : renk(a) }}>
                    {onc === null ? '—' : yuzdeMetni(a)}
                  </td>
                  <td className="rakam py-1.5 text-right" style={{ color: 'var(--ink-muted)' }}>
                    {akis(o) === 0 ? '' : `${akis(o) > 0 ? '+' : ''}${bicim(akis(o))}`}
                  </td>
                  <td className="py-1.5 pl-3 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    {!o.onceki_olcum ? 'ilk ölçüm' : oncekiGun === gun ? `${saat(o.onceki_olcum)} ölçümüne göre` : `${tarihKisa(oncekiGun)} ${saat(o.onceki_olcum)} (önceki gün) ölçümüne göre`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {cizgi.length >= 2 && (
        <div className="mt-3 h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cizgi} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="saat" tick={EKSEN_STILI} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
              <YAxis domain={['auto', 'auto']} tickFormatter={dolar ? eksenUSD : eksenTL} tick={EKSEN_STILI} tickLine={false} axisLine={false} width={64} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="kart px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)' }}>
                      <div className="font-medium">{String(label)}</div>
                      <div className="rakam">{bicim(Number(payload[0].value))}</div>
                    </div>
                  )
                }}
              />
              <Line type="monotone" dataKey="deger" stroke="var(--seri-1)" strokeWidth={2} dot isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Kalem bazinda: gece farki + gun ici */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              <th className="py-1 font-normal">Kalem</th>
              <th className="py-1 text-right font-normal">Son değer</th>
              <th className="py-1 text-right font-normal" title="Günün ilk ölçümünden son ölçümüne">Gün içi</th>
              <th className="py-1 text-right font-normal" title="Önceki günün son ölçümünden bugünün son ölçümüne">Dünden</th>
            </tr>
          </thead>
          <tbody>
            {kalemOzeti.map((k) => (
              <tr key={k.kod} style={{ borderTop: '1px solid var(--hair)' }}>
                <td className="py-1.5">
                  {k.kod} <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{SINIF_ETIKETI[k.sinif]}</span>
                </td>
                <td className="rakam py-1.5 text-right">{bicim(k.deger)}</td>
                <td className="rakam py-1.5 text-right" style={{ color: k.gunIci === null || k.nakit ? 'var(--ink-muted)' : renk(k.gunIci) }}>
                  {k.nakit ? 'getiri yok' : k.gunIci === null ? '—' : yuzdeMetni(k.gunIci)}
                </td>
                <td className="rakam py-1.5 text-right" style={{ color: k.dunden === null || k.nakit ? 'var(--ink-muted)' : renk(k.dunden) }}>
                  {k.nakit ? '' : k.dunden === null ? 'ilk gün' : yuzdeMetni(k.dunden)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ilk && son && ilk.olcum_zamani !== son.olcum_zamani && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Gün içi: {saat(ilk.olcum_zamani)} → {saat(son.olcum_zamani)}. Nakit getiri üretmez; değişimi para akışıdır.
          </p>
        )}
      </div>
    </div>
  )
}
