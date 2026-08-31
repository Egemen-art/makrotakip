import { supabaseSunucu } from '@/lib/supabase/server'
import type { Islem, Kural, Taksonomi } from '@/lib/tipler'
import { onerileriUret, desenUret } from '@/lib/oneri'
import SoruKarti from './SoruKarti'

export const dynamic = 'force-dynamic'

export default async function SorularSayfasi() {
  const sb = await supabaseSunucu()

  // Tek turda paralel — Tokyo gidis-donusu bir kez odenir.
  const [bekleyen, kurallar, gecmis, taksonomi] = await Promise.all([
    sb.from('islemler').select('*').eq('durum', 'Soruldu')
      .order('tarih', { ascending: false }).order('id', { ascending: false }),
    sb.from('kural_seti').select('*'),
    sb.from('islemler').select('*').neq('durum', 'Soruldu')
      .order('tarih', { ascending: false }).limit(400),
    sb.from('taksonomi').select('*'),
  ])

  const sorular = (bekleyen.data ?? []) as Islem[]
  const kuralListesi = (kurallar.data ?? []) as Kural[]
  const gecmisListesi = (gecmis.data ?? []) as Islem[]
  const taksonomiListesi = (taksonomi.data ?? []) as Taksonomi[]

  const hata = bekleyen.error?.message ?? kurallar.error?.message

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-semibold">Soru kutusu</h1>
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          {sorular.length} bekleyen işlem
        </span>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Bir seçeneğe dokun: işlem onaylanır ve aynı mağaza için kalıcı kural yazılır.
      </p>

      {hata && (
        <div className="kart mt-4 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>
          Veri çekilemedi: {hata}
        </div>
      )}

      {sorular.length === 0 && (
        <div className="kart mt-5 p-8 text-center">
          <p className="text-[14px] font-medium">Bekleyen soru yok.</p>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            Sabahki görev sınıflandıramadığı bir harcama bulursa burada belirir.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {sorular.map((islem) => (
          <SoruKarti
            key={islem.id}
            islem={islem}
            oneriler={onerileriUret(islem, kuralListesi, gecmisListesi, taksonomiListesi)}
            varsayilanDesen={desenUret(islem.aciklama)}
            taksonomi={taksonomiListesi}
          />
        ))}
      </div>
    </>
  )
}
