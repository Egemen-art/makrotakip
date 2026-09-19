/**
 * ENFLASYON VE REEL GETIRI (karar 53).
 *
 * finans.enflasyon aylik endeks tutar (tufe / cpi / pce). Gunluk zincire
 * uygulamak icin endeks gun icine dagitilir:
 *   - Ayin endeksi o ayin SON GUNUNUN degeri sayilir.
 *   - Iki ay sonu arasinda geometrik ara deger (ay icinde sabit gunluk oran).
 *   - Son aciklanan aydan sonrasi GECICI: son 3 ayin ortalama aylik oraniyla
 *     uzatilir ve gecici oldugu her yerde yazilir; veri gelince kesinlesir.
 *
 * Reel gunluk getiri: (1 + r) / (I_t / I_{t-1}) - 1. Bir seyi uydurmaz;
 * yalnizca nominal zinciri fiyat endeksine boler.
 */

import type { ZincirSatiri } from '@/lib/zincir'

export type EnflasyonSerisi = 'tufe' | 'cpi' | 'pce'

export type EnflasyonSatiri = {
  seri: EnflasyonSerisi
  /** 'YYYY-MM-DD' — ayin ilk gunu */
  ay: string
  endeks: string
  aylik_yuzde: string | null
  yillik_yuzde: string | null
  kaynak: string | null
}

export const SERI_ETIKETI: Record<EnflasyonSerisi, string> = { tufe: 'TÜFE (TÜİK)', cpi: 'CPI-U (ABD)', pce: 'PCE (ABD)' }

export type Deflator = {
  seri: EnflasyonSerisi
  /** Son aciklanan ay ('YYYY-MM'). */
  sonAy: string
  /** Gecici uzatmada kullanilan aylik oran (%). */
  geciciAylik: number
  /** Verilen gun icin endeks; ilk aydan onceyse null. */
  endeks(tarih: string): { deger: number; gecici: boolean } | null
}

const gunSayisi = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000)
const aySonu = (ayIlk: string) => {
  const y = +ayIlk.slice(0, 4), a = +ayIlk.slice(5, 7)
  return new Date(Date.UTC(y, a, 0)).toISOString().slice(0, 10)
}

/** Tek serinin aylik satirlarindan gunluk deflator kurar. */
export function deflatorKur(satirlar: EnflasyonSatiri[], seri: EnflasyonSerisi): Deflator | null {
  const aylar = satirlar
    .filter((s) => s.seri === seri)
    .map((s) => ({ son: aySonu(s.ay), endeks: Number(s.endeks) }))
    .filter((s) => Number.isFinite(s.endeks) && s.endeks > 0)
    .sort((a, b) => a.son.localeCompare(b.son))
  if (aylar.length < 2) return null

  // Gecici oran: son 3 aylik degisimin geometrik ortalamasi.
  const sonUc = aylar.slice(-4)
  let carpan = 1, n = 0
  for (let i = 1; i < sonUc.length; i++) { carpan *= sonUc[i].endeks / sonUc[i - 1].endeks; n++ }
  const geciciAylik = (Math.pow(carpan, 1 / n) - 1) * 100
  const gunlukGecici = Math.pow(1 + geciciAylik / 100, 1 / 30.44)

  const sonAy = aylar[aylar.length - 1].son.slice(0, 7)
  const gunler = aylar.map((a) => ({ g: gunSayisi(a.son), endeks: a.endeks }))

  return {
    seri, sonAy, geciciAylik,
    endeks(tarih) {
      const g = gunSayisi(tarih)
      if (g <= gunler[0].g) return g === gunler[0].g ? { deger: gunler[0].endeks, gecici: false } : null
      const son = gunler[gunler.length - 1]
      if (g >= son.g) return { deger: son.endeks * Math.pow(gunlukGecici, g - son.g), gecici: g > son.g }
      // Iki ay sonu arasinda: geometrik ara deger.
      let i = 1
      while (gunler[i].g < g) i++
      const a = gunler[i - 1], b = gunler[i]
      const pay = (g - a.g) / (b.g - a.g)
      return { deger: a.endeks * Math.pow(b.endeks / a.endeks, pay), gecici: false }
    },
  }
}

/** Nominal gunluk zinciri reel zincire cevirir; bir gun bile gecici endekse dayaniyorsa gecici=true. */
export function reelZincir(satirlar: ZincirSatiri[], d: Deflator): { satirlar: ZincirSatiri[]; gecici: boolean; eksik: boolean } {
  const sirali = [...satirlar].sort((a, b) => a.tarih.localeCompare(b.tarih))
  const sonuc: ZincirSatiri[] = []
  let gecici = false, eksik = false
  let onceki: { deger: number } | null = null
  for (const s of sirali) {
    const e = d.endeks(s.tarih)
    if (!e) { eksik = true; sonuc.push({ ...s, r: s.r }); onceki = null; continue }
    if (e.gecici) gecici = true
    const r = onceki === null ? 0 : ((1 + s.r / 100) / (e.deger / onceki.deger) - 1) * 100
    sonuc.push({ tarih: s.tarih, r, deger: s.deger, akis: s.akis })
    onceki = e
  }
  return { satirlar: sonuc, gecici, eksik }
}

/** Serinin son aciklanan ayi: yillik, aylik ve ay etiketi (kur seridi kutulari). */
export function sonEnflasyon(satirlar: EnflasyonSatiri[], seri: EnflasyonSerisi) {
  const s = satirlar.filter((x) => x.seri === seri).sort((a, b) => b.ay.localeCompare(a.ay))[0]
  if (!s) return null
  return {
    ay: s.ay.slice(0, 7),
    yillik: s.yillik_yuzde === null ? null : Number(s.yillik_yuzde),
    aylik: s.aylik_yuzde === null ? null : Number(s.aylik_yuzde),
  }
}

/** Iki gun arasindaki enflasyon (%): I(bit) / I(bas) − 1; gecici endekse dayaniyorsa isaretler. */
export function donemEnflasyonu(d: Deflator, bas: string, bit: string): { yuzde: number; gecici: boolean } | null {
  const a = d.endeks(bas), b = d.endeks(bit)
  if (!a || !b) return null
  return { yuzde: (b.deger / a.deger - 1) * 100, gecici: a.gecici || b.gecici }
}

/** Zincirin birikimli getirisi (%): Π(1 + r) − 1; tek satirda null. */
export function kumulatifGetiri(satirlar: ZincirSatiri[]): number | null {
  if (satirlar.length < 2) return null
  return (satirlar.reduce((c, s) => c * (1 + s.r / 100), 1) - 1) * 100
}

/** Toplam portfoy zincirinin (v_portfoy_performans) nominal ve reel birikimli getirisi. */
export function baslangictanReel(
  toplam: { tarih: string; deger_tl: string | null; deger_usd: string | null; akis_tl: string | null; akis_usd: string | null; gun_yuzde: string | null; gun_yuzde_usd: string | null }[],
  enflasyon: EnflasyonSatiri[],
  dolar: boolean,
  abdSeri: Exclude<EnflasyonSerisi, 'tufe'> = 'cpi',
): { nominal: number | null; reel: number | null; enflasyon: number | null; gecici: boolean; seri: EnflasyonSerisi; sonAy: string | null } {
  const seri: EnflasyonSerisi = dolar ? abdSeri : 'tufe'
  const rows: ZincirSatiri[] = [...toplam]
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .map((t) => ({
      tarih: t.tarih,
      r: Number((dolar ? t.gun_yuzde_usd : t.gun_yuzde) ?? 0),
      deger: Number((dolar ? t.deger_usd : t.deger_tl) ?? 0),
      akis: Number((dolar ? t.akis_usd : t.akis_tl) ?? 0),
    }))
  const nominal = kumulatifGetiri(rows)
  const d = deflatorKur(enflasyon, seri)
  if (!d) return { nominal, reel: null, enflasyon: null, gecici: false, seri, sonAy: null }
  const r = reelZincir(rows, d)
  const enf = rows.length >= 2 ? donemEnflasyonu(d, rows[0].tarih, rows[rows.length - 1].tarih) : null
  return { nominal, reel: r.eksik ? null : kumulatifGetiri(r.satirlar), enflasyon: enf?.yuzde ?? null, gecici: r.gecici, seri, sonAy: d.sonAy }
}
