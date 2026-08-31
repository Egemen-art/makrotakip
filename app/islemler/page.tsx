import { supabaseSunucu } from '@/lib/supabase/server'
import type { Islem, Taksonomi } from '@/lib/tipler'
import { DURUMLAR, TIPLER } from '@/lib/tipler'
import IslemTablosu from './IslemTablosu'
import Filtreler from './Filtreler'
import ArsivTablosu from './ArsivTablosu'

export const dynamic = 'force-dynamic'

const SAYFA_BOYU = 100

type Arama = {
  q?: string; kategori?: string; hesap?: string; tip?: string; durum?: string
  baslangic?: string; bitis?: string; bolum?: string; sayfa?: string
}

export default async function IslemlerSayfasi({
  searchParams,
}: {
  searchParams: Promise<Arama>
}) {
  const f = await searchParams
  const arsivMi = f.bolum === 'arsiv'
  const sayfa = Math.max(1, Number(f.sayfa ?? 1) || 1)
  const bas = (sayfa - 1) * SAYFA_BOYU

  const sb = await supabaseSunucu()

  // Arsivde aciklama null; listede kategoriye dusuluyor (bkz. ArsivTablosu).
  let sorgu = arsivMi
    ? sb.from('arsiv_islemler').select('*', { count: 'exact' })
    : sb.from('islemler').select('*', { count: 'exact' })

  if (f.q) {
    const desen = `%${f.q}%`
    sorgu = arsivMi
      ? sorgu.or(`kategori.ilike.${desen},alt_kategori.ilike.${desen},not_.ilike.${desen}`)
      : sorgu.or(`aciklama.ilike.${desen},kategori.ilike.${desen},alt_kategori.ilike.${desen},not_.ilike.${desen}`)
  }
  if (f.kategori) sorgu = sorgu.eq('kategori', f.kategori)
  if (f.hesap) sorgu = sorgu.eq('hesap', f.hesap)
  if (f.tip) sorgu = sorgu.eq('tip', f.tip)
  if (f.durum && !arsivMi) sorgu = sorgu.eq('durum', f.durum)
  if (f.baslangic) sorgu = sorgu.gte('tarih', f.baslangic)
  if (f.bitis) sorgu = sorgu.lte('tarih', f.bitis)

  const [liste, taksonomi, hesapSatirlari] = await Promise.all([
    sorgu
      .order('tarih', { ascending: false })
      .order('id', { ascending: false })
      .range(bas, bas + SAYFA_BOYU - 1),
    sb.from('taksonomi').select('*'),
    sb.from('islemler').select('hesap'),
  ])

  const kayitlar = (liste.data ?? []) as Islem[]
  const toplam = liste.count ?? 0
  const taksonomiListesi = (taksonomi.data ?? []) as Taksonomi[]
  const hesaplar = [
    ...new Set(((hesapSatirlari.data ?? []) as { hesap: string | null }[])
      .map((h) => h.hesap).filter((h): h is string => !!h)),
  ].sort()
  const kategoriler = [...new Set(taksonomiListesi.map((t) => t.kategori))]

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-semibold">İşlemler</h1>
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          {toplam.toLocaleString('tr-TR')} kayıt
          {toplam > SAYFA_BOYU && ` · sayfa ${sayfa}/${Math.ceil(toplam / SAYFA_BOYU)}`}
        </span>
      </div>

      <Filtreler
        kategoriler={kategoriler}
        hesaplar={hesaplar}
        tipler={[...TIPLER]}
        durumlar={[...DURUMLAR]}
        arsivMi={arsivMi}
      />

      {liste.error && (
        <div className="kart mt-3 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>
          {liste.error.message}
        </div>
      )}

      {arsivMi ? (
        <ArsivTablosu kayitlar={kayitlar} />
      ) : (
        <IslemTablosu kayitlar={kayitlar} taksonomi={taksonomiListesi} hesaplar={hesaplar} />
      )}

      {toplam > SAYFA_BOYU && <Sayfalama sayfa={sayfa} toplam={toplam} boyut={SAYFA_BOYU} f={f} />}
    </>
  )
}

function Sayfalama({
  sayfa, toplam, boyut, f,
}: {
  sayfa: number; toplam: number; boyut: number; f: Arama
}) {
  const sonSayfa = Math.ceil(toplam / boyut)
  const baglanti = (n: number) => {
    const p = new URLSearchParams(
      Object.entries(f).filter(([, v]) => v) as [string, string][],
    )
    p.set('sayfa', String(n))
    return `/islemler?${p.toString()}`
  }
  return (
    <nav className="mt-4 flex items-center justify-center gap-3 text-[13px]">
      {sayfa > 1 && <a href={baglanti(sayfa - 1)} style={{ color: 'var(--seri-1)' }}>← Önceki</a>}
      <span style={{ color: 'var(--ink-muted)' }}>{sayfa} / {sonSayfa}</span>
      {sayfa < sonSayfa && <a href={baglanti(sayfa + 1)} style={{ color: 'var(--seri-1)' }}>Sonraki →</a>}
    </nav>
  )
}
