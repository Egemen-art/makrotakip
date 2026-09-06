import { supabaseSunucu } from '@/lib/supabase/server'
import type { HesapBakiye, PortfoyGetiri } from '@/lib/tipler'
import PortfoyGrafigi from '@/components/grafik/PortfoyGrafigi'
import PortfoyYonetimi from './PortfoyYonetimi'
import PortfoyDagilim from './PortfoyDagilim'
import { tarihKisa, tl, yuzde } from '@/lib/bicim'

export const dynamic = 'force-dynamic'

const say = (n: string | null | undefined) => Number(n ?? 0)

export default async function PortfoySayfasi() {
  const sb = await supabaseSunucu()
  const [{ data, error }, yk] = await Promise.all([
    sb.from('v_portfoy_getiri').select('*').order('tarih'),
    // Nakit on-dolumu: gorevin her sabah yazdigi YK "guncel bakiyesi" (karar 39).
    sb.from('hesap_bakiye').select('*').eq('hesap', 'YK').order('tarih', { ascending: false }).limit(1),
  ])
  const satirlar = (data ?? []) as PortfoyGetiri[]
  const ykBakiye = ((yk.data ?? [])[0] ?? null) as HesapBakiye | null
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

      <PortfoyDagilim satirlar={satirlar} />

      <PortfoyYonetimi satirlar={satirlar} ykBakiye={ykBakiye} />
    </>
  )
}
