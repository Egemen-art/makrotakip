import { supabaseSunucu } from '@/lib/supabase/server'
import type { Nakit, PortfoyGetiri } from '@/lib/tipler'
import PortfoyYonetimi from './PortfoyYonetimi'
import PortfoyAnaliz from './PortfoyAnaliz'

export const dynamic = 'force-dynamic'

export default async function PortfoySayfasi() {
  const sb = await supabaseSunucu()
  const [{ data, error }, nk] = await Promise.all([
    sb.from('v_portfoy_getiri').select('*').order('tarih'),
    // Nakit elle girilmez: karar 49'un anlik nakti (YK guncel bakiyesi + eldeki nakit).
    sb.from('v_nakit').select('*').limit(1),
  ])
  const satirlar = (data ?? []) as PortfoyGetiri[]
  const nakit = ((nk.data ?? [])[0] ?? null) as Nakit | null

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

      <PortfoyAnaliz satirlar={satirlar} />

      <PortfoyYonetimi satirlar={satirlar} nakit={nakit} />
    </>
  )
}
