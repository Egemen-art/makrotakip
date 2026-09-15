/**
 * Portfoy ekraninda DONEM secimi: gun / hafta / ay / 3 ay / 6 ay / 1 yil /
 * baslangictan / ozel aralik. Secim URL'dedir (?donem=ay), sayfa sunucuda o
 * araliga gore kurulur.
 *
 * Donem getirisi gunluk zincirden turetilir: donem basindaki son olcum
 * baslangic noktasidir (0 %), sonraki gunlerin gunluk getirileri (TWR)
 * birbirine zincirlenir. Yeniden hesap yok, uydurma yok — gunluk zincir
 * neyse donem de onun kesitidir.
 */

export const DONEMLER = [
  { kod: 'gun', ad: 'Gün' },
  { kod: 'hafta', ad: 'Hafta' },
  { kod: 'ay', ad: 'Ay' },
  { kod: '3ay', ad: '3 Ay' },
  { kod: '6ay', ad: '6 Ay' },
  { kod: 'yil', ad: '1 Yıl' },
  { kod: 'tum', ad: 'Başlangıçtan' },
  { kod: 'ozel', ad: 'Özel' },
] as const
export type DonemKodu = (typeof DONEMLER)[number]['kod']

export type Donem = {
  kod: DonemKodu
  /** Donem basi (bu gunun son olcumu baslangic noktasidir); null = baslangictan. */
  bas: string | null
  bit: string
  /** Gun gorunumunde bakilan gun. */
  gun: string
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const isoMu = (s: unknown): s is string => typeof s === 'string' && ISO.test(s)

/** 'YYYY-MM-DD' + n gun (UTC aritmetigi; saat dilimi kaymasi yok). */
export function gunEkle(iso: string, n: number) {
  const [y, a, g] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, a - 1, g + n)).toISOString().slice(0, 10)
}

/** 'YYYY-MM-DD' + n ay; ay sonu tasarsa o ayin son gunune oturur. */
export function ayEkle(iso: string, n: number) {
  const [y, a, g] = iso.split('-').map(Number)
  const hedefAy = new Date(Date.UTC(y, a - 1 + n, 1))
  const sonGun = new Date(Date.UTC(hedefAy.getUTCFullYear(), hedefAy.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(hedefAy.getUTCFullYear(), hedefAy.getUTCMonth(), Math.min(g, sonGun))).toISOString().slice(0, 10)
}

/** URL parametrelerinden donemi cozer; gecersiz deger varsayilana duser (baslangictan). */
export function donemCoz(
  p: { donem?: string; gun?: string; bas?: string; bit?: string },
  bugun: string,
): Donem {
  const kod = (DONEMLER.find((d) => d.kod === p.donem)?.kod ?? 'tum') as DonemKodu
  const gun = isoMu(p.gun) && p.gun <= bugun ? p.gun : bugun
  switch (kod) {
    case 'gun': return { kod, bas: gunEkle(gun, -1), bit: gun, gun }
    case 'hafta': return { kod, bas: gunEkle(bugun, -7), bit: bugun, gun }
    case 'ay': return { kod, bas: ayEkle(bugun, -1), bit: bugun, gun }
    case '3ay': return { kod, bas: ayEkle(bugun, -3), bit: bugun, gun }
    case '6ay': return { kod, bas: ayEkle(bugun, -6), bit: bugun, gun }
    case 'yil': return { kod, bas: ayEkle(bugun, -12), bit: bugun, gun }
    case 'ozel': {
      const bit = isoMu(p.bit) ? p.bit : bugun
      const bas = isoMu(p.bas) && p.bas <= bit ? p.bas : gunEkle(bit, -30)
      return { kod, bas, bit, gun }
    }
    default: return { kod: 'tum', bas: null, bit: bugun, gun }
  }
}

/** Donemi URL'e yazar (para birimi korunur). */
export function donemAdresi(yol: string, d: Partial<Donem> & { kod: DonemKodu }, para: 'TRY' | 'USD') {
  const q = new URLSearchParams()
  if (para === 'USD') q.set('para', 'USD')
  if (d.kod !== 'tum') q.set('donem', d.kod)
  if (d.kod === 'gun' && d.gun) q.set('gun', d.gun)
  if (d.kod === 'ozel') {
    if (d.bas) q.set('bas', d.bas)
    if (d.bit) q.set('bit', d.bit)
  }
  const s = q.toString()
  return s ? `${yol}?${s}` : yol
}

export type ZincirNoktasi = { tarih: string; yuzde: number; deger: number }

/**
 * Gunluk zincirin donem kesiti. `getiri` satirin gunluk getirisi (%, onceki
 * gune gore), `deger` gunun degeri. Ilk nokta donem basi (0 %), sonrakiler
 * birikimli: Π(1 + r) - 1.
 */
export function donemZinciri<T extends { tarih: string }>(
  satirlar: T[],
  donem: Donem,
  getiri: (s: T) => number,
  deger: (s: T) => number,
): ZincirNoktasi[] {
  const sirali = satirlar.filter((s) => s.tarih <= donem.bit).sort((a, b) => a.tarih.localeCompare(b.tarih))
  if (sirali.length === 0) return []
  // Baslangic: donem basindaki (ya da oncesindeki) son olcum; yoksa aralik icindeki ilk.
  let basIdx = 0
  if (donem.bas !== null) {
    const oncekiler = sirali.filter((s) => s.tarih <= donem.bas!)
    basIdx = oncekiler.length > 0 ? sirali.indexOf(oncekiler[oncekiler.length - 1]) : 0
  }
  const noktalar: ZincirNoktasi[] = [{ tarih: sirali[basIdx].tarih, yuzde: 0, deger: deger(sirali[basIdx]) }]
  let carpan = 1
  for (const s of sirali.slice(basIdx + 1)) {
    carpan *= 1 + getiri(s) / 100
    noktalar.push({ tarih: s.tarih, yuzde: (carpan - 1) * 100, deger: deger(s) })
  }
  return noktalar
}

/** Donem getirisi (%); tek nokta varsa null (henuz olculecek gun yok). */
export function donemGetirisi(z: ZincirNoktasi[]): number | null {
  return z.length >= 2 ? z[z.length - 1].yuzde : null
}

export function donemBasligi(d: Donem) {
  switch (d.kod) {
    case 'gun': return 'gün içi'
    case 'hafta': return 'son 7 gün'
    case 'ay': return 'son 1 ay'
    case '3ay': return 'son 3 ay'
    case '6ay': return 'son 6 ay'
    case 'yil': return 'son 1 yıl'
    case 'ozel': return 'seçili aralık'
    default: return 'başlangıçtan beri'
  }
}
