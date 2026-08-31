import type { Islem } from '@/lib/tipler'
import { tarihKisa, tlKurus } from '@/lib/bicim'

/**
 * Arsiv DONMUS — yalnizca okunur (veritabaninda da RLS ile select'e kisitli).
 * Arsiv satirlarinda `aciklama` null; kategoriye dusuluyor, yoksa 2.134 satir
 * bos gorunur.
 */
export default function ArsivTablosu({ kayitlar }: { kayitlar: Islem[] }) {
  if (kayitlar.length === 0) {
    return (
      <p className="kart mt-3 p-8 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Bu filtreyle arşivde kayıt yok.
      </p>
    )
  }

  return (
    <div className="kart mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr style={{ color: 'var(--ink-muted)' }}>
            <th className="px-3 py-2 text-left font-medium">Tarih</th>
            <th className="px-3 py-2 text-left font-medium">Kayıt</th>
            <th className="px-3 py-2 text-left font-medium">Hesap</th>
            <th className="px-3 py-2 text-left font-medium">Tip</th>
            <th className="px-3 py-2 text-right font-medium">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {kayitlar.map((k) => (
            <tr key={k.id} style={{ borderTop: '1px solid var(--hair)' }}>
              <td className="rakam whitespace-nowrap px-3 py-2" style={{ color: 'var(--ink-muted)' }}>
                {tarihKisa(k.tarih)}
              </td>
              <td className="px-3 py-2">
                {k.aciklama ?? k.kategori ?? '—'}
                {k.alt_kategori && k.alt_kategori !== '—' && (
                  <span style={{ color: 'var(--ink-muted)' }}> › {k.alt_kategori}</span>
                )}
              </td>
              <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>{k.hesap ?? '—'}</td>
              <td className="px-3 py-2" style={{ color: 'var(--ink-muted)' }}>{k.tip}</td>
              <td
                className="rakam whitespace-nowrap px-3 py-2 text-right"
                style={{ color: k.tip === 'Gelir' ? 'var(--artis-iyi)' : 'var(--ink)' }}
              >
                {k.tip === 'Gelir' ? '+' : ''}{tlKurus(k.tutar)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        Arşiv dondurulmuştur; buradan düzenlenemez.
      </p>
    </div>
  )
}
