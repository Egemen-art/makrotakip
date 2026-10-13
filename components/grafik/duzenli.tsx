'use client'

import type { AylikKategori, KategoriSerisi, Yon } from '@/lib/tipler'
import { tl, trSirala } from '@/lib/bicim'

/**
 * DUZENSIZ GIDER VE GELIR — ortalamada "her ay tekrarlanmayan" kalemleri cikarma.
 *
 * Kural: penceredeki aylarin YARISINDAN FAZLASINDA gorulen kalem duzenlidir,
 * gerisi duzensiz (12 ayda en az 7, 6 ayda en az 4). "Her ay" sarti
 * kullanilmaz: kira ve faturalar bile bir ay bos ya da iki ay tek satirda
 * gorunebiliyor, katı sart onlari da atar.
 *
 * Kalem GIDERDE ALT KATEGORI: Ev icinde Kira duzenli, Tamirat degil.
 * GELIRDE KATEGORI: gelir alt kategorileri yeniden adlandirildi (Salary >
 * Part1 / Part2 / Salary), alt kategori sikligi maasi bile duzensiz sayar.
 * Kategori duzeyinde Salary her ay var, Prim degil.
 */

const anahtar = (kategori: string, alt: string) => `${kategori}\u0000${alt}`

/** Gelirde alt her zaman BUTUN: kategorinin tamami cikar. */
export type Cikan = { yon: Yon; kategori: string; alt: string; ay: number; toplam: number }
const BUTUN = '*'

export function duzensizleriCikar(
  kayitlar: KategoriSerisi[],
  altKategoriler: AylikKategori[],
  aylar: string[],
) {
  const pencere = new Set(aylar)
  const sayac = new Map<string, Cikan & { aylar: Set<string> }>()
  for (const k of altKategoriler) {
    if (k.yon !== 'Gider' || !pencere.has(k.ay) || Number(k.toplam) <= 0) continue
    const a = anahtar(k.kategori, k.alt)
    const s = sayac.get(a) ?? { yon: 'Gider', kategori: k.kategori, alt: k.alt, ay: 0, toplam: 0, aylar: new Set<string>() }
    s.aylar.add(k.ay)
    s.toplam += Number(k.toplam)
    sayac.set(a, s)
  }
  const gelirSayac = new Map<string, Cikan & { aylar: Set<string> }>()
  for (const k of kayitlar) {
    if (k.yon !== 'Gelir' || !pencere.has(k.donem) || Number(k.toplam) <= 0) continue
    const s = gelirSayac.get(k.kategori) ?? { yon: 'Gelir', kategori: k.kategori, alt: BUTUN, ay: 0, toplam: 0, aylar: new Set<string>() }
    s.aylar.add(k.donem)
    s.toplam += Number(k.toplam)
    gelirSayac.set(k.kategori, s)
  }
  const esik = aylar.length / 2
  const duzensiz = new Set([...sayac].filter(([, s]) => s.aylar.size <= esik).map(([a]) => a))
  const duzensizGelir = new Set([...gelirSayac].filter(([, s]) => s.aylar.size <= esik).map(([a]) => a))
  const cikanlar: Cikan[] = [...sayac.values(), ...gelirSayac.values()]
    .filter((s) => (s.yon === 'Gider' ? duzensiz.has(anahtar(s.kategori, s.alt)) : duzensizGelir.has(s.kategori)))
    .map((s) => ({ yon: s.yon, kategori: s.kategori, alt: s.alt, ay: s.aylar.size, toplam: s.toplam }))
    .sort((a, b) => b.toplam - a.toplam || trSirala(a.kategori, b.kategori))

  const alt = altKategoriler.filter((k) =>
    k.yon === 'Gider' ? !duzensiz.has(anahtar(k.kategori, k.alt))
    : k.yon === 'Gelir' ? !duzensizGelir.has(k.kategori)
    : true)
  // Gider serisi suzulmus alt kategorilerden yeniden kurulur (iki kaynak ay-kategori
  // bazinda birebir ayni toplami verir); gelirde duzensiz kategoriler dusurulur.
  const gider = new Map<string, KategoriSerisi>()
  for (const k of alt) {
    if (k.yon !== 'Gider') continue
    const a = anahtar(k.ay, k.kategori)
    const s = gider.get(a) ?? { donem: k.ay, kategori: k.kategori, yon: 'Gider', toplam: '0', adet: 0 }
    gider.set(a, { ...s, toplam: String(Number(s.toplam) + Number(k.toplam)), adet: s.adet + k.adet })
  }
  return {
    kayitlar: [
      ...kayitlar.filter((k) => k.yon !== 'Gider' && !(k.yon === 'Gelir' && duzensizGelir.has(k.kategori))),
      ...gider.values(),
    ],
    altKategoriler: alt,
    cikanlar,
  }
}

/** Neyin cikarildigi gorunur kalir: kural otomatik, liste denetlenebilir olmali. */
export function CikanlarNotu({
  cikanlar, ayAdedi, yonler,
}: { cikanlar: Cikan[]; ayAdedi: number; yonler: Yon[] }) {
  const bolen = Math.max(1, ayAdedi)
  const gruplar = yonler.map((yon) => {
    const liste = cikanlar.filter((c) => c.yon === yon)
    return { yon, liste, toplam: liste.reduce((t, c) => t + c.toplam, 0) / bolen }
  })
  if (gruplar.every((g) => g.liste.length === 0)) {
    return (
      <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        Bu pencerede düzensiz kalem yok — hepsi ayların yarısından fazlasında görülüyor.
      </p>
    )
  }
  const ozet = gruplar
    .filter((g) => g.liste.length > 0)
    .map((g) => `${g.yon.toLocaleLowerCase('tr')}den ${g.liste.length} kalem, ayda ${tl(g.toplam)}`)
    .join(' · ')
  return (
    <details className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
      <summary className="cursor-pointer select-none">
        Düzensiz sayılıp çıkarılan: <span className="rakam" style={{ color: 'var(--ink-2)' }}>{ozet}</span>
        {' '}· {ayAdedi} ayın yarısı ya da daha azında görülenler · listeyi aç
      </summary>
      {gruplar.filter((g) => g.liste.length > 0).map((g) => (
        <div key={g.yon} className="mt-1.5">
          {yonler.length > 1 && (
            <p className="font-medium" style={{ color: 'var(--ink-2)' }}>
              {g.yon} {g.yon === 'Gelir' ? '(kategori bazında)' : '(alt kategori bazında)'}
            </p>
          )}
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {g.liste.map((c) => (
              <li key={anahtar(c.kategori, c.alt)} className="flex items-baseline gap-2 py-[2px]">
                <span className="truncate" style={{ color: 'var(--ink-2)' }}>
                  {c.kategori}
                  {c.alt !== '—' && c.alt !== BUTUN && <span style={{ color: 'var(--ink-muted)' }}> › {c.alt}</span>}
                </span>
                <span className="rakam shrink-0">{c.ay}/{ayAdedi} ay</span>
                <span className="rakam ml-auto shrink-0 font-medium" style={{ color: 'var(--ink-2)' }}>{tl(c.toplam / bolen)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  )
}
