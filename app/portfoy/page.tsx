import Link from 'next/link'
import { supabaseSunucu } from '@/lib/supabase/server'
import type {
  HareketKaydi, Para, PortfoyBugun, PortfoyOlcumPerformans, PortfoyPerformans, PortfoySinif,
  VarlikDeger, VarlikOlcumPerformans, VarlikPerformans,
} from '@/lib/tipler-varlik'
import { bugun } from '@/lib/bicim'
import { donemCoz } from '@/lib/donem'
import BugunkuPortfoy from '@/components/BugunkuPortfoy'
import DonemSecici from '@/components/DonemSecici'
import ParaAkislari from '@/components/ParaAkislari'
import ParaSecici from '@/components/ParaSecici'
import PortfoyPerformansGorunumu from '@/components/PortfoyPerformans'

export const dynamic = 'force-dynamic'

export default async function PortfoySayfasi({
  searchParams,
}: {
  searchParams: Promise<{ para?: string; donem?: string; gun?: string; bas?: string; bit?: string }>
}) {
  const { para: istenen, ...donemParam } = await searchParams
  const para: Para = istenen === 'USD' ? 'USD' : 'TRY'
  const gunBugun = bugun()
  const donem = donemCoz(donemParam, gunBugun)
  const sb = await supabaseSunucu()
  // Anlik goruntu tablosu (finans.portfoy) artik OKUNMUYOR: performans
  // bugunden itibaren gunluk olcumden (portfoy_gunluk) zincirlenir. Veri
  // silinmedi, yalnizca ekran degisti.
  const [bugunku, siniflar, degerler, toplam, kalemler, kur, gunToplam, gunKalemler, hareketler] = await Promise.all([
    sb.from('v_portfoy_bugun').select('*').limit(1),
    sb.from('v_portfoy_sinif').select('*'),
    sb.from('v_varlik_deger').select('*'),
    sb.from('v_portfoy_performans').select('*').order('tarih'),
    sb.from('v_varlik_performans').select('*').order('tarih'),
    // Bugunku degerleri dolara cevirmek icin gunun kuru (gecmis kendi kuruyla cevrilir).
    sb.from('kur_gunluk').select('tarih, usdtry').order('tarih', { ascending: false }).limit(1).maybeSingle(),
    // Gun gorunumu: secili gunun olcumleri (olcumden olcume zincir).
    donem.kod === 'gun'
      ? sb.from('v_portfoy_olcum_performans').select('*').eq('tarih', donem.gun).order('olcum_zamani')
      : Promise.resolve({ data: [], error: null }),
    donem.kod === 'gun'
      ? sb.from('v_varlik_olcum_performans').select('*').eq('tarih', donem.gun).order('olcum_zamani')
      : Promise.resolve({ data: [], error: null }),
    // Para akislari: hareketler + varligin kodu.
    sb.from('varlik_hareket').select('*, varlik(kod, sinif)').order('tarih', { ascending: false }).order('id', { ascending: false }).limit(500),
  ])
  const error = [bugunku.error, siniflar.error, degerler.error, toplam.error, kalemler.error, gunToplam.error, gunKalemler.error, hareketler.error].find(Boolean)
  const ozet = ((bugunku.data ?? [])[0] ?? null) as PortfoyBugun | null
  const usdtry = kur.data?.usdtry ? Number(kur.data.usdtry) : null
  const kurTarihi = kur.data?.tarih ?? null

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-semibold">Portföy</h1>
        <div className="flex items-center gap-3">
          <ParaSecici secili={para} yol="/portfoy" />
          <Link href="/portfoy/varliklar" className="text-[12px] font-medium" style={{ color: 'var(--seri-1)' }}>
            Varlıklar · adet bazlı →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Adet bazlı ölçüm: değer günde üç kez fiyattan hesaplanır (09:30 · 15:30 · 18:30), getiri para
        akışlarından arındırılmış günlük zincirdir (zaman ağırlıklı). &quot;Fiyatları güncelle&quot; ek ölçüm yazar.
      </p>
      <div className="mt-3">
        <DonemSecici donem={donem} para={para} bugun={gunBugun} />
      </div>

      {error && (
        <div className="kart mt-3 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>
          {error.message}
        </div>
      )}

      {ozet && ozet.kalem > 0 ? (
        <>
          <div className="mt-3">
            <BugunkuPortfoy
              ozet={ozet}
              siniflar={(siniflar.data ?? []) as PortfoySinif[]}
              para={para}
              usdtry={usdtry}
              kurTarihi={kurTarihi}
              performans={(toplam.data ?? []) as PortfoyPerformans[]}
            />
          </div>
          <div className="mt-4">
            <PortfoyPerformansGorunumu
              degerler={(degerler.data ?? []) as VarlikDeger[]}
              toplam={(toplam.data ?? []) as PortfoyPerformans[]}
              kalemler={(kalemler.data ?? []) as VarlikPerformans[]}
              donem={donem}
              gunIci={donem.kod === 'gun' ? {
                toplam: (gunToplam.data ?? []) as PortfoyOlcumPerformans[],
                kalemler: (gunKalemler.data ?? []) as VarlikOlcumPerformans[],
              } : undefined}
              para={para}
              usdtry={usdtry}
            />
          </div>
          <div className="mt-4">
            <ParaAkislari hareketler={(hareketler.data ?? []) as HareketKaydi[]} para={para} usdtry={usdtry} />
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
