'use client'

import type { AylikKategori, KategoriSerisi } from '@/lib/tipler'
import { tl, trSirala } from '@/lib/bicim'

/**
 * DUZENSIZ GIDERLER — ortalamada "her ay tekrarlanmayan" odemeleri cikarma.
 *
 * Olcu ALT KATEGORI: penceredeki aylarin YARISINDAN FAZLASINDA gorulen alt
 * kategori duzenlidir, gerisi duzensiz (12 ayda en az 7, 6 ayda en az 4).
 * "Her ay" sarti kullanilmaz: kira ve faturalar bile bir ay bos ya da iki ay
 * tek satirda gorunebiliyor, katı sart onlari da atar. Kategori duzeyinde
 * olculmez: Ev icinde Kira duzenli, Tamirat degil.
 *
 * Yalniz GIDER. Gelir alt kategorileri yeniden adlandirildi (Salary > Part1 /
 * Part2 / Salary), alt kategori sikligi gelirde maasi bile duzensiz sayar.
 */

const anahtar = (kategori: string, alt: string) => `${kategori}\u0000${alt}`

export type Cikan = { kategori: string; alt: string; ay: number; toplam: number }

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
    const s = sayac.get(a) ?? { kategori: k.kategori, alt: k.alt, ay: 0, toplam: 0, aylar: new Set<string>() }
    s.aylar.add(k.ay)
    s.toplam += Number(k.toplam)
    sayac.set(a, s)
  }
  const esik = aylar.length / 2
  const duzensiz = new Set([...sayac].filter(([, s]) => s.aylar.size <= esik).map(([a]) => a))
  const cikanlar: Cikan[] = [...sayac]
    .filter(([a]) => duzensiz.has(a))
    .map(([, s]) => ({ kategori: s.kategori, alt: s.alt, ay: s.aylar.size, toplam: s.toplam }))
    .sort((a, b) => b.toplam - a.toplam || trSirala(a.kategori, b.kategori))

  const alt = altKategoriler.filter((k) => k.yon !== 'Gider' || !duzensiz.has(anahtar(k.kategori, k.alt)))
  // Gider serisi suzulmus alt kategorilerden yeniden kurulur (iki kaynak ay-kategori
  // bazinda birebir ayni toplami verir); gelir oldugu gibi kalir.
  const gider = new Map<string, KategoriSerisi>()
  for (const k of alt) {
    if (k.yon !== 'Gider') continue
    const a = anahtar(k.ay, k.kategori)
    const s = gider.get(a) ?? { donem: k.ay, kategori: k.kategori, yon: 'Gider', toplam: '0', adet: 0 }
    gider.set(a, { ...s, toplam: String(Number(s.toplam) + Number(k.toplam)), adet: s.adet + k.adet })
  }
  return {
    kayitlar: [...kayitlar.filter((k) => k.yon !== 'Gider'), ...gider.values()],
    altKategoriler: alt,
    cikanlar,
  }
}

/** Neyin cikarildigi gorunur kalir: kural otomatik, liste denetlenebilir olmali. */
export function CikanlarNotu({ cikanlar, ayAdedi }: { cikanlar: Cikan[]; ayAdedi: number }) {
  if (cikanlar.length === 0) {
    return (
      <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        Bu pencerede düzensiz gider yok — her alt kategori ayların yarısından fazlasında görülüyor.
      </p>
    )
  }
  const bolen = Math.max(1, ayAdedi)
  const toplam = cikanlar.reduce((t, c) => t + c.toplam, 0) / bolen
  return (
    <details className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
      <summary className="cursor-pointer select-none">
        Düzensiz sayılıp çıkarılan: <span className="rakam">{cikanlar.length}</span> alt kategori, ayda{' '}
        <span className="rakam font-medium" style={{ color: 'var(--ink-2)' }}>{tl(toplam)}</span>
        {' '}· {ayAdedi} ayın yarısı ya da daha azında görülenler · listeyi aç
      </summary>
      <ul className="mt-1.5 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {cikanlar.map((c) => (
          <li key={anahtar(c.kategori, c.alt)} className="flex items-baseline gap-2 py-[2px]">
            <span className="truncate" style={{ color: 'var(--ink-2)' }}>
              {c.kategori}
              {c.alt !== '—' && <span style={{ color: 'var(--ink-muted)' }}> › {c.alt}</span>}
            </span>
            <span className="rakam shrink-0">{c.ay}/{ayAdedi} ay</span>
            <span className="rakam ml-auto shrink-0 font-medium" style={{ color: 'var(--ink-2)' }}>{tl(c.toplam / bolen)}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
