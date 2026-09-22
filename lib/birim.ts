import type { VarlikSinif } from '@/lib/tipler-varlik'

/**
 * KALEMIN BIRIM DEGERI — piyasada kote edildigi haliyle.
 *
 * Portfoy degeri her yerde ₺ ya da $ bazinda gosterilir, ama bir kalemin BIRIM
 * fiyati kendi kotasyon para biriminde anlamlidir: NVDA $227,38; ASELS ₺378,00;
 * gram altin ₺6.779,50. Bu yuzden birim fiyat ekranin ₺/$ secimine DEGIL,
 * kalemin fiyat_para alanina bagli yazilir.
 *
 * Gecmis noktalarda ayri bir fiyat serisi cekilmez: olcum satirindaki deger ve
 * miktar zaten fiyattan hesaplanmis, tersine cevirmek yeterli ve cizgiyle
 * birebir tutarli kalir (deger_usd = deger_tl / o gunun kuru).
 */

export type FiyatPara = 'TRY' | 'USD' | 'EUR' | null

/** Sinifa gore birim adi: hisse adet, fon pay, fiziksel altin gram. */
export const BIRIM_ADI: Record<VarlikSinif, string> = {
  hisse_bist: 'adet', hisse_abd: 'adet', altin_etf: 'adet',
  fon: 'pay', altin_fiziksel: 'gram',
  mevduat: 'birim', bes: 'birim', nakit: 'birim', diger: 'birim',
}

/**
 * Olcum satirindan birim fiyat. EUR kote kalemlerde null: satirda EUR karsiligi
 * yok, TL degerini EUR diye etiketlemek yanlis olurdu (bugun boyle kalem yok).
 */
export function birimFiyat(
  s: { miktar: string; deger_tl: string | null; deger_usd: string | null },
  para: FiyatPara,
): number | null {
  if (para === 'EUR') return null
  const m = Number(s.miktar)
  if (!isFinite(m) || m === 0) return null
  const ham = para === 'USD' ? s.deger_usd : s.deger_tl
  if (ham === null || ham === undefined) return null
  const n = Number(ham) / m
  return isFinite(n) ? n : null
}

/** Fon payi gibi kucuk fiyatlar 2 basamakta anlamini yitiriyor; esik 100. */
const bicimci = (para: FiyatPara, n: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: para === 'USD' ? 'USD' : 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(n) < 100 ? 4 : 2,
  })

/** '₺6.779,50/gram' · '$227,38/adet'. */
export function birimMetni(n: number, para: FiyatPara, sinif: VarlikSinif) {
  return `${bicimci(para, n).format(n)}/${BIRIM_ADI[sinif] ?? 'birim'}`
}

/**
 * Birim fiyat yazmaya deger mi? miktar = 1 olan kalemlerde (BES, nakit, vadeli)
 * birim fiyat toplam degerin aynisidir — tekrar etmek yerine yazilmaz.
 */
export const birimAnlamli = (miktar: string | number) => Number(miktar) !== 1
