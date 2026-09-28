'use client'

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TaksitAyi } from '@/lib/taksit'
import { donemEtiket, tl, tlKurus } from '@/lib/bicim'
import { EKSEN_STILI, eksenTL, ustSinir } from './grafik/ortak'

/**
 * AYLIK TAKSIT DAGILIMI. Her ay bir sutun; sutun ODENEN ve KALAN olarak
 * yigilir, yani hem arkana baktiginda ne odedigini hem oniine baktiginda ne
 * kaldigini ayni eksende gorursun (iki ayri olcek DEGIL — ikisi de TL).
 * Bugunun ayi dikey cizgiyle isaretlenir.
 *
 * Renkler kimlige bagli: odenen daima seri-1, kalan daima seri-2. Ay secimi ya
 * da plan sayisi degisince renkler yer degistirmez.
 */

const ODENEN = 'var(--seri-1)'
const KALAN = 'var(--seri-2)'

const YUK_RENGI: Record<string, string> = {
  'Kendi gideri': 'var(--seri-1)',
  'Şirket ödüyor': 'var(--iyi)',
  'Kişi ödüyor': 'var(--seri-5)',
  Belirsiz: 'var(--uyari)',
}

export default function TaksitDagilimi({ aylar, buAy }: { aylar: TaksitAyi[]; buAy: string }) {
  if (aylar.length === 0) {
    return (
      <p className="kart p-6 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Taksit planı yok.
      </p>
    )
  }

  const odenenToplam = aylar.reduce((t, a) => t + a.odenen, 0)
  const kalanToplam = aylar.reduce((t, a) => t + a.kalan, 0)
  const enYuklu = aylar.reduce((e, a) => (a.odenen + a.kalan > e.odenen + e.kalan ? a : e))
  const tavan = ustSinir(Math.max(...aylar.map((a) => a.odenen + a.kalan)))
  const buAyVar = aylar.some((a) => a.ay === buAy)

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-semibold">Aylık taksit dağılımı</h2>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Plandan türetildi: defter yalnızca takip başladıktan sonrasını taşıyor, plan ilk
          taksit ayından itibaren tüm takvimi biliyor.
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
        <span style={{ color: 'var(--ink-2)' }}>
          Bugüne kadar ödenen <span className="rakam ml-1 font-semibold" style={{ color: 'var(--ink)' }}>{tl(odenenToplam)}</span>
        </span>
        <span style={{ color: 'var(--ink-2)' }}>
          Kalan <span className="rakam ml-1 font-semibold" style={{ color: 'var(--ink)' }}>{tl(kalanToplam)}</span>
        </span>
        <span style={{ color: 'var(--ink-2)' }}>
          En yüklü ay{' '}
          <span className="rakam ml-1 font-semibold" style={{ color: 'var(--ink)' }}>
            {donemEtiket(enYuklu.ay)} · {tl(enYuklu.odenen + enYuklu.kalan)}
          </span>
        </span>
      </div>

      {/* Efsane duz HTML: Recharts 3'te Legend sirasi yigin sirasina bagli ve
          ters donuyor; okuma sirasi once odenen, sonra kalan. */}
      <div className="mt-3 flex items-center gap-4 text-[12px]">
        {[{ ad: 'Ödenen', renk: ODENEN }, { ad: 'Kalan', renk: KALAN }].map((s) => (
          <span key={s.ad} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: s.renk }} />
            <span style={{ color: 'var(--ink-2)' }}>{s.ad}</span>
          </span>
        ))}
      </div>

      <div className="mt-2 h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={aylar} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="ay"
              tickFormatter={(a) => donemEtiket(String(a))}
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
            <Tooltip content={<AyIpucu />} cursor={{ fill: 'var(--grid)', opacity: 0.45 }} />
            {buAyVar && (
              <ReferenceLine
                x={buAy}
                stroke="var(--axis)"
                strokeDasharray="3 3"
                label={{ value: 'bu ay', position: 'top', fill: 'var(--ink-muted)', fontSize: 11 }}
              />
            )}
            {/* Yigin: surface renginde 2px cizgi iki dilim arasinda bosluk birakir. */}
            <Bar dataKey="odenen" name="Ödenen" stackId="a" fill={ODENEN}
              stroke="var(--surface)" strokeWidth={2} maxBarSize={26} />
            <Bar dataKey="kalan" name="Kalan" stackId="a" fill={KALAN}
              stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Ayin sutununa gelince: toplam, odenen/kalan ve o ayi olusturan taksitler. */
function AyIpucu({ active, payload }: { active?: boolean; payload?: { payload?: TaksitAyi }[] }) {
  const a = payload?.[0]?.payload
  if (!active || !a) return null
  const toplam = a.odenen + a.kalan

  return (
    <div className="kart max-w-[300px] px-3 py-2 text-[12px] shadow-lg" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
      <div className="flex items-baseline gap-3">
        <span className="font-medium">{donemEtiket(a.ay)}</span>
        <span className="rakam ml-auto font-semibold">{tlKurus(toplam)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
        {a.odenen > 0 && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: ODENEN }} />
            <span style={{ color: 'var(--ink-2)' }}>Ödenen</span>
            <span className="rakam">{tlKurus(a.odenen)}</span>
          </span>
        )}
        {a.kalan > 0 && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: KALAN }} />
            <span style={{ color: 'var(--ink-2)' }}>Kalan</span>
            <span className="rakam">{tlKurus(a.kalan)}</span>
          </span>
        )}
      </div>
      <ul className="mt-1.5 border-t pt-1.5 text-[11px]" style={{ borderColor: 'var(--hair)' }}>
        {a.kalemler.map((k) => (
          <li key={`${k.urun}-${k.no}`} className="flex items-baseline gap-1.5">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 shrink-0 self-center rounded-full"
              style={{ background: YUK_RENGI[k.yukSahibi] ?? 'var(--axis)' }}
              title={k.yukSahibi}
            />
            <span className="truncate" style={{ color: k.odendi ? 'var(--ink-2)' : 'var(--ink-muted)' }}>
              {k.urun}
            </span>
            <span className="rakam shrink-0 text-[10px]" style={{ color: 'var(--ink-muted)' }}>
              {k.no}/{k.taksitSayisi}
            </span>
            <span className="rakam ml-auto shrink-0">{tlKurus(k.tutar)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px]" style={{ color: 'var(--ink-muted)' }}>Nokta rengi yük sahibi</p>
    </div>
  )
}
