'use client'

import { useState, useTransition } from 'react'
import type { Islem, Taksonomi } from '@/lib/tipler'
import { BAGLAMLAR, DURUMLAR, KAYNAKLAR, TIPLER, YUK_SAHIPLERI } from '@/lib/tipler'
import { bugun, trSirala } from '@/lib/bicim'
import { islemKaydet } from './eylemler'

const kutu: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--hair)',
  color: 'var(--ink)',
}

export default function IslemFormu({
  islem, taksonomi, hesaplar, kapat,
}: {
  islem?: Islem
  taksonomi: Taksonomi[]
  hesaplar: string[]
  kapat: () => void
}) {
  const [bekliyor, basla] = useTransition()
  const [hata, setHata] = useState<string | null>(null)
  const [kategori, setKategori] = useState(islem?.kategori ?? '')

  const kategoriler = [...new Set(taksonomi.map((t) => t.kategori))].sort(trSirala)
  const altlar = taksonomi
    .filter((t) => t.kategori === kategori)
    .map((t) => t.alt_kategori)
    .sort(trSirala)

  function gonder(form: FormData) {
    setHata(null)
    basla(async () => {
      const sonuc = await islemKaydet(form)
      if (sonuc.tamam) kapat()
      else setHata(sonuc.hata)
    })
  }

  return (
    <form action={gonder} className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {islem && <input type="hidden" name="id" value={islem.id} />}

      <Alan etiket="Tarih">
        <input type="date" name="tarih" required defaultValue={islem?.tarih ?? bugun()} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]" />
      </Alan>
      <Alan etiket="Saat">
        <input type="time" name="saat" defaultValue={islem?.saat?.slice(0, 5) ?? ''} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]" />
      </Alan>
      <Alan etiket="Tutar (₺)">
        <input
          name="tutar" required inputMode="decimal" defaultValue={islem?.tutar ?? ''}
          style={kutu} className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]"
        />
      </Alan>

      <Alan etiket="Açıklama" genis>
        <input name="aciklama" required defaultValue={islem?.aciklama ?? ''} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]" />
      </Alan>
      <Alan etiket="Tip">
        <select name="tip" defaultValue={islem?.tip ?? 'Gider'} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]">
          {TIPLER.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Alan>

      <Alan etiket="Kategori">
        <select
          name="kategori" value={kategori} onChange={(e) => setKategori(e.target.value)}
          style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]"
        >
          <option value="">— yok —</option>
          {kategoriler.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </Alan>
      <Alan etiket="Alt kategori">
        <select
          name="alt_kategori" defaultValue={islem?.alt_kategori ?? ''} key={kategori}
          style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]" disabled={!kategori}
        >
          {altlar.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </Alan>
      <Alan etiket="Hesap">
        <input name="hesap" list="hesap-listesi" defaultValue={islem?.hesap ?? ''} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]" />
        <datalist id="hesap-listesi">
          {hesaplar.map((h) => <option key={h} value={h} />)}
        </datalist>
      </Alan>

      <Alan etiket="Bağlam">
        <select name="baglam" defaultValue={islem?.baglam ?? 'Normal'} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]">
          {BAGLAMLAR.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </Alan>
      <Alan etiket="Durum">
        <select name="durum" defaultValue={islem?.durum ?? 'Elle'} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]">
          {DURUMLAR.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Alan>
      <Alan etiket="Kaynak">
        <select name="kaynak" defaultValue={islem?.kaynak ?? 'Elle'} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]">
          {KAYNAKLAR.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </Alan>
      <Alan etiket="Yük sahibi">
        <select name="yuk_sahibi" defaultValue={islem?.yuk_sahibi ?? ''} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]">
          <option value="">— belirtilmedi —</option>
          {YUK_SAHIPLERI.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </Alan>
      <Alan etiket="Not" genis>
        <input name="not_" defaultValue={islem?.not_ ?? ''} style={kutu} className="w-full rounded-lg px-2 py-1.5 text-[13px]" />
      </Alan>

      {hata && (
        <p role="alert" className="text-[12px] sm:col-span-2 lg:col-span-3" style={{ color: 'var(--kritik)' }}>
          {hata}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="submit" disabled={bekliyor}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--seri-1)' }}
        >
          {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button
          type="button" onClick={kapat}
          className="rounded-lg px-3 py-1.5 text-[13px]"
          style={{ border: '1px solid var(--hair)', color: 'var(--ink-2)' }}
        >
          Vazgeç
        </button>
      </div>
    </form>
  )
}

function Alan({ etiket, children, genis }: { etiket: string; children: React.ReactNode; genis?: boolean }) {
  return (
    <label className={`block ${genis ? 'sm:col-span-2' : ''}`}>
      <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{etiket}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  )
}
