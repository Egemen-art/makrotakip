import Link from 'next/link'
import { supabaseSunucu } from '@/lib/supabase/server'
import type { Varlik, VarlikDeger, VarlikHareket } from '@/lib/tipler-varlik'
import VarlikYonetimi from './VarlikYonetimi'

export const dynamic = 'force-dynamic'

export default async function VarliklarSayfasi() {
  const sb = await supabaseSunucu()
  const [varliklar, degerler, hareketler] = await Promise.all([
    sb.from('varlik').select('*').order('sinif').order('kod'),
    sb.from('v_varlik_deger').select('*'),
    sb.from('varlik_hareket').select('*').order('tarih', { ascending: false }).order('id', { ascending: false }).limit(50),
  ])

  const hata = [varliklar.error, degerler.error, hareketler.error].find(Boolean)

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-semibold">Varlıklar</h1>
        <Link href="/portfoy" className="text-[12px]" style={{ color: 'var(--seri-1)' }}>
          ← Portföy geçmişi
        </Link>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Adet gir, değeri uygulama ölçsün. Hisse ve fon fiyatı kaynağından okunur; BES ve
        vadeli mevduat gibi kaynağı olmayan kalemlerin değeri elle yazılır.
      </p>

      {hata && (
        <div className="kart mt-3 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>
          {hata.message}
        </div>
      )}

      <VarlikYonetimi
        varliklar={(varliklar.data ?? []) as Varlik[]}
        degerler={(degerler.data ?? []) as VarlikDeger[]}
        hareketler={(hareketler.data ?? []) as VarlikHareket[]}
      />
    </>
  )
}
