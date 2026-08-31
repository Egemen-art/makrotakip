'use client'

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { tarihKisa } from '@/lib/bicim'
import { EKSEN_STILI, Ipucu, eksenTL, ustSinir } from './ortak'

/** Portfoy toplaminin seyri. Tek seri -> lejant yok, basligi zaten adlandiriyor. */
export default function PortfoyGrafigi({
  veri,
}: {
  veri: { tarih: string; toplam: number }[]
}) {
  if (veri.length < 2) {
    return (
      <p className="py-10 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Grafik için en az iki anlık görüntü gerekiyor.
      </p>
    )
  }
  const tavan = ustSinir(Math.max(...veri.map((v) => v.toplam)))

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={veri} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="portfoyDolgu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--seri-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--seri-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="tarih" tickFormatter={tarihKisa} tick={EKSEN_STILI}
            tickLine={false} axisLine={{ stroke: 'var(--axis)' }}
          />
          <YAxis
            tickFormatter={eksenTL} tick={EKSEN_STILI} tickLine={false}
            axisLine={false} width={58} domain={[0, tavan]}
          />
          <Tooltip
            content={<Ipucu donemMi={false} />}
            labelFormatter={(d) => tarihKisa(String(d))}
            cursor={{ stroke: 'var(--axis)' }}
          />
          <Area
            type="monotone" dataKey="toplam" name="Portföy toplamı"
            stroke="var(--seri-1)" strokeWidth={2} fill="url(#portfoyDolgu)"
            dot={{ r: 4, fill: 'var(--seri-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
