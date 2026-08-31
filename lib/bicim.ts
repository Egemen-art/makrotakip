/** Bicimlendirme yardimcilari. Egemen Turkiye'de; sunucu UTC. */

const TL = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})
const TL_KURUS = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const tl = (n: number | string | null | undefined) =>
  n === null || n === undefined ? '—' : TL.format(Number(n))

export const tlKurus = (n: number | string | null | undefined) =>
  n === null || n === undefined ? '—' : TL_KURUS.format(Number(n))

export const yuzde = (n: number | null | undefined) =>
  n === null || n === undefined || !isFinite(n)
    ? '—'
    : new Intl.NumberFormat('tr-TR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(n)

/** 'YYYY-MM-DD' -> '28 Ağu 2026'. Saat dilimi kaymasi olmasin diye elle parcalanir. */
export function tarihKisa(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, a, g] = iso.slice(0, 10).split('-').map(Number)
  const aylar = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  return `${g} ${aylar[a - 1]} ${y}`
}

/** 'YYYY-MM' -> 'Ağu 2026' · 'YYYY' -> '2026' · 'YYYY-MM-DD' (hafta) -> '28 Ağu' */
export function donemEtiket(donem: string) {
  const aylar = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  if (/^\d{4}$/.test(donem)) return donem
  if (/^\d{4}-\d{2}$/.test(donem)) {
    const [y, a] = donem.split('-').map(Number)
    return `${aylar[a - 1]} ${y}`
  }
  const [, a, g] = donem.split('-').map(Number)
  return `${g} ${aylar[a - 1]}`
}

/** Turkce siralama — I/İ/ı/i karismasin diye her yerde bu kullanilir. */
export const trSirala = (a: string, b: string) =>
  a.localeCompare(b, 'tr', { sensitivity: 'base' })

/** Bugunun tarihi, Europe/Istanbul'a gore 'YYYY-MM-DD'. */
export function bugun() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
  }).format(new Date())
}
