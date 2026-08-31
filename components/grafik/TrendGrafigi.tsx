'use client'

import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { donemEtiket } from '@/lib/bicim'
import { EKSEN_STILI, Ipucu, eksenTL, ustSinir } from './ortak'

export type TrendSatiri = { ay: string; gider: number; gelir: number; aktarim: number }

/**
 * Aylik gider / gelir / aktarim.
 * Aktarim (Transfer) toplamlara girmez ama GORUNUR kalir: yatirima 30.000
 * aktarmak ile 30.000 harcamak ayni sey degil, tablo bunu gostermeli.
 */
export default function TrendGrafigi({ veri }: { veri: TrendSatiri[] }) {
  const enBuyuk = Math.max(0, ...veri.flatMap((s) => [s.gider, s.gelir, s.aktarim]))
  const tavan = ustSinir(enBuyuk)

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={veri} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="ay"
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
          <Tooltip
            content={<Ipucu />}
            cursor={{ fill: 'var(--grid)', opacity: 0.45 }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="circle"
            iconSize={8}
            formatter={(deger) => (
              <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>{deger}</span>
            )}
          />
          <Bar dataKey="gider" name="Gider" fill="var(--seri-2)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="gelir" name="Gelir" fill="var(--seri-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="aktarim" name="Aktarım" fill="var(--seri-3)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
