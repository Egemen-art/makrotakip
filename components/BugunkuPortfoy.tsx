import Link from 'next/link'
import type { Para, PortfoyBugun, PortfoyPerformans, PortfoySinif } from '@/lib/tipler-varlik'
import { GRUP_ETIKETI, SINIF_ETIKETI, SINIF_GRUBU } from '@/lib/tipler-varlik'
import { tarihKisa, tl, usd, yuzde } from '@/lib/bicim'

/**
 * Bugunku portfoy: adet x olculen fiyat (finans.varlik + fiyat).
 * Anlik goruntu gecmisinin yerini ALMAZ, onun ustunde durur.
 * Olcumun durumu her zaman yazilir: fiyati okunamayan kalem varsa toplam
 * eksiktir ve bu soylenir; elle girilen kalem sayisi da gorunur.
 */
export default function BugunkuPortfoy({
  ozet, siniflar, para = 'TRY', usdtry = null, kurTarihi = null, performans = [],
}: {
  ozet: PortfoyBugun
  siniflar: PortfoySinif[]
  para?: Para
  /** Gunun USD/TRY kuru; dolar gorunumunde bugunku degerler bununla cevrilir. */
  usdtry?: number | null
  kurTarihi?: string | null
  /** Gunluk zincir: son satirin gun/kumulatif getirisi baslikta gosterilir. */
  performans?: PortfoyPerformans[]
}) {
  // Dolar gorunumu ama kur yok: TL'de kal ve soyle — yaklasik kur uydurulmaz.
  const dolar = para === 'USD' && usdtry !== null && usdtry > 0
  const cevir = (n: number) => (dolar ? n / usdtry! : n)
  const bicim = dolar ? usd : tl
  const toplam = cevir(Number(ozet.toplam_tl ?? 0))

  // Gidisat: son olcumun bir onceki olcume gore degisimi ve baslangictan beri.
  const zincir = [...(performans ?? [])].sort((a, b) => a.tarih.localeCompare(b.tarih))
  const son = zincir.at(-1) ?? null
  const gunYuzde = son ? Number((dolar ? son.gun_yuzde_usd : son.gun_yuzde) ?? 0) : null
  const kumYuzde = son ? Number((dolar ? son.kumulatif_yuzde_usd : son.kumulatif_yuzde) ?? 0) : null
  const olcumSayisi = zincir.length
  const yuzdeMetni = (n: number) =>
    `${n > 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} %`
  const renk = (n: number) => (n > 0 ? 'var(--artis-iyi)' : n < 0 ? 'var(--kritik)' : 'var(--ink-muted)')

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
      deger: cevir(uyeler.reduce((t, u) => t + Number(u.deger_tl ?? 0), 0)),
      olculdu: uyeler.some((u) => u.deger_tl !== null),
    }))
    .sort((a, b) => b.deger - a.deger)

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Bugünkü portföy</span>
          <span className="rakam text-[22px] font-semibold leading-tight">{bicim(toplam)}</span>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          {ozet.kalem} kalem
          {ozet.en_yeni_fiyat && ` · fiyatlar ${tarihKisa(ozet.en_yeni_fiyat)}`}
          {ozet.elle_kalem > 0 && ` · ${ozet.elle_kalem} kalem elle`}
          {dolar && ` · USD/TRY ${usdtry!.toFixed(4)}${kurTarihi ? ` (${tarihKisa(kurTarihi)})` : ''}`}
          {para === 'USD' && !dolar && ' · kur yok, ₺ gösteriliyor'}
        </span>
      </div>

      {/* Gidisat satiri: ilk olcumde getiri yoktur, bunu acikca soyle. */}
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-2)' }}>
        {olcumSayisi >= 2 && gunYuzde !== null && kumYuzde !== null ? (
          <>
            Son ölçüme göre <span className="rakam font-medium" style={{ color: renk(gunYuzde) }}>{yuzdeMetni(gunYuzde)}</span>
            {' · '}başlangıçtan beri <span className="rakam font-medium" style={{ color: renk(kumYuzde) }}>{yuzdeMetni(kumYuzde)}</span>
            <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              ({olcumSayisi} ölçüm, {zincir[0] ? tarihKisa(zincir[0].tarih) : ''}&apos;den beri · para akışları hariç)
            </span>
          </>
        ) : olcumSayisi === 1 ? (
          <span style={{ color: 'var(--ink-muted)' }}>
            Başlangıç ölçümü alındı ({tarihKisa(zincir[0].tarih)}). Getiri bir sonraki günün ölçümüyle başlar;
            gün içi alım-satım bugünkü değere yansır ama getiri sayılmaz.
          </span>
        ) : (
          <span style={{ color: 'var(--ink-muted)' }}>Henüz ölçüm yok.</span>
        )}
      </p>

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
                {g.olculdu ? bicim(g.deger) : 'fiyat yok'}
              </span>
              <span className="rakam w-12 text-right" style={{ color: 'var(--ink-muted)' }}>
                {g.olculdu && toplam > 0 ? yuzde(g.deger / toplam) : '—'}
              </span>
            </div>

            {/* Grup birden fazla kategori tasiyorsa kirilimi da goster. */}
            {g.uyeler.length > 1 && g.uyeler.map((u) => {
              const olculdu = u.deger_tl !== null
              const deger = cevir(Number(u.deger_tl ?? 0))
              return (
                <div
                  key={u.sinif}
                  className="grid grid-cols-[minmax(90px,1fr)_auto_auto] items-center gap-x-3 py-0.5 pl-3 text-[11px] sm:grid-cols-[minmax(140px,1fr)_minmax(80px,2fr)_auto_auto]"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  <span className="truncate">{SINIF_ETIKETI[u.sinif] ?? u.sinif}</span>
                  <span aria-hidden />
                  <span className="rakam text-right">{olculdu ? bicim(deger) : 'fiyat yok'}</span>
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
