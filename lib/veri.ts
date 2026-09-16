import { supabaseSunucu } from '@/lib/supabase/server'
import type {
  AylikKategori, AylikOzet, Islem, Kart, KategoriBant, KategoriSerisi, Nakit, PortfoyGetiri, TaksitPlani, Taksonomi, Kural,
} from '@/lib/tipler'
import type { PortfoyBugun, PortfoyPerformans, VarlikDeger, VarlikGetiri } from '@/lib/tipler-varlik'
import type { EnflasyonSatiri } from '@/lib/enflasyon'
import type { TakvimSatiri } from '@/components/TakvimListesi'
import { bugun } from '@/lib/bicim'
import { gunEkle } from '@/lib/donem'

/**
 * Proje Frankfurt'ta (eu-central-1) ve Vercel fonksiyonlari da `fra1`'de.
 * Sayfa verisi yine TEK bir Promise.all icinde paralel cekilir — ardisik
 * sorgu zinciri kurulmaz, her ek tur gecikmeye dogrudan biniyor.
 */
/**
 * @param seciliAy Panoda secili ay, 'YYYY-MM'. Ozet ve seriler TUM aylari tasir (ay
 *   secimi istemcide/sunucuda ayni veriden yapilir); yalniz sapma bandi bu aya
 *   gore kurulur — olculen ay bandin DISINDA kalir (kararlar > "Sapma olcusu").
 */
export async function panoVerisi(seciliAy: string) {
  const sb = await supabaseSunucu()

  const [
    ozet, hafta, ay, yil, portfoy, kartlar, taksitler, sonIslemler, soruSayisi, bant, altKategoriler, nakit, portfoyBugun,
    varlikDegerleri, varlikGetirileri, sonKur, taksitPlanlari, taksitYazilanlar, enflasyon, portfoyZinciri, abdFaiz, trFaiz, takvim,
  ] = await Promise.all([
    sb.from('v_aylik_ozet').select('*').order('ay'),
    sb.rpc('kategori_serisi', { p_bucket: 'hafta' }),
    sb.rpc('kategori_serisi', { p_bucket: 'ay' }),
    sb.rpc('kategori_serisi', { p_bucket: 'yil' }),
    sb.from('v_portfoy_getiri').select('*').order('tarih', { ascending: false }).limit(1),
    sb.from('kartlar').select('*').order('kod'),
    // Bitmemis tum planlar (Dogrulanmadi dahil — o da kesimde yazilacak; ekranda isaretlenir).
    sb.from('taksit_plani').select('*').neq('durum', 'Bitti').order('aylik_tutar', { ascending: false }),
    sb.from('islemler').select('*').order('tarih', { ascending: false }).order('id', { ascending: false }).limit(15),
    sb.from('islemler').select('id', { count: 'exact', head: true }).eq('durum', 'Soruldu'),
    sb.rpc('kategori_bant', { ref_ay: seciliAy }),
    sb.from('v_aylik_kategori').select('ay,yon,kategori,alt,toplam,adet'),
    // Anlik nakit (karar 49). Aya bagli degil: hangi ay secili olursa olsun BUGUNKU nakit.
    sb.from('v_nakit').select('*').limit(1),
    // Adet bazli guncel portfoy; anlik goruntu tablosunun yerini almaz.
    sb.from('v_portfoy_bugun').select('*').limit(1),
    // Kalem bazinda anlik deger ve gunluk yuzde (pano ustundeki varlik seridi).
    sb.from('v_varlik_deger').select('*'),
    sb.from('v_varlik_getiri').select('*'),
    // Gunun kuru: varlik seridinin dolar gorunumu bununla cevrilir.
    sb.from('kur_gunluk').select('tarih, usdtry').order('tarih', { ascending: false }).limit(1).maybeSingle(),
    // Gidere henuz yansimayan taksitler: bitmemis tum planlar + deftere yazilmis taksit satirlari.
    sb.from('taksit_plani').select('*'),
    sb.from('islemler').select('id, taksit_plan_id, taksit_no, tarih, tutar').not('taksit_plan_id', 'is', null),
    // Enflasyon (karar 53): kur seridi kutulari ve baslangictan beri reel.
    sb.from('v_enflasyon').select('*').order('ay'),
    sb.from('v_portfoy_performans').select('*').order('tarih'),
    // ABD faizleri (FRED): 10Y, 2Y, Fed araligi — kur seridi kutulari ve donem farki.
    sb.from('abd_faiz').select('seri, tarih, deger').order('tarih'),
    // Turkiye faizleri: TCMB politika (degisiklik tarihleri), TR 10Y / 2Y gosterge tahvil.
    sb.from('tr_faiz').select('seri, tarih, deger').order('tarih'),
    // Yaklasan onemli tarihler (14 gun).
    sb.from('takvim').select('*').gte('tarih', bugun()).lte('tarih', gunEkle(bugun(), 14)).order('tarih').order('saat'),
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
    altKategoriler: (altKategoriler.data ?? []) as AylikKategori[],
    nakit: ((nakit.data ?? [])[0] ?? null) as Nakit | null,
    portfoyBugun: ((portfoyBugun.data ?? [])[0] ?? null) as PortfoyBugun | null,
    varlikDegerleri: (varlikDegerleri.data ?? []) as VarlikDeger[],
    varlikGetirileri: (varlikGetirileri.data ?? []) as VarlikGetiri[],
    sonKur: sonKur.data ? { tarih: sonKur.data.tarih as string, usdtry: Number(sonKur.data.usdtry) } : null,
    taksitPlanlari: (taksitPlanlari.data ?? []) as TaksitPlani[],
    taksitYazilanlar: (taksitYazilanlar.data ?? []) as { id: number; taksit_plan_id: number; taksit_no: number | null; tarih: string; tutar: string }[],
    enflasyon: (enflasyon.data ?? []) as EnflasyonSatiri[],
    portfoyZinciri: (portfoyZinciri.data ?? []) as PortfoyPerformans[],
    abdFaiz: (abdFaiz.data ?? []) as { seri: string; tarih: string; deger: string }[],
    trFaiz: (trFaiz.data ?? []) as { seri: string; tarih: string; deger: string }[],
    takvim: (takvim.data ?? []) as TakvimSatiri[],
    hatalar: [ozet, hafta, ay, yil, portfoy, kartlar, taksitler, sonIslemler, bant, altKategoriler, nakit]
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
