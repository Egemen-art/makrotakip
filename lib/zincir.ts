import type { PortfoyOlcumPerformans, VarlikOlcumPerformans, VarlikPerformans } from '@/lib/tipler-varlik'

/**
 * KALEMLERI TOPLAYIP ZINCIR KURMA.
 *
 * Toplam portfoyun TWR zinciri veritabaninda hazir (v_portfoy_performans), ama
 * bir GRUBUN (hisse, altin, fon…) zinciri tutulmuyor — grup bir kullanici
 * secimi, veri degil. Pastada bir dilime tiklandiginda o grubun getirisi
 * burada, kalem satirlarindan ayni formulle kurulur:
 *
 *   gun icin  V = Σ deger, F = Σ akis  →  r = (V1 − V0 − F) / (V0 + F)
 *
 * Yani uygulama kendi hesabini uydurmaz; veritabaninin kalem bazinda verdigi
 * deger ve akis rakamlarini toplar, formul v_portfoy_performans ile ayni.
 * Nakit kaleminde akis = deger degisimi oldugu icin r dogal olarak 0 cikar.
 */

export type ZincirSatiri = { tarih: string; r: number; deger: number; akis: number }

const sayi = (v: string | null | undefined) => Number(v ?? 0)

function adim(deger: number, onceki: number | null, akis: number) {
  if (onceki === null) return 0
  const taban = onceki + akis
  return taban === 0 ? 0 : ((deger - onceki - akis) / taban) * 100
}

/** Kalem satirlarini GUN bazinda toplayip gunluk getiri zinciri kurar. */
export function gunlukZincir(satirlar: VarlikPerformans[], dolar: boolean): ZincirSatiri[] {
  const gunler = new Map<string, { deger: number; akis: number }>()
  for (const s of satirlar) {
    const t = gunler.get(s.tarih) ?? { deger: 0, akis: 0 }
    t.deger += sayi(dolar ? s.deger_usd : s.deger_tl)
    t.akis += sayi(dolar ? s.akis_usd : s.akis_tl)
    gunler.set(s.tarih, t)
  }
  const sonuc: ZincirSatiri[] = []
  let onceki: number | null = null
  for (const [tarih, v] of [...gunler.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    sonuc.push({ tarih, r: adim(v.deger, onceki, v.akis), deger: v.deger, akis: v.akis })
    onceki = v.deger
  }
  return sonuc
}

/** Kalem satirlarini OLCUM bazinda toplar (gun ici goruntu icin). */
export function olcumZinciri(satirlar: VarlikOlcumPerformans[]): PortfoyOlcumPerformans[] {
  const olcumler = new Map<string, { tarih: string; tl: number; usd: number; akisTl: number; akisUsd: number; kur: number; kalem: number }>()
  for (const s of satirlar) {
    const t = olcumler.get(s.olcum_zamani) ?? { tarih: s.tarih, tl: 0, usd: 0, akisTl: 0, akisUsd: 0, kur: 0, kalem: 0 }
    t.tl += sayi(s.deger_tl)
    t.usd += sayi(s.deger_usd)
    t.akisTl += sayi(s.akis_tl)
    t.akisUsd += sayi(s.akis_usd)
    t.kur = Math.max(t.kur, sayi(s.usdtry))
    t.kalem += 1
    olcumler.set(s.olcum_zamani, t)
  }
  const sirali = [...olcumler.entries()].sort(([a], [b]) => a.localeCompare(b))
  const sonuc: PortfoyOlcumPerformans[] = []
  let onceki: { zaman: string; tl: number; usd: number } | null = null
  for (const [zaman, v] of sirali) {
    sonuc.push({
      olcum_zamani: zaman,
      tarih: v.tarih,
      onceki_olcum: onceki?.zaman ?? null,
      kalem: v.kalem,
      deger_tl: String(v.tl),
      onceki_deger: onceki === null ? null : String(onceki.tl),
      akis_tl: String(v.akisTl),
      usdtry: v.kur === 0 ? null : String(v.kur),
      deger_usd: String(v.usd),
      onceki_deger_usd: onceki === null ? null : String(onceki.usd),
      akis_usd: String(v.akisUsd),
      adim_yuzde: String(adim(v.tl, onceki?.tl ?? null, v.akisTl)),
      adim_yuzde_usd: String(adim(v.usd, onceki?.usd ?? null, v.akisUsd)),
    })
    onceki = { zaman, tl: v.tl, usd: v.usd }
  }
  return sonuc
}
