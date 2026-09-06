'use client'

import { useMemo, useState } from 'react'
import type { PortfoyGetiri } from '@/lib/tipler'
import { tarihKisa, tl, yuzde } from '@/lib/bicim'
import { SecimGrubu } from '@/components/grafik/ortak'
import PortfoyGrafigi from '@/components/grafik/PortfoyGrafigi'
import PortfoyDagilim from './PortfoyDagilim'
import { bicimle, cevir, dietz, type Para } from '@/lib/portfoy'

/**
 * Portfoy analizi tek bir para anahtarina bagli: ozet kartlari, toplam seyri,
 * dagilim ve secili kalemin paneli birlikte ₺ ya da $ olur. USD'de her anlik
 * goruntu KENDI gunundeki kurla cevrilir — bugunku kurla gecmis yeniden
 * degerlenmez; getiri de o gunku kurlarla Modified Dietz'dir.
 */
export default function PortfoyAnaliz({ satirlar }: { satirlar: PortfoyGetiri[] }) {
  const [para, setPara] = useState<Para>('TRY')
  const sirali = useMemo(() => [...satirlar].sort((a, b) => a.tarih.localeCompare(b.tarih)), [satirlar])
  const son = sirali.at(-1)
  if (!son) return null
  const b = bicimle(para)
  const i = sirali.length - 1
  const toplam = cevir(Number(son.toplam_tl), son, para)
  const g = dietz(sirali, i, para)
  const diger = dietz(sirali, i, para === 'TRY' ? 'USD' : 'TRY')
  const kurYok = para === 'USD' && sirali.some((s) => !(Number(s.usdtry ?? 0) > 0))

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          {para === 'USD'
            ? 'Dolar bazında · her kayıt kendi günündeki USD/TRY kuruyla'
            : 'TL bazında'}
          {kurYok && <span style={{ color: 'var(--ciddi)' }}> · bazı kayıtlarda kur yok, o noktalar boş</span>}
        </span>
        <SecimGrubu<Para>
          secenekler={[{ deger: 'TRY', ad: '₺ TL' }, { deger: 'USD', ad: '$ Dolar' }]}
          deger={para} degistir={setPara} etiket="Para birimi"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kart etiket="Toplam" deger={toplam === null ? '—' : b(toplam)} alt={tarihKisa(son.tarih)} />
        <Kart
          etiket="Son dönem net getirisi"
          deger={g.net === null ? '—' : b(g.net)}
          renk={g.net === null ? undefined : g.net >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)'}
          alt={
            g.yuzde === null
              ? (sirali.length < 2 ? 'önceki kayıt yok' : 'kur eksik')
              : `${yuzde(g.yuzde)}${diger.yuzde !== null ? ` · ${para === 'TRY' ? '$' : '₺'} bazında ${yuzde(diger.yuzde)}` : ''}`
          }
        />
        <Kart etiket="USD/TRY" deger={son.usdtry ? Number(son.usdtry).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '—'} alt="son kayıttaki kur" />
        <Kart etiket="Altın (gram, ₺)" deger={son.altin_gram_tl ? tl(son.altin_gram_tl) : '—'} alt="son kayıttaki fiyat" />
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-[15px] font-semibold">Portföy toplamının seyri</h2>
        <div className="kart p-4">
          <PortfoyGrafigi
            para={para}
            veri={sirali
              .map((s) => ({ tarih: s.tarih, toplam: cevir(Number(s.toplam_tl), s, para) }))
              .filter((v): v is { tarih: string; toplam: number } => v.toplam !== null)}
          />
        </div>
      </section>

      <PortfoyDagilim satirlar={sirali} para={para} />
    </>
  )
}

function Kart({ etiket, deger, alt, renk }: { etiket: string; deger: string; alt?: string; renk?: string }) {
  return (
    <div className="kart p-4">
      <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{etiket}</div>
      <div className="rakam mt-1 text-[22px] font-semibold" style={{ color: renk ?? 'var(--ink)' }}>{deger}</div>
      {alt && <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{alt}</div>}
    </div>
  )
}
