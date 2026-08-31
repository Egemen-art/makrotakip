'use client'

import { useMemo, useState, useTransition } from 'react'
import type { Islem, Taksonomi, Tip, YukSahibi } from '@/lib/tipler'
import { TIPLER, YUK_SAHIPLERI } from '@/lib/tipler'
import type { Oneri } from '@/lib/oneri'
import { tarihKisa, tlKurus, trSirala } from '@/lib/bicim'
import { cevapla } from './eylemler'

export default function SoruKarti({
  islem, oneriler, varsayilanDesen, taksonomi,
}: {
  islem: Islem
  oneriler: Oneri[]
  varsayilanDesen: string
  taksonomi: Taksonomi[]
}) {
  const [bekliyor, basla] = useTransition()
  const [hata, setHata] = useState<string | null>(null)
  const [bitti, setBitti] = useState(false)
  const [acikPanel, setAcikPanel] = useState(false)
  const [desen, setDesen] = useState(varsayilanDesen)
  const [kuralYaz, setKuralYaz] = useState(true)
  const [arama, setArama] = useState('')
  const [tip, setTip] = useState<Tip>(islem.tip)
  const [yukSahibi, setYukSahibi] = useState<YukSahibi | ''>('')

  const eslesenler = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    const hepsi = [...taksonomi].sort(
      (a, b) => trSirala(a.kategori, b.kategori) || trSirala(a.alt_kategori, b.alt_kategori),
    )
    if (!q) return hepsi.slice(0, 40)
    return hepsi
      .filter((t) =>
        `${t.kategori} ${t.alt_kategori}`.toLocaleLowerCase('tr').includes(q))
      .slice(0, 40)
  }, [arama, taksonomi])

  function gonder(kategori: string, altKategori: string, seciliTip: Tip) {
    setHata(null)
    basla(async () => {
      const sonuc = await cevapla({
        islemId: islem.id,
        kategori,
        altKategori,
        tip: seciliTip,
        desen: kuralYaz ? desen : '',
        yukSahibi: yukSahibi || null,
      })
      if (sonuc.tamam) setBitti(true)
      else setHata(sonuc.hata)
    })
  }

  if (bitti) {
    return (
      <div className="kart flex items-center gap-2 p-3 text-[13px]" style={{ borderColor: 'var(--iyi)' }}>
        <span aria-hidden style={{ color: 'var(--iyi)' }}>✓</span>
        <span style={{ color: 'var(--ink-2)' }}>
          {islem.aciklama} onaylandı{kuralYaz && desen ? ` · kural yazıldı: ${desen}` : ''}
        </span>
      </div>
    )
  }

  return (
    <div className="kart p-4" aria-busy={bekliyor}>
      {/* Ham bilgi — banka bildirimindeki haliyle */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{islem.aciklama}</span>
        <span className="rakam text-[15px] font-semibold">{tlKurus(islem.tutar)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        <span>{tarihKisa(islem.tarih)}{islem.saat ? ` · ${islem.saat.slice(0, 5)}` : ''}</span>
        {islem.hesap && <span>{islem.hesap}</span>}
        {islem.kaynak && <span>{islem.kaynak}</span>}
        {islem.kategori && <span>tahmin: {islem.kategori}</span>}
      </div>

      {/* Oneriler — birincil akis: tek dokunus */}
      <div className="mt-3 flex flex-wrap gap-2">
        {oneriler.map((o) => (
          <button
            key={`${o.kategori}|${o.alt_kategori}`}
            onClick={() => gonder(o.kategori, o.alt_kategori, o.tip)}
            disabled={bekliyor}
            className="rounded-lg px-3 py-2 text-left text-[13px] transition-opacity disabled:opacity-50"
            style={{ border: '1px solid var(--hair)', background: 'var(--plane)' }}
          >
            <span className="font-medium">
              {o.kategori}
              {o.alt_kategori !== '—' && (
                <span style={{ color: 'var(--ink-2)' }}> › {o.alt_kategori}</span>
              )}
            </span>
            <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{o.gerekce}</span>
          </button>
        ))}
        <button
          onClick={() => setAcikPanel((v) => !v)}
          disabled={bekliyor}
          aria-expanded={acikPanel}
          className="rounded-lg px-3 py-2 text-[13px] disabled:opacity-50"
          style={{ border: '1px dashed var(--axis)', color: 'var(--ink-2)' }}
        >
          Başka…
        </button>
      </div>

      {/* Kural satiri — desen duzenlenebilir, cunku desen bir yargi isi */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={kuralYaz}
            onChange={(e) => setKuralYaz(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          kalıcı kural yaz
        </label>
        {kuralYaz && (
          <input
            value={desen}
            onChange={(e) => setDesen(e.target.value)}
            aria-label="Kural deseni"
            className="rakam min-w-[180px] flex-1 rounded px-2 py-1 text-[11px]"
            style={{ background: 'var(--plane)', border: '1px solid var(--hair)', color: 'var(--ink-2)' }}
          />
        )}
      </div>

      {acikPanel && (
        <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--plane)', border: '1px solid var(--hair)' }}>
          <div className="flex flex-wrap gap-2">
            <label className="text-[12px]">
              <span style={{ color: 'var(--ink-muted)' }}>Tip</span>
              <select
                value={tip}
                onChange={(e) => setTip(e.target.value as Tip)}
                className="ml-1.5 rounded px-2 py-1 text-[12px]"
                style={{ background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)' }}
              >
                {TIPLER.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-[12px]">
              <span style={{ color: 'var(--ink-muted)' }}>Yük sahibi</span>
              <select
                value={yukSahibi}
                onChange={(e) => setYukSahibi(e.target.value as YukSahibi | '')}
                className="ml-1.5 rounded px-2 py-1 text-[12px]"
                style={{ background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)' }}
              >
                <option value="">değiştirme</option>
                {YUK_SAHIPLERI.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Kategori ara…"
            aria-label="Taksonomide ara"
            className="mt-2 w-full rounded px-2.5 py-1.5 text-[13px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)' }}
          />

          <div className="mt-2 max-h-[220px] overflow-y-auto">
            {eslesenler.map((t) => (
              <button
                key={t.id}
                onClick={() => gonder(t.kategori, t.alt_kategori, tip)}
                disabled={bekliyor}
                className="block w-full rounded px-2 py-1.5 text-left text-[13px] hover:opacity-80 disabled:opacity-50"
              >
                {t.kategori}
                {t.alt_kategori !== '—' && (
                  <span style={{ color: 'var(--ink-2)' }}> › {t.alt_kategori}</span>
                )}
              </button>
            ))}
            {eslesenler.length === 0 && (
              <p className="px-2 py-3 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                Eşleşme yok. Yeni kategori Taksonomi ekranından eklenebilir.
              </p>
            )}
          </div>
        </div>
      )}

      {hata && (
        <p role="alert" className="mt-2 text-[12px]" style={{ color: 'var(--kritik)' }}>{hata}</p>
      )}
    </div>
  )
}
