import { supabaseSunucu } from '@/lib/supabase/server'
import type { PortfoyGetiri } from '@/lib/tipler'
import PortfoyGrafigi from '@/components/grafik/PortfoyGrafigi'
import PortfoyYonetimi from './PortfoyYonetimi'
import { tarihKisa, tl, yuzde } from '@/lib/bicim'

export const dynamic = 'force-dynamic'

const say = (n: string | null | undefined) => Number(n ?? 0)

const KALEMLER: { anahtar: keyof PortfoyGetiri; ad: string }[] = [
  { anahtar: 'ppf', ad: 'PPF' },
  { anahtar: 'vadeli_mevduat', ad: 'Vadeli mevduat' },
  { anahtar: 'hisse_abd', ad: 'Hisse (ABD)' },
  { anahtar: 'hisse_bist', ad: 'Hisse (BİST)' },
  { anahtar: 'altin_fiziksel', ad: 'Altın (fiziksel)' },
  { anahtar: 'altin_etf', ad: 'Altın (ETF)' },
  { anahtar: 'nakit', ad: 'Nakit' },
  { anahtar: 'bes', ad: 'BES' },
]

export default async function PortfoySayfasi() {
  const sb = await supabaseSunucu()
  const { data, error } = await sb.from('v_portfoy_getiri').select('*').order('tarih')
  const satirlar = (data ?? []) as PortfoyGetiri[]
  const son = satirlar.at(-1)

  return (
    <>
      <h1 className="text-[17px] font-semibold">Portföy</h1>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Getiri Modified Dietz ile hesaplanır; para giriş/çıkışı yoksa alan 0 yazılır.
      </p>

      {error && (
        <div className="kart mt-3 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>
          {error.message}
        </div>
      )}

      {son && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="kart p-4">
            <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Toplam</div>
            <div className="mt-1 text-[22px] font-semibold">{tl(son.toplam_tl)}</div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              {tarihKisa(son.tarih)}
            </div>
          </div>
          <div className="kart p-4">
            <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Son dönem net getirisi</div>
            <div
              className="mt-1 text-[22px] font-semibold"
              style={{ color: say(son.net_getiri) >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)' }}
            >
              {son.net_getiri === null ? '—' : tl(son.net_getiri)}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              {son.getiri_yuzde === null ? 'önceki kayıt yok' : yuzde(Number(son.getiri_yuzde))}
            </div>
          </div>
          <div className="kart p-4">
            <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>USD/TRY</div>
            <div className="mt-1 text-[22px] font-semibold">
              {son.usdtry ? Number(son.usdtry).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '—'}
            </div>
          </div>
          <div className="kart p-4">
            <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Altın (gram, ₺)</div>
            <div className="mt-1 text-[22px] font-semibold">
              {son.altin_gram_tl ? tl(son.altin_gram_tl) : '—'}
            </div>
          </div>
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-[15px] font-semibold">Portföy toplamının seyri</h2>
        <div className="kart p-4">
          <PortfoyGrafigi
            veri={satirlar.map((s) => ({ tarih: s.tarih, toplam: say(s.toplam_tl) }))}
          />
        </div>
      </section>

      {son && (
        <section className="mt-6">
          <h2 className="mb-2 text-[15px] font-semibold">Son dağılım</h2>
          <div className="kart p-4">
            {KALEMLER.filter((k) => say(son[k.anahtar] as string) !== 0).map((k) => {
              const tutar = say(son[k.anahtar] as string)
              const pay = tutar / say(son.toplam_tl)
              return (
                <div key={k.anahtar} className="py-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>{k.ad}</span>
                    <span className="rakam text-[13px]">
                      {tl(tutar)}
                      <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {yuzde(pay)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--grid)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pay * 100}%`, background: 'var(--seri-1)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <PortfoyYonetimi satirlar={satirlar} />
    </>
  )
}
