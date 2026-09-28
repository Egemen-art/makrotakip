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

/**
 * AYLIK TAKSIT DAGILIMI — hangi ay ne kadar taksit odedin, ne kadar kaldi.
 *
 * Kaynak deftere yazilmis satirlar DEGIL, PLANIN KENDISIDIR: defter yalnizca
 * takip basladiktan sonraki taksitleri tasiyor (Eylul 2026'dan itibaren), oysa
 * planlar ilk taksit ayindan itibaren tum takvimi biliyor. Boylece gecmis aylar
 * da dogru gorunur.
 *
 * Son taksit yuvarlama artigini tasir: aylik_tutar x taksit_sayisi cogu planda
 * toplam_tutar'i kurusu kurusuna tutmaz (13.446,63 / 4 = 3.361,6575), fark son
 * taksite yazilir ve aylarin toplami toplam_tutar'a esitlenir.
 */

export type TaksitKalemi = {
  urun: string
  no: number
  taksitSayisi: number
  tutar: number
  yukSahibi: string
  odendi: boolean
}

export type TaksitAyi = {
  /** 'YYYY-MM' */
  ay: string
  odenen: number
  kalan: number
  kalemler: TaksitKalemi[]
}

export function aylikTaksitDagilimi(planlar: TaksitPlani[]): TaksitAyi[] {
  const aylar = new Map<string, TaksitAyi>()

  for (const p of planlar) {
    if (!p.ilk_taksit_ayi || p.taksit_sayisi < 1) continue
    const aylik = Number(p.aylik_tutar)
    const toplam = p.toplam_tutar === null ? null : Number(p.toplam_tutar)
    for (let no = 1; no <= p.taksit_sayisi; no++) {
      const ay = ayEkleYM(p.ilk_taksit_ayi, no - 1)
      // Artik son taksite: onceki taksitlerin toplami toplam_tutar'dan dusulur.
      const tutar = no === p.taksit_sayisi && toplam !== null
        ? Math.round((toplam - aylik * (p.taksit_sayisi - 1)) * 100) / 100
        : aylik
      const odendi = no <= p.odenen_taksit
      const kayit = aylar.get(ay) ?? { ay, odenen: 0, kalan: 0, kalemler: [] }
      if (odendi) kayit.odenen += tutar
      else kayit.kalan += tutar
      kayit.kalemler.push({ urun: p.urun, no, taksitSayisi: p.taksit_sayisi, tutar, yukSahibi: p.yuk_sahibi, odendi })
      aylar.set(ay, kayit)
    }
  }

  for (const k of aylar.values()) k.kalemler.sort((a, b) => b.tutar - a.tutar)
  const dolu = [...aylar.values()].sort((a, b) => a.ay.localeCompare(b.ay))
  if (dolu.length === 0) return dolu

  // Taksitsiz aralar BOS SUTUN olarak durur, atlanmaz: zaman ekseni atlanirsa
  // iki ay arasindaki bosluk gorunmez olur ve grafik yanlis okunur.
  const sonuc: TaksitAyi[] = []
  for (let ay = dolu[0].ay; ay <= dolu[dolu.length - 1].ay; ay = ayEkleYM(ay, 1)) {
    sonuc.push(aylar.get(ay) ?? { ay, odenen: 0, kalan: 0, kalemler: [] })
  }
  return sonuc
}
