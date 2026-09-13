/** Adet bazli portfoy tipleri — finans.varlik / varlik_hareket / fiyat. */

export const VARLIK_SINIFLARI = [
  'hisse_bist', 'hisse_abd', 'fon', 'altin_fiziksel', 'altin_etf',
  'mevduat', 'bes', 'nakit', 'diger',
] as const
export type VarlikSinif = (typeof VARLIK_SINIFLARI)[number]

export const SINIF_ETIKETI: Record<VarlikSinif, string> = {
  hisse_bist: 'Hisse (BİST)', hisse_abd: 'Hisse (ABD)', fon: 'Yatırım fonu',
  altin_fiziksel: 'Altın (fiziksel)', altin_etf: 'Altın (ETF)',
  mevduat: 'Vadeli mevduat', bes: 'BES', nakit: 'Nakit', diger: 'Diğer',
}

/** Fiyat nereden okunur. 'elle' = kaynak yok, değeri Egemen girer. */
export const KAYNAK_TURLERI = ['bist', 'abd', 'fon', 'gram_altin', 'nakit', 'elle'] as const
export type KaynakTur = (typeof KAYNAK_TURLERI)[number]

export const KAYNAK_ETIKETI: Record<KaynakTur, string> = {
  bist: 'BİST · Yahoo', abd: 'ABD · Yahoo', fon: 'Fon · kurucu sayfası',
  gram_altin: 'Gram altın · /api/kur', nakit: 'Nakit · YK + elde', elle: 'Elle',
}

/** Her sınıf için makul varsayılan kaynak — formda ön seçim. */
export const SINIF_KAYNAGI: Record<VarlikSinif, KaynakTur> = {
  hisse_bist: 'bist', hisse_abd: 'abd', fon: 'fon', altin_fiziksel: 'gram_altin',
  altin_etf: 'bist', mevduat: 'elle', bes: 'elle', nakit: 'nakit', diger: 'elle',
}

/**
 * Ust grup: ekranda once grup, altinda kategoriler gorunur.
 * Altin fizikseli de ETF'i de altindir — biri gramla, digeri ABD borsasinda
 * fiyatlanir; sinif ile fiyat kaynagi ayri seylerdir.
 */
export const SINIF_GRUBU: Record<VarlikSinif, string> = {
  hisse_bist: 'hisse', hisse_abd: 'hisse',
  altin_fiziksel: 'altin', altin_etf: 'altin',
  fon: 'fon', mevduat: 'mevduat', bes: 'bes', nakit: 'nakit', diger: 'diger',
}

export const GRUP_ETIKETI: Record<string, string> = {
  hisse: 'Hisse', altin: 'Altın', fon: 'Yatırım fonu', mevduat: 'Vadeli mevduat',
  bes: 'BES', nakit: 'Nakit', diger: 'Diğer',
}

export const HAREKET_TURLERI = ['Alım', 'Satım', 'Giriş', 'Çıkış', 'Temettü', 'Düzeltme'] as const
export type HareketTur = (typeof HAREKET_TURLERI)[number]

export type Varlik = {
  id: number
  kod: string
  ad: string
  sinif: VarlikSinif
  para: 'TRY' | 'USD' | 'EUR'
  kaynak_tur: KaynakTur
  kaynak_sembol: string | null
  aktif: boolean
  not_: string | null
}

export type VarlikHareket = {
  id: number
  varlik_id: number
  tarih: string
  tur: HareketTur
  miktar: string
  birim_fiyat: string | null
  tutar: string | null
  usdtry: string | null
  kaynak: string | null
  not_: string | null
}

/** v_varlik_deger — pozisyon x son fiyat. */
export type VarlikDeger = {
  varlik_id: number
  kod: string
  ad: string
  sinif: VarlikSinif
  miktar: string
  net_yatirilan_tl: string
  birim_fiyat: string | null
  fiyat_para: 'TRY' | 'USD' | 'EUR' | null
  fiyat_tarihi: string | null
  fiyat_kaynagi: string | null
  fiyat_olculdu: boolean | null
  deger_tl: string | null
}

/** v_portfoy_bugun — adet x olculen fiyat; olcumun durumu da burada. */
export type PortfoyBugun = {
  toplam_tl: string | null
  kalem: number
  fiyatsiz_kalem: number
  elle_kalem: number
  en_eski_fiyat: string | null
  en_yeni_fiyat: string | null
}

/** v_portfoy_sinif — sinif bazinda guncel deger. */
export type PortfoySinif = {
  sinif: VarlikSinif
  deger_tl: string | null
  yatirilan_tl: string
  kalem: number
  fiyatsiz: number
}

/** v_varlik_getiri — kalem bazinda birim fiyat degisimi. */
export type VarlikGetiri = {
  varlik_id: number
  fiyat_tarihi: string | null
  son_fiyat: string | null
  para: 'TRY' | 'USD' | 'EUR' | null
  gun_yuzde: string | null
  hafta_yuzde: string | null
  ay_yuzde: string | null
  uc_ay_yuzde: string | null
  yil_yuzde: string | null
  ilk_fiyat_tarihi: string | null
}

/** v_varlik_performans — kalem bazinda gunluk TWR zinciri. */
export type VarlikPerformans = {
  varlik_id: number
  kod: string
  sinif: VarlikSinif
  tarih: string
  miktar: string
  deger_tl: string | null
  akis_tl: string | null
  gun_yuzde: string | null
  kumulatif_yuzde: string | null
  baslangic: string
}

/** v_portfoy_performans — toplam portfoyun gunluk TWR zinciri. */
export type PortfoyPerformans = {
  tarih: string
  deger_tl: string | null
  akis_tl: string | null
  gun_yuzde: string | null
  kumulatif_yuzde: string | null
}
