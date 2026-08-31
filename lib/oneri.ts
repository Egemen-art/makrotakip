import type { Islem, Kural, Taksonomi, Tip } from '@/lib/tipler'

/** Sehir/sube eki olarak gorulen ve desenin sonundan atilan parcalar. */
const SEHIR_EKLERI = new Set([
  'ISTANBUL', 'İSTANBUL', 'BURSA', 'ANKARA', 'IZMIR', 'İZMİR', 'MANISA',
  'GORUKLE', 'GÖRÜKLE', 'ANTALYA', 'KOCAELI', 'KOCAELİ', 'TURKIYE', 'TÜRKİYE', 'TR',
])

/**
 * Ham magaza adindan kural deseni uretir.
 * Kural_seti'ndeki mevcut duzeni izler: buyuk harf, noktalama ve rakam yok,
 * parantez ici atilir, sondaki sube/sehir ekleri kirpilir, en fazla 5 parca.
 *
 * DIKKAT: buyuk harfe cevirirken Turkce locale KULLANILMAZ.
 * toLocaleUpperCase('tr') 'Spotify' -> 'SPOTİFY' uretir, oysa kayitli kural
 * 'SPOTIFY'; gorevin siniflandiricisi o desenle eslesemezdi. Duz toUpperCase()
 * hem 'SPOTIFY' hem 'FİLE' hem 'EŞSEVEN' sonuclarini dogru veriyor.
 * (Kategori listelerinin siralamasi ayri mesele; orada trSirala kullaniliyor.)
 *
 * Sonuc kesin degil — desen bir yargi isi, arayuzde duzenlenebilir birakiliyor.
 */
export function desenUret(aciklama: string | null | undefined): string {
  if (!aciklama) return ''
  const parcalar = aciklama
    .replace(/\([^)]*\)/g, ' ')          // parantez ici
    .replace(/[^\p{L}\p{N}]+/gu, ' ')    // noktalama, /, *, —
    .toUpperCase()
    .split(' ')
    .filter((p) => p && !/\d/.test(p))   // rakam iceren parcalar (F157, 2 gibi)

  // Sondaki sube/sehir eklerini kirp: sehir adlari ve tek harflik sube kodlari.
  // 'FİLE FİLE F157 GÖRÜKLE N' -> 'FİLE FİLE'
  while (
    parcalar.length > 1 &&
    (SEHIR_EKLERI.has(parcalar[parcalar.length - 1]) ||
      parcalar[parcalar.length - 1].length === 1)
  ) {
    parcalar.pop()
  }
  return parcalar.slice(0, 5).join(' ')
}

const parcala = (s: string) => new Set(desenUret(s).split(' ').filter(Boolean))

function ortusme(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0
  let kesisim = 0
  for (const p of a) if (b.has(p)) kesisim++
  return kesisim / Math.min(a.size, b.size)
}

export type Oneri = {
  kategori: string
  alt_kategori: string
  tip: Tip
  /** Neden onerildigi — arayuzde kucuk not olarak gosterilir. */
  gerekce: string
  skor: number
}

/**
 * Bir "Soruldu" islemi icin en olasi 2-4 Kategori > Alt Kategori onerisi.
 * Kaynaklar: kural seti, benzer gecmis islemler, sik kullanilan kategoriler.
 */
export function onerileriUret(
  islem: Islem,
  kurallar: Kural[],
  gecmis: Islem[],
  taksonomi: Taksonomi[],
  adet = 4,
): Oneri[] {
  const desen = desenUret(islem.aciklama)
  const parcalarim = parcala(islem.aciklama)
  const havuz = new Map<string, Oneri>()

  const ekle = (
    kategori: string | null, alt: string | null, tip: Tip, gerekce: string, skor: number,
  ) => {
    if (!kategori) return
    const altKat = alt ?? '—'
    const anahtar = `${kategori}|${altKat}`
    const mevcut = havuz.get(anahtar)
    if (mevcut) {
      if (skor > mevcut.skor) { mevcut.skor = skor; mevcut.gerekce = gerekce }
      return
    }
    havuz.set(anahtar, { kategori, alt_kategori: altKat, tip, gerekce, skor })
  }

  // 1) Kural seti — birebir ya da icerme eslesmesi en guclu sinyal
  for (const k of kurallar) {
    const kd = k.desen.toUpperCase()   // desenUret ile ayni buyuk-harf kurali
    if (!kd) continue
    if (desen === kd) {
      ekle(k.kategori, k.alt_kategori, k.tip, 'kural birebir', 100 + (k.isabet ?? 0))
    } else if (desen.includes(kd) || kd.includes(desen)) {
      ekle(k.kategori, k.alt_kategori, k.tip, 'kural eşleşmesi', 80 + (k.isabet ?? 0))
    } else {
      const o = ortusme(parcalarim, parcala(k.desen))
      if (o >= 0.5) ekle(k.kategori, k.alt_kategori, k.tip, 'benzer kural', 50 * o)
    }
  }

  // 2) Benzer gecmis islemler
  const gecmisSayac = new Map<string, { oneri: Oneri; adet: number }>()
  for (const g of gecmis) {
    if (g.id === islem.id || !g.kategori || !g.aciklama) continue
    const o = ortusme(parcalarim, parcala(g.aciklama))
    if (o < 0.5) continue
    const anahtar = `${g.kategori}|${g.alt_kategori ?? '—'}`
    const mevcut = gecmisSayac.get(anahtar)
    if (mevcut) mevcut.adet++
    else
      gecmisSayac.set(anahtar, {
        adet: 1,
        oneri: {
          kategori: g.kategori,
          alt_kategori: g.alt_kategori ?? '—',
          tip: g.tip,
          gerekce: 'benzer işlem',
          skor: 40 * o,
        },
      })
  }
  for (const { oneri, adet: n } of gecmisSayac.values()) {
    ekle(oneri.kategori, oneri.alt_kategori, oneri.tip, `${n} benzer işlem`, oneri.skor + n * 5)
  }

  // 3) Yine de az oneri varsa: en cok kullanilan kategorilerle tamamla
  if (havuz.size < adet) {
    const sik = new Map<string, { oneri: Oneri; adet: number }>()
    for (const g of gecmis) {
      if (!g.kategori || (g.tip !== 'Gider' && g.tip !== 'Gelir')) continue
      const anahtar = `${g.kategori}|${g.alt_kategori ?? '—'}`
      const m = sik.get(anahtar)
      if (m) m.adet++
      else
        sik.set(anahtar, {
          adet: 1,
          oneri: {
            kategori: g.kategori,
            alt_kategori: g.alt_kategori ?? '—',
            tip: g.tip,
            gerekce: 'sık kullanılan',
            skor: 1,
          },
        })
    }
    for (const { oneri, adet: n } of [...sik.values()].sort((a, b) => b.adet - a.adet).slice(0, adet)) {
      ekle(oneri.kategori, oneri.alt_kategori, oneri.tip, 'sık kullanılan', n / 100)
    }
  }

  // Taksonomide karsiligi olmayan onerileri ele (FK'yi bosuna zorlamayalim)
  const gecerli = new Set(taksonomi.map((t) => `${t.kategori}|${t.alt_kategori}`))
  return [...havuz.values()]
    .filter((o) => gecerli.has(`${o.kategori}|${o.alt_kategori}`) || o.skor >= 80)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, adet)
}
