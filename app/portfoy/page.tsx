import Link from 'next/link'
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
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-semibold">Portföy</h1>
        <Link href="/portfoy/varliklar" className="text-[12px] font-medium" style={{ color: 'var(--seri-1)' }}>
          Varlıklar · adet bazlı →
        </Link>
      </div>
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
