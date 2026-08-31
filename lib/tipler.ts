export type Tip = 'Gider' | 'Gelir' | 'Transfer' | 'Hesaplaşma'
export type Durum = 'Otomatik' | 'Soruldu' | 'Onaylandı' | 'Elle'
export type Baglam = 'Normal' | 'Seyahat' | 'Hediye/Jest' | 'İş'
export type Kaynak = 'Bildirim maili' | 'Ekstre PDF' | 'Sipariş maili' | 'Elle'
export type Yon = 'Gider' | 'Gelir'
export type YukSahibi = 'Kendi gideri' | 'Şirket ödüyor' | 'Kişi ödüyor' | 'Belirsiz'
export type PlanDurum = 'Aktif' | 'Bitti' | 'Doğrulanmadı'

export const TIPLER: Tip[] = ['Gider', 'Gelir', 'Transfer', 'Hesaplaşma']
export const DURUMLAR: Durum[] = ['Otomatik', 'Soruldu', 'Onaylandı', 'Elle']
export const BAGLAMLAR: Baglam[] = ['Normal', 'Seyahat', 'Hediye/Jest', 'İş']
export const KAYNAKLAR: Kaynak[] = ['Bildirim maili', 'Ekstre PDF', 'Sipariş maili', 'Elle']
export const YUK_SAHIPLERI: YukSahibi[] = ['Kendi gideri', 'Şirket ödüyor', 'Kişi ödüyor', 'Belirsiz']

/** Toplamlara giren tipler. Transfer ve Hesaplasma ASLA dahil edilmez. */
export const SAYILAN_TIPLER: Tip[] = ['Gider', 'Gelir']

export type Islem = {
  id: number
  tarih: string
  saat: string | null
  aciklama: string
  tutar: string
  tip: Tip
  kategori: string | null
  alt_kategori: string | null
  baglam: Baglam
  hesap: string | null
  durum: Durum
  guven: string | null
  kaynak: Kaynak | null
  not_: string | null
  taksit_plan_id: number | null
  taksit_no: number | null
  yuk_sahibi: YukSahibi | null
  eklendi: string
  guncellendi: string
}

export type Taksonomi = {
  id: number
  kategori: string
  alt_kategori: string
  yon: Yon
  gecmis_kayit: number | null
  kaynak: string | null
  not_: string | null
}

export type Kural = {
  id: number
  desen: string
  kategori: string
  alt_kategori: string | null
  tip: Tip
  guven: string
  isabet: number | null
  toplam: string | null
  ornek: string | null
  kaynak: string | null
  not_: string | null
  guncellendi: string
}

export type TaksitPlani = {
  id: number
  urun: string
  magaza: string | null
  kart: string | null
  toplam_tutar: string | null
  taksit_sayisi: number
  aylik_tutar: string
  odenen_taksit: number
  kalan_taksit: number
  ilk_taksit_ayi: string | null
  son_taksit_ayi: string | null
  kategori: string | null
  alt_kategori: string | null
  durum: PlanDurum
  kaynak: string | null
  yuk_sahibi: YukSahibi
  son_dogrulama: string | null
  not_: string | null
}

export type Kart = {
  kod: string
  ad: string
  banka: string | null
  limit_tl: string | null
  kullanim_tl: string | null
  ekstre_borcu: string | null
  asgari: string | null
  kesim_gunu: number | null
  son_odeme: string | null
  gelecek_son_odeme: string | null
  not_: string | null
}

export type Portfoy = {
  id: number
  tarih: string
  ppf: string; vadeli_mevduat: string; hisse_abd: string; hisse_bist: string
  altin_fiziksel: string; altin_etf: string; nakit: string; bes: string
  eklenen_cekilen: string
  usdtry: string | null
  altin_gram_tl: string | null
  not_: string | null
  toplam_tl: string
}

export type PortfoyGetiri = Portfoy & {
  onceki_toplam: string | null
  net_getiri: string | null
  getiri_yuzde: string | null
}

export type AylikOzet = {
  ay: string
  gider: string | null
  gelir: string | null
  aktarim: string | null
  hesaplasma: string | null
  net: string | null
}

export type KategoriSerisi = {
  donem: string
  kategori: string
  yon: Yon
  toplam: string
  adet: number
}

/** v_kategori_bant — son 7 ayin bandi. Sapma olçüsü BUDUR.
 *  20 aylik ortalama kullanma: Market kategorisi 2025/2026 arasinda
 *  siniflandirma degisikligi yuzunden kirildi, uzun ortalama yanlis alarm uretir. */
export type KategoriBant = {
  kategori: string
  ay_sayisi: number
  alt_sinir: string
  ortalama: string
  ust_sinir: string
}
