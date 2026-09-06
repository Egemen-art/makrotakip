import type { PortfoyGetiri } from '@/lib/tipler'
import { tl, tlKurus, usd, usdKurus } from '@/lib/bicim'

export type Para = 'TRY' | 'USD'

/**
 * TL degeri, o anlik goruntunun KENDI USD/TRY kuruyla dolara cevir.
 * Kur kayitta yoksa null — yaklasik kur uydurulmaz, ekranda "—" gorunur.
 */
export function cevir(tlDeger: number, s: PortfoyGetiri, para: Para): number | null {
  if (para === 'TRY') return tlDeger
  const kur = Number(s.usdtry ?? 0)
  return kur > 0 ? tlDeger / kur : null
}

export const bicimle = (para: Para) => (para === 'USD' ? usd : tl)
export const bicimleKurus = (para: Para) => (para === 'USD' ? usdKurus : tlKurus)
export const paraSimgesi = (para: Para) => (para === 'USD' ? '$' : '₺')

/**
 * Modified Dietz, secilen para biriminde. v_portfoy_getiri'nin TL formuluyle
 * ayni: net = toplam - onceki - akis; yuzde = net / (onceki + akis/2).
 * USD'de her kalem o gunun kuruyla cevrilir; kur eksikse null.
 */
export function dietz(sirali: PortfoyGetiri[], i: number, para: Para) {
  const s = sirali[i], o = sirali[i - 1]
  if (!s || !o) return { net: null, yuzde: null }
  const t = cevir(Number(s.toplam_tl), s, para)
  const tp = cevir(Number(o.toplam_tl), o, para)
  const a = cevir(Number(s.eklenen_cekilen ?? 0), s, para)
  if (t === null || tp === null || a === null) return { net: null, yuzde: null }
  const net = t - tp - a
  const payda = tp + a / 2
  return { net, yuzde: payda > 0 ? net / payda : null }
}
