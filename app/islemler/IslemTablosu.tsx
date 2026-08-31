'use client'

import { useState, useTransition } from 'react'
import type { Islem, Taksonomi } from '@/lib/tipler'
import { tarihKisa, tlKurus } from '@/lib/bicim'
import IslemFormu from './IslemFormu'
import { islemSil } from './eylemler'

const DURUM_RENGI: Record<string, string> = {
  Soruldu: 'var(--uyari)',
  Onaylandı: 'var(--iyi)',
  Otomatik: 'var(--seri-1)',
  Elle: 'var(--ink-muted)',
}

export default function IslemTablosu({
  kayitlar, taksonomi, hesaplar,
}: {
  kayitlar: Islem[]
  taksonomi: Taksonomi[]
  hesaplar: string[]
}) {
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null)
  const [yeniAcik, setYeniAcik] = useState(false)
  const [silinen, basla] = useTransition()

  return (
    <>
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => { setYeniAcik((v) => !v); setDuzenlenen(null) }}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white"
          style={{ background: 'var(--seri-1)' }}
        >
          {yeniAcik ? 'Formu kapat' : '+ Yeni işlem'}
        </button>
      </div>

      {yeniAcik && (
        <div className="kart mt-2">
          <IslemFormu taksonomi={taksonomi} hesaplar={hesaplar} kapat={() => setYeniAcik(false)} />
        </div>
      )}

      {kayitlar.length === 0 ? (
        <p className="kart mt-3 p-8 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Bu filtreyle kayıt yok.
        </p>
      ) : (
        <div className="kart mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr style={{ color: 'var(--ink-muted)' }}>
                <th className="px-3 py-2 text-left font-medium">Tarih</th>
                <th className="px-3 py-2 text-left font-medium">Açıklama</th>
                <th className="px-3 py-2 text-left font-medium">Kategori</th>
                <th className="px-3 py-2 text-left font-medium">Hesap</th>
                <th className="px-3 py-2 text-left font-medium">Durum</th>
                <th className="px-3 py-2 text-right font-medium">Tutar</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id} style={{ borderTop: '1px solid var(--hair)' }}>
                  <td className="rakam whitespace-nowrap px-3 py-2" style={{ color: 'var(--ink-muted)' }}>
                    {tarihKisa(k.tarih)}
                    {k.saat && <span className="ml-1 text-[11px]">{k.saat.slice(0, 5)}</span>}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2" title={k.aciklama}>{k.aciklama}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>
                    {k.kategori ?? '—'}
                    {k.alt_kategori && k.alt_kategori !== '—' && (
                      <span style={{ color: 'var(--ink-muted)' }}> › {k.alt_kategori}</span>
                    )}
                    {(k.tip === 'Transfer' || k.tip === 'Hesaplaşma') && (
                      <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {k.tip}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>{k.hesap ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
                      <span
                        aria-hidden className="inline-block h-2 w-2 rounded-full"
                        style={{ background: DURUM_RENGI[k.durum] ?? 'var(--axis)' }}
                      />
                      {k.durum}
                    </span>
                  </td>
                  <td
                    className="rakam whitespace-nowrap px-3 py-2 text-right"
                    style={{ color: k.tip === 'Gelir' ? 'var(--artis-iyi)' : 'var(--ink)' }}
                  >
                    {k.tip === 'Gelir' ? '+' : ''}{tlKurus(k.tutar)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      onClick={() => { setDuzenlenen(duzenlenen === k.id ? null : k.id); setYeniAcik(false) }}
                      className="text-[12px]" style={{ color: 'var(--seri-1)' }}
                    >
                      {duzenlenen === k.id ? 'Kapat' : 'Düzenle'}
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`"${k.aciklama}" işlemi silinsin mi? Geri alınamaz.`)) return
                        basla(() => { void islemSil(k.id) })
                      }}
                      disabled={silinen}
                      className="ml-3 text-[12px] disabled:opacity-50"
                      style={{ color: 'var(--kritik)' }}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {duzenlenen !== null && (
        <div className="kart mt-2">
          <div className="px-3 pt-3 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            İşlem düzenleniyor
          </div>
          <IslemFormu
            islem={kayitlar.find((k) => k.id === duzenlenen)}
            taksonomi={taksonomi}
            hesaplar={hesaplar}
            kapat={() => setDuzenlenen(null)}
          />
        </div>
      )}
    </>
  )
}
