'use client'

import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { donemEtiket } from '@/lib/bicim'
import { EKSEN_STILI, Ipucu, SecimGrubu, eksenTL, ustSinir } from './ortak'
import { useAyOdagi } from './AyOdagi'

export type TrendSatiri = { ay: string; gider: number; gelir: number; aktarim: number }

/** 0 = tum aylar. */
type Aralik = '6' | '12' | '0'
const ARALIKLAR: { deger: Aralik; ad: string }[] = [
  { deger: '6', ad: '6 ay' },
  { deger: '12', ad: '12 ay' },
  { deger: '0', ad: 'Tümü' },
]

/**
 * Aylik gider / gelir / aktarim.
 * Aktarim (Transfer) toplamlara girmez ama GORUNUR kalir: yatirima 30.000
 * aktarmak ile 30.000 harcamak ayni sey degil, tablo bunu gostermeli.
 *
 * `veri` TUM aylari tasir; aralik burada, istemcide kesilir — sunucuya
 * yeniden gitmeden 6 / 12 / tum aylar arasinda gecilir.
 */
export default function TrendGrafigi({ veri }: { veri: TrendSatiri[] }) {
  const [aralik, setAralik] = useState<Aralik>('12')
  // Ay odagi: uzerine gelinen ay asagidaki kategori pastasina gecer, tiklanan ay sabitlenir.
  const { sabit, odakla, sabitle } = useAyOdagi()
  const adet = Number(aralik)
  const gorunen = adet > 0 ? veri.slice(-adet) : veri

  const enBuyuk = Math.max(0, ...gorunen.flatMap((s) => [s.gider, s.gelir, s.aktarim]))
  const tavan = ustSinir(enBuyuk)
  const ilk = gorunen[0]?.ay
  const son = gorunen.at(-1)?.ay

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          {ilk && son && ilk !== son
            ? `${donemEtiket(ilk)} – ${donemEtiket(son)} · ${gorunen.length} ay`
            : ilk ? donemEtiket(ilk) : ''}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            {sabit ? `${donemEtiket(sabit)} sabit · tekrar tıkla, bırak` : 'Aya gel: kategori pastası o ayı gösterir · tıkla: sabitle'}
          </span>
          <SecimGrubu secenekler={ARALIKLAR} deger={aralik} degistir={setAralik} etiket="Aralık" />
        </span>
      </div>

      {/* Fareyle tiklayinca cikan odak cercevesi gizlenir; klavyeyle gezinirken (focus-visible) kalir. */}
      <div className="h-[260px] w-full [&_*:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={gorunen} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2}
            onMouseMove={(d) => odakla(d?.activeLabel ? String(d.activeLabel) : null)}
            onMouseLeave={() => odakla(null)}
            onClick={(d) => {
              const i = typeof d?.activeTooltipIndex === 'number' ? d.activeTooltipIndex : Number(d?.activeTooltipIndex)
              const ay = Number.isInteger(i) && gorunen[i] ? gorunen[i].ay : d?.activeLabel ? String(d.activeLabel) : null
              if (ay) sabitle(ay)
            }}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="ay"
              tickFormatter={donemEtiket}
              tick={EKSEN_STILI}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              interval={gorunen.length > 14 ? 'preserveStartEnd' : 0}
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
            {/* Sabitlenen ay varsa digerleri soluklasir: pastanin hangi ayi gosterdigi grafikte de gorunur. */}
            {([['gider', 'Gider', 'var(--seri-2)'], ['gelir', 'Gelir', 'var(--seri-1)'], ['aktarim', 'Aktarım', 'var(--seri-3)']] as const).map(([k, ad, renk]) => (
              <Bar key={k} dataKey={k} name={ad} fill={renk} radius={[4, 4, 0, 0]} maxBarSize={22}>
                {gorunen.map((s) => (
                  <Cell key={s.ay} fill={renk} fillOpacity={sabit && sabit !== s.ay ? 0.35 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
