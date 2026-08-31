import { supabaseSunucu } from '@/lib/supabase/server'
import type {
  AylikOzet, Islem, Kart, KategoriBant, KategoriSerisi, PortfoyGetiri, TaksitPlani, Taksonomi, Kural,
} from '@/lib/tipler'

/**
 * Proje Tokyo'da (ap-northeast-1); Turkiye'den gidis-donus ~250 ms.
 * Bu yuzden sayfa verisi TEK bir Promise.all icinde, paralel cekilir —
 * ardisik sorgu zinciri kurulmaz.
 */
export async function panoVerisi() {
  const sb = await supabaseSunucu()

  const [
    ozet, hafta, ay, yil, portfoy, kartlar, taksitler, sonIslemler, soruSayisi, bant,
  ] = await Promise.all([
    sb.from('v_aylik_ozet').select('*').order('ay'),
    sb.rpc('kategori_serisi', { p_bucket: 'hafta' }),
    sb.rpc('kategori_serisi', { p_bucket: 'ay' }),
    sb.rpc('kategori_serisi', { p_bucket: 'yil' }),
    sb.from('v_portfoy_getiri').select('*').order('tarih', { ascending: false }).limit(1),
    sb.from('kartlar').select('*').order('kod'),
    sb.from('taksit_plani').select('*').eq('durum', 'Aktif').order('aylik_tutar', { ascending: false }),
    sb.from('islemler').select('*').order('tarih', { ascending: false }).order('id', { ascending: false }).limit(15),
    sb.from('islemler').select('id', { count: 'exact', head: true }).eq('durum', 'Soruldu'),
    sb.from('v_kategori_bant').select('*'),
  ])

  return {
    ozet: (ozet.data ?? []) as AylikOzet[],
    seriler: {
      hafta: (hafta.data ?? []) as KategoriSerisi[],
      ay: (ay.data ?? []) as KategoriSerisi[],
      yil: (yil.data ?? []) as KategoriSerisi[],
    },
    portfoy: ((portfoy.data ?? [])[0] ?? null) as PortfoyGetiri | null,
    kartlar: (kartlar.data ?? []) as Kart[],
    taksitler: (taksitler.data ?? []) as TaksitPlani[],
    sonIslemler: (sonIslemler.data ?? []) as Islem[],
    soruSayisi: soruSayisi.count ?? 0,
    bant: (bant.data ?? []) as KategoriBant[],
    hatalar: [ozet, hafta, ay, yil, portfoy, kartlar, taksitler, sonIslemler, bant]
      .map((s) => s.error?.message)
      .filter(Boolean) as string[],
  }
}

export async function taksonomiListesi() {
  const sb = await supabaseSunucu()
  const { data } = await sb.from('taksonomi').select('*').order('kategori').order('alt_kategori')
  return (data ?? []) as Taksonomi[]
}

export async function kuralListesi() {
  const sb = await supabaseSunucu()
  const { data } = await sb.from('kural_seti').select('*').order('isabet', { ascending: false })
  return (data ?? []) as Kural[]
}
