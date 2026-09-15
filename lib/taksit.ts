import type { Kart, TaksitPlani } from '@/lib/tipler'

/**
 * GIDERE HENUZ YANSIMAYAN TAKSITLER.
 * Her taksit, kartin kesim gununde deftere (islemler) Gider satiri olarak
 * yazilir. Bekleyen = planin odenmemis taksitleri (odenen+1 .. taksit_sayisi)
 * eksi deftere zaten yazilmis olanlar (taksit_plan_id + taksit_no).
 * Beklenen tarih = taksit ayi + kartin kesim gunu; kart eslesmezse yalniz ay.
 * Kesim gunu gecmis ama satir yoksa "gecikmis" isaretlenir — ekstre karar verir.
 */

export type BekleyenTaksit = {
  plan: TaksitPlani
  no: number
  /** 'YYYY-MM' */
  ay: string
  /** 'YYYY-MM-DD' — kesim gunu biliniyorsa */
  tarih: string | null
  kesimGunu: number | null
  tutar: number
  gecikmis: boolean
}

function ayEkleYM(ym: string, n: number) {
  const [y, a] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, a - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function ayinSonGunu(ym: string) {
  const [y, a] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, a, 0)).getUTCDate()
}

/** Plan karti "Yapı Kredi 6930" gibi serbest metin; kartlar.kod (6930) icinde gecerse eslesir. */
function kesimGunuBul(kart: string | null, kartlar: Pick<Kart, 'kod' | 'kesim_gunu'>[]) {
  if (!kart) return null
  const k = kartlar.find((x) => x.kod && kart.includes(x.kod))
  return k?.kesim_gunu ?? null
}

export function bekleyenTaksitler(
  planlar: TaksitPlani[],
  kartlar: Pick<Kart, 'kod' | 'kesim_gunu'>[],
  yazilanlar: { taksit_plan_id: number; taksit_no: number | null }[],
  bugun: string,
): BekleyenTaksit[] {
  const yazildi = new Set(yazilanlar.filter((y) => y.taksit_no !== null).map((y) => `${y.taksit_plan_id}-${y.taksit_no}`))
  const sonuc: BekleyenTaksit[] = []
  for (const p of planlar) {
    if (p.durum === 'Bitti' || !p.ilk_taksit_ayi) continue
    const kesim = kesimGunuBul(p.kart, kartlar)
    const tutar = Number(p.aylik_tutar)
    for (let no = p.odenen_taksit + 1; no <= p.taksit_sayisi; no++) {
      if (yazildi.has(`${p.id}-${no}`)) continue
      const ay = ayEkleYM(p.ilk_taksit_ayi, no - 1)
      const tarih = kesim === null ? null : `${ay}-${String(Math.min(kesim, ayinSonGunu(ay))).padStart(2, '0')}`
      const gecikmis = tarih !== null ? tarih < bugun : ay < bugun.slice(0, 7)
      sonuc.push({ plan: p, no, ay, tarih, kesimGunu: kesim, tutar, gecikmis })
    }
  }
  return sonuc.sort((a, b) => (a.tarih ?? `${a.ay}-99`).localeCompare(b.tarih ?? `${b.ay}-99`) || b.tutar - a.tutar)
}

/** Deftere yazilmis taksit satiri (islemler) + plani. */
export type YansiyanTaksit = {
  id: number
  plan: TaksitPlani | null
  no: number | null
  tarih: string
  tutar: number
}

/** Secili ayda deftere yazilmis taksitler ("bu ay yansidi"). */
export function yansiyanTaksitler(
  planlar: TaksitPlani[],
  yazilanlar: { id: number; taksit_plan_id: number; taksit_no: number | null; tarih: string; tutar: string }[],
  ay: string,
): YansiyanTaksit[] {
  const planHaritasi = new Map(planlar.map((p) => [p.id, p]))
  return yazilanlar
    .filter((y) => y.tarih.slice(0, 7) === ay)
    .map((y) => ({ id: y.id, plan: planHaritasi.get(y.taksit_plan_id) ?? null, no: y.taksit_no, tarih: y.tarih, tutar: Number(y.tutar) }))
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.tutar - a.tutar)
}
