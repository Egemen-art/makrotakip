import Link from 'next/link'
import { supabaseSunucu } from '@/lib/supabase/server'
import type {
  PortfoyBugun, PortfoyPerformans, PortfoySinif, VarlikDeger, VarlikPerformans,
} from '@/lib/tipler-varlik'
import BugunkuPortfoy from '@/components/BugunkuPortfoy'
import PortfoyPerformansGorunumu from '@/components/PortfoyPerformans'

export const dynamic = 'force-dynamic'

export default async function PortfoySayfasi() {
  const sb = await supabaseSunucu()
  // Anlik goruntu tablosu (finans.portfoy) artik OKUNMUYOR: performans
  // bugunden itibaren gunluk olcumden (portfoy_gunluk) zincirlenir. Veri
  // silinmedi, yalnizca ekran degisti.
  const [bugunku, siniflar, degerler, toplam, kalemler] = await Promise.all([
    sb.from('v_portfoy_bugun').select('*').limit(1),
    sb.from('v_portfoy_sinif').select('*'),
    sb.from('v_varlik_deger').select('*'),
    sb.from('v_portfoy_performans').select('*').order('tarih'),
    sb.from('v_varlik_performans').select('*').order('tarih'),
  ])
  const error = [bugunku.error, siniflar.error, degerler.error, toplam.error, kalemler.error].find(Boolean)
  const ozet = ((bugunku.data ?? [])[0] ?? null) as PortfoyBugun | null

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-semibold">Portföy</h1>
        <Link href="/portfoy/varliklar" className="text-[12px] font-medium" style={{ color: 'var(--seri-1)' }}>
          Varlıklar · adet bazlı →
        </Link>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Adet bazlı ölçüm: değer her gün fiyattan hesaplanır, getiri para akışlarından arındırılmış
        günlük zincirdir (zaman ağırlıklı). Ölçüm &quot;Fiyatları güncelle&quot; ile yazılır.
      </p>

      {error && (
        <div className="kart mt-3 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>
          {error.message}
        </div>
      )}

      {ozet && ozet.kalem > 0 ? (
        <>
          <div className="mt-3">
            <BugunkuPortfoy ozet={ozet} siniflar={(siniflar.data ?? []) as PortfoySinif[]} />
          </div>
          <div className="mt-4">
            <PortfoyPerformansGorunumu
              degerler={(degerler.data ?? []) as VarlikDeger[]}
              toplam={(toplam.data ?? []) as PortfoyPerformans[]}
              kalemler={(kalemler.data ?? []) as VarlikPerformans[]}
            />
          </div>
        </>
      ) : (
        <p className="kart mt-3 p-6 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Henüz varlık yok. <Link href="/portfoy/varliklar" style={{ color: 'var(--seri-1)' }}>Varlıklar</Link> ekranından başla.
        </p>
      )}
    </>
  )
}
