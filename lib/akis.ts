import type { HareketKaydi, VarlikPerformans } from '@/lib/tipler-varlik'

/**
 * HAREKETI OLCUM GUNUNE YERLESTIRME.
 *
 * Para akisinin "ne zaman" sorusunun tek dogru cevabi olcum gorunumundedir:
 * v_varlik_performans bir hareketi, gecerli_an'i onceki olcumle bu olcum
 * arasina dusen GUNE yazar (akis_tl). Olcumden sonra girilen bugunku satis
 * henuz hicbir gunde degildir — degeri de henuz dusmemistir. Ekranda akis ile
 * degeri ayni ana baglamazsak kar sisirilir ya da eritilir.
 *
 * Bu yuzden hareket tarihine gore DEGIL, kalemin o gunku akis'i sifirdan
 * farkli olan ilk olcum gunune yerlesir. Hic yerlesemeyen hareket:
 *   - ilk olcumden onceyse baslangic degerinin icindedir (onceki),
 *   - son olcumden sonraysa sonraki olcumu bekler (bekleyen),
 *   - aradaysa en yakin olcum gunune yazilir (yedek; normalde olmaz).
 */

export const EKLEYEN = new Set(['Alım', 'Giriş'])
export const CEKEN = new Set(['Satım', 'Çıkış'])

export type Yerlesim = {
  /** Olcum gunu -> o gune dusen hareketler. */
  gunler: Map<string, HareketKaydi[]>
  onceki: HareketKaydi[]
  bekleyen: HareketKaydi[]
}

export const akisHareketi = (h: HareketKaydi) =>
  h.tutar !== null && (EKLEYEN.has(h.tur) || CEKEN.has(h.tur))

/** Hareketin TL tutari, yonlu: alim +, satim −. */
export const yonluTutar = (h: HareketKaydi) => (EKLEYEN.has(h.tur) ? 1 : -1) * Number(h.tutar ?? 0)

export function hareketYerlestir(
  hareketler: HareketKaydi[],
  kalemler: Pick<VarlikPerformans, 'varlik_id' | 'tarih' | 'akis_tl'>[],
  tarihler: string[],
): Yerlesim {
  const gunler = new Map<string, HareketKaydi[]>()
  const onceki: HareketKaydi[] = []
  const bekleyen: HareketKaydi[] = []
  if (tarihler.length === 0) return { gunler, onceki, bekleyen }

  const akisVar = new Set<string>()
  for (const k of kalemler) if (Math.abs(Number(k.akis_tl ?? 0)) >= 0.5) akisVar.add(`${k.varlik_id}|${k.tarih}`)

  const ilk = tarihler[0], son = tarihler[tarihler.length - 1]
  const sirali = [...hareketler].filter(akisHareketi).sort((a, b) => a.tarih.localeCompare(b.tarih) || a.id - b.id)

  for (const h of sirali) {
    if (h.tarih < ilk) { onceki.push(h); continue }
    const aday = tarihler.find((t) => t >= h.tarih && akisVar.has(`${h.varlik_id}|${t}`))
    if (aday) { gunler.set(aday, [...(gunler.get(aday) ?? []), h]); continue }
    if (h.tarih <= ilk) { onceki.push(h); continue }
    if (h.tarih >= son) { bekleyen.push(h); continue }
    const yedek = tarihler.find((t) => t >= h.tarih) ?? son
    gunler.set(yedek, [...(gunler.get(yedek) ?? []), h])
  }
  return { gunler, onceki, bekleyen }
}
