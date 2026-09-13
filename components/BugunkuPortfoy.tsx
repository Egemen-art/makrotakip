import Link from 'next/link'
import type { PortfoyBugun, PortfoySinif } from '@/lib/tipler-varlik'
import { GRUP_ETIKETI, SINIF_ETIKETI, SINIF_GRUBU } from '@/lib/tipler-varlik'
import { tarihKisa, tl, yuzde } from '@/lib/bicim'

/**
 * Bugunku portfoy: adet x olculen fiyat (finans.varlik + fiyat).
 * Anlik goruntu gecmisinin yerini ALMAZ, onun ustunde durur.
 * Olcumun durumu her zaman yazilir: fiyati okunamayan kalem varsa toplam
 * eksiktir ve bu soylenir; elle girilen kalem sayisi da gorunur.
 */
export default function BugunkuPortfoy({
  ozet, siniflar,
}: {
  ozet: PortfoyBugun
  siniflar: PortfoySinif[]
}) {
  const toplam = Number(ozet.toplam_tl ?? 0)

  // Once ust grup (Altin, Hisse...), altinda kategoriler. Tek kategorili
  // grupta alt satir tekrar olur, gosterilmez.
  const gruplar = new Map<string, PortfoySinif[]>()
  for (const s of siniflar) {
    const g = SINIF_GRUBU[s.sinif] ?? 'diger'
    gruplar.set(g, [...(gruplar.get(g) ?? []), s])
  }
  const sirali = [...gruplar.entries()]
    .map(([grup, uyeler]) => ({
      grup,
      uyeler: [...uyeler].sort((a, b) => Number(b.deger_tl ?? 0) - Number(a.deger_tl ?? 0)),
      deger: uyeler.reduce((t, u) => t + Number(u.deger_tl ?? 0), 0),
      olculdu: uyeler.some((u) => u.deger_tl !== null),
    }))
    .sort((a, b) => b.deger - a.deger)

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Bugünkü portföy</span>
          <span className="rakam text-[22px] font-semibold leading-tight">{tl(toplam)}</span>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          {ozet.kalem} kalem
          {ozet.en_yeni_fiyat && ` · fiyatlar ${tarihKisa(ozet.en_yeni_fiyat)}`}
          {ozet.elle_kalem > 0 && ` · ${ozet.elle_kalem} kalem elle`}
        </span>
      </div>

      {ozet.fiyatsiz_kalem > 0 && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--ciddi)' }}>
          {ozet.fiyatsiz_kalem} kalemin fiyatı okunamadı — toplam onları içermiyor.
        </p>
      )}

      <ul className="mt-3">
        {sirali.map((g) => (
          <li key={g.grup}>
            <div className="grid grid-cols-[minmax(90px,1fr)_auto_auto] items-center gap-x-3 py-1 text-[12px] sm:grid-cols-[minmax(140px,1fr)_minmax(80px,2fr)_auto_auto]">
              <span className="truncate font-medium">{GRUP_ETIKETI[g.grup] ?? g.grup}</span>
              <span className="hidden h-2 overflow-hidden rounded-full sm:block" style={{ background: 'var(--grid)' }} aria-hidden>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${g.olculdu && toplam > 0 ? Math.max(2, (g.deger / toplam) * 100) : 0}%`,
                    background: 'var(--seri-1)',
                  }}
                />
              </span>
              <span className="rakam text-right font-medium" style={{ color: g.olculdu ? undefined : 'var(--ciddi)' }}>
                {g.olculdu ? tl(g.deger) : 'fiyat yok'}
              </span>
              <span className="rakam w-12 text-right" style={{ color: 'var(--ink-muted)' }}>
                {g.olculdu && toplam > 0 ? yuzde(g.deger / toplam) : '—'}
              </span>
            </div>

            {/* Grup birden fazla kategori tasiyorsa kirilimi da goster. */}
            {g.uyeler.length > 1 && g.uyeler.map((u) => {
              const olculdu = u.deger_tl !== null
              const deger = Number(u.deger_tl ?? 0)
              return (
                <div
                  key={u.sinif}
                  className="grid grid-cols-[minmax(90px,1fr)_auto_auto] items-center gap-x-3 py-0.5 pl-3 text-[11px] sm:grid-cols-[minmax(140px,1fr)_minmax(80px,2fr)_auto_auto]"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  <span className="truncate">{SINIF_ETIKETI[u.sinif] ?? u.sinif}</span>
                  <span aria-hidden />
                  <span className="rakam text-right">{olculdu ? tl(deger) : 'fiyat yok'}</span>
                  <span className="rakam w-12 text-right">
                    {olculdu && toplam > 0 ? yuzde(deger / toplam) : '—'}
                  </span>
                </div>
              )
            })}
          </li>
        ))}
      </ul>

      <Link href="/portfoy/varliklar" className="mt-2 inline-block text-[12px] font-medium" style={{ color: 'var(--seri-1)' }}>
        Varlıkları düzenle →
      </Link>
    </div>
  )
}
