/** Pano seritlerinin ortak secimleri: para birimi ve degisim donemi. */
export const SERIT_DONEMLERI = [
  { kod: 'gun', ad: 'Gün', gunSayisi: 1 },
  { kod: 'hafta', ad: 'Hafta', gunSayisi: 7 },
  { kod: 'ay', ad: 'Ay', gunSayisi: 30 },
  { kod: '3ay', ad: '3 Ay', gunSayisi: 90 },
  { kod: '6ay', ad: '6 Ay', gunSayisi: 182 },
] as const
export type SeritDonemi = (typeof SERIT_DONEMLERI)[number]['kod']

export const yuzdeMetni = (n: number) =>
  `${n > 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} %`
export const yuzdeRengi = (n: number) => (n > 0 ? 'var(--artis-iyi)' : n < 0 ? 'var(--kritik)' : 'var(--ink-muted)')

/**
 * Gunluk seriden donem degisimi: son deger / (son tarih - N gun)'deki son
 * deger - 1. "Gun" icin bir onceki kapanis. Baz yoksa null — uydurulmaz.
 */
export function seriDegisimi(seri: { tarih: string; deger: number }[], donem: SeritDonemi): number | null {
  if (seri.length < 2) return null
  const sirali = [...seri].sort((a, b) => a.tarih.localeCompare(b.tarih))
  const son = sirali[sirali.length - 1]
  let baz: { tarih: string; deger: number } | undefined
  if (donem === 'gun') {
    baz = sirali[sirali.length - 2]
  } else {
    const gun = SERIT_DONEMLERI.find((d) => d.kod === donem)!.gunSayisi
    const [y, a, g] = son.tarih.split('-').map(Number)
    const esik = new Date(Date.UTC(y, a - 1, g - gun)).toISOString().slice(0, 10)
    baz = [...sirali].reverse().find((s) => s.tarih <= esik)
  }
  if (!baz || baz.deger <= 0) return null
  return (son.deger / baz.deger - 1) * 100
}
