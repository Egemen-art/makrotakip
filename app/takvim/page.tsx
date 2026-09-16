import { supabaseSunucu } from '@/lib/supabase/server'
import { bugun } from '@/lib/bicim'
import { gunEkle } from '@/lib/donem'
import TakvimListesi, { type TakvimSatiri } from '@/components/TakvimListesi'

export const dynamic = 'force-dynamic'

export default async function TakvimSayfasi() {
  const sb = await supabaseSunucu()
  const gunBugun = bugun()
  const { data, error } = await sb
    .from('takvim').select('*')
    .gte('tarih', gunEkle(gunBugun, -1)).lte('tarih', gunEkle(gunBugun, 120))
    .order('tarih').order('saat')
  return (
    <>
      <h1 className="text-[17px] font-semibold">Ekonomik takvim</h1>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Önümüzdeki 120 gün: TCMB ve Fed faiz kararları, enflasyon, istihdam, PMI ve diğer önemli veriler.
      </p>
      {error && (
        <div className="kart mt-3 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>{error.message}</div>
      )}
      <div className="kart mt-3 p-4">
        <TakvimListesi satirlar={(data ?? []) as TakvimSatiri[]} bugun={gunBugun} baglanti={false} />
      </div>
    </>
  )
}
