'use client'

import { useState, useTransition } from 'react'
import { bugun, tarihKisa, tl, yuzde } from '@/lib/bicim'
import {
  HAREKET_TURLERI, KAYNAK_ETIKETI, KAYNAK_TURLERI, SINIF_ETIKETI, SINIF_KAYNAGI,
  VARLIK_SINIFLARI, type KaynakTur, type Varlik, type VarlikDeger, type VarlikGetiri,
  type VarlikHareket, type VarlikSinif,
} from '@/lib/tipler-varlik'
import { elleFiyat, fiyatlariGuncelle, gecmisiCek, hareketEkle, hareketSil, varlikEkle, varlikSil } from './eylemler'

const kutu: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)',
}

/** Miktar: adet tam sayi, gram/pay ondalikli olabilir — ikisi de okunakli dursun. */
const miktarBicim = (n: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(n)

/**
 * Birim fiyat: fon payi 2,22949 gibi kucuk olabilir, iki haneye kirpilirsa
 * bilgi kaybolur. 10'un altindaki fiyatlar alti haneye kadar yazilir.
 */
function fiyatBicim(n: number, para: 'TRY' | 'USD' | 'EUR' | null) {
  const sembol = para === 'USD' ? '$' : para === 'EUR' ? '€' : '₺'
  const basamak = Math.abs(n) < 10 ? 6 : 2
  return `${sembol}${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: basamak }).format(n)}`
}

/** Donem getirisi: isaretiyle ve rengiyle. Yeterli gecmis yoksa bos kalir. */
function Yuzde({ deger }: { deger: string | null }) {
  if (deger === null) return <span style={{ color: 'var(--ink-muted)' }}>—</span>
  const n = Number(deger)
  if (!Number.isFinite(n)) return <span style={{ color: 'var(--ink-muted)' }}>—</span>
  return (
    <span style={{ color: n > 0 ? 'var(--artis-iyi)' : n < 0 ? 'var(--kritik)' : 'var(--ink-muted)' }}>
      {n > 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(n)}
    </span>
  )
}

export default function VarlikYonetimi({
  varliklar, degerler, hareketler, getiriler,
}: {
  varliklar: Varlik[]
  degerler: VarlikDeger[]
  hareketler: VarlikHareket[]
  getiriler: VarlikGetiri[]
}) {
  const [hata, setHata] = useState<string | null>(null)
  const [bilgi, setBilgi] = useState<string | null>(null)
  const [bekliyor, basla] = useTransition()
  const [sinif, setSinif] = useState<VarlikSinif>('hisse_bist')
  const [kaynakTur, setKaynakTur] = useState<KaynakTur>('bist')
  const [form, setForm] = useState<'varlik' | 'hareket' | null>(null)

  function calistir(is: () => Promise<{ tamam: boolean; hata?: string; bilgi?: string }>) {
    setHata(null); setBilgi(null)
    basla(async () => {
      const s = await is()
      if (!s.tamam) setHata(s.hata ?? 'Bilinmeyen hata')
      else if (s.bilgi) setBilgi(s.bilgi)
    })
  }

  // Sinif secilince makul kaynak on-secilir; kullanici degistirebilir.
  function sinifDegistir(s: VarlikSinif) { setSinif(s); setKaynakTur(SINIF_KAYNAGI[s]) }

  const adlar = new Map(varliklar.map((v) => [v.id, v]))
  const getiriHaritasi = new Map(getiriler.map((g) => [g.varlik_id, g]))
  const toplam = degerler.reduce((t, d) => t + Number(d.deger_tl ?? 0), 0)
  const eksikFiyat = degerler.filter((d) => Number(d.miktar) !== 0 && d.deger_tl === null)
  const elleOlanlar = varliklar.filter((v) => v.kaynak_tur === 'elle' && v.aktif)

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button" disabled={bekliyor}
          onClick={() => calistir(fiyatlariGuncelle)}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white"
          style={{ background: 'var(--seri-1)', opacity: bekliyor ? 0.6 : 1 }}
        >
          {bekliyor ? 'Çalışıyor…' : 'Fiyatları güncelle'}
        </button>
        <button
          type="button" disabled={bekliyor}
          onClick={() => calistir(gecmisiCek)}
          className="rounded-lg px-3 py-1.5 text-[13px]"
          style={{ border: '1px solid var(--hair)', color: 'var(--ink-2)' }}
          title="Hisseler için bir yıllık günlük fiyat geçmişini Yahoo'dan doldurur"
        >
          Geçmişi çek
        </button>
        <button
          type="button"
          onClick={() => setForm((f) => (f === 'varlik' ? null : 'varlik'))}
          className="rounded-lg px-3 py-1.5 text-[13px]"
          style={{ border: '1px solid var(--hair)', color: 'var(--ink-2)' }}
        >
          + Varlık
        </button>
        <button
          type="button" disabled={varliklar.length === 0}
          onClick={() => setForm((f) => (f === 'hareket' ? null : 'hareket'))}
          className="rounded-lg px-3 py-1.5 text-[13px]"
          style={{ border: '1px solid var(--hair)', color: 'var(--ink-2)', opacity: varliklar.length ? 1 : 0.5 }}
        >
          + Hareket
        </button>
      </div>

      {hata && <p className="mt-2 text-[12px]" style={{ color: 'var(--kritik)' }}>{hata}</p>}
      {bilgi && <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-2)' }}>{bilgi}</p>}

      {form === 'varlik' && (
        <div className="kart mt-3 p-3">
          <form
            action={(f) => calistir(async () => { const s = await varlikEkle(f); if (s.tamam) setForm(null); return s })}
            className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
          >
            <input name="kod" required placeholder="Kod (THYAO)" aria-label="Kod" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            <input name="ad" placeholder="Ad (boşsa kod)" aria-label="Ad" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            <select
              name="sinif" value={sinif} aria-label="Sınıf"
              onChange={(e) => sinifDegistir(e.target.value as VarlikSinif)}
              className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}
            >
              {VARLIK_SINIFLARI.map((s) => <option key={s} value={s}>{SINIF_ETIKETI[s]}</option>)}
            </select>
            <select
              name="kaynak_tur" value={kaynakTur} aria-label="Fiyat kaynağı"
              onChange={(e) => setKaynakTur(e.target.value as KaynakTur)}
              className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}
            >
              {KAYNAK_TURLERI.map((k) => <option key={k} value={k}>{KAYNAK_ETIKETI[k]}</option>)}
            </select>
            {kaynakTur === 'elle' ? (
              <>
                <input name="deger" inputMode="decimal" placeholder="Şu anki değer ₺" aria-label="Şu anki değer" className="rakam rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
                <input name="yatirilan" inputMode="decimal" placeholder="Yatırdığın ₺ (varsa)" aria-label="Yatırılan" className="rakam rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
              </>
            ) : (
              <input
                name="kaynak_sembol" placeholder="Sembol (THYAO / AAPL / TP2)" aria-label="Sembol"
                disabled={kaynakTur === 'gram_altin'}
                className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}
              />
            )}
            <select name="para" defaultValue={kaynakTur === 'abd' ? 'USD' : 'TRY'} aria-label="Fiyat para birimi" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}>
              <option value="TRY">Fiyat ₺</option>
              <option value="USD">Fiyat $</option>
              <option value="EUR">Fiyat €</option>
            </select>
            <button type="submit" disabled={bekliyor} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white sm:col-span-3 lg:col-span-1" style={{ background: 'var(--seri-1)' }}>
              Ekle
            </button>
            {kaynakTur === 'elle' && (
              <p className="text-[11px] sm:col-span-3 lg:col-span-6" style={{ color: 'var(--ink-muted)' }}>
                Fiyat kaynağı olmayan kalemde (BES, vadeli mevduat) adet diye bir şey yok: değeri
                kalemin kendisidir. Ayrıca hareket girmene gerek yok, buraya yazdığın değer yeter;
                sonra değiştikçe &quot;Elle değer gir&quot;den güncellersin.
              </p>
            )}
          </form>
        </div>
      )}

      {form === 'hareket' && (
        <div className="kart mt-3 p-3">
          <form
            action={(f) => calistir(async () => { const s = await hareketEkle(f); if (s.tamam) setForm(null); return s })}
            className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
          >
            <select name="varlik_id" required aria-label="Varlık" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}>
              {varliklar.map((v) => <option key={v.id} value={v.id}>{v.kod} · {v.ad}</option>)}
            </select>
            <select name="tur" defaultValue="Alım" aria-label="Hareket türü" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}>
              {HAREKET_TURLERI.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" name="tarih" required defaultValue={bugun()} aria-label="Tarih" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            <input name="miktar" required inputMode="decimal" placeholder="Miktar (adet/gram/pay)" aria-label="Miktar" className="rakam rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            <input name="birim_fiyat" inputMode="decimal" placeholder="Birim fiyat" aria-label="Birim fiyat" className="rakam rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            <input name="tutar" inputMode="decimal" placeholder="Tutar ₺ (boşsa hesaplanır)" aria-label="TL tutarı" className="rakam rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            <button type="submit" disabled={bekliyor} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white sm:col-span-3 lg:col-span-1" style={{ background: 'var(--seri-1)' }}>
              Ekle
            </button>
            <p className="text-[11px] sm:col-span-3 lg:col-span-5" style={{ color: 'var(--ink-muted)' }}>
              <strong>Düzeltme</strong> üstüne eklemez, <strong>ayarlar</strong>: elindeki gerçek
              adedi yaz, sonraki alım/satımlar onun üstüne işlenir. Tutar da yazarsan maliyet de
              o değere ayarlanır.
              <br />
              <strong>Birim fiyat</strong> yazarsan <strong>Tutar ₺</strong> kendiliğinden hesaplanır
              — döviz kalemlerinde o günün kuruyla, bugünkünle değil. Tutar yalnızca <em>getiri</em>
              için gerekli; <em>değer</em> zaten adet × güncel fiyattan çıkıyor. İkisini de boş
              bırakırsan kalem değerlenir ama maliyeti bilinmediği için getirisi hesaplanmaz.
              <br />
              <strong>Geçmiş tarih</strong> yazabilirsin: o tarihten sonraki ölçümlerin adedi ve
              değeri yeniden hesaplanır, böylece aradaki fiyat hareketi getirine girer. Ölçümün
              <em> fiyatı</em> hiç değişmez — yalnızca kaç adet tuttuğun düzelir.
            </p>
          </form>
        </div>
      )}

      {/* ── Güncel değer ─────────────────────────────────────────────── */}
      <div className="kart mt-4 overflow-x-auto">
        <table className="w-full min-w-[880px] text-[13px]">
          <thead>
            <tr style={{ color: 'var(--ink-muted)', borderBottom: '1px solid var(--hair)' }}>
              <th className="px-3 py-2 text-left font-normal">Varlık</th>
              <th className="px-3 py-2 text-right font-normal">Miktar</th>
              <th className="px-3 py-2 text-right font-normal">Birim fiyat</th>
              <th className="px-3 py-2 text-right font-normal">Değer ₺</th>
              <th className="px-3 py-2 text-right font-normal">Gün %</th>
              <th className="px-3 py-2 text-right font-normal">Hafta %</th>
              <th className="px-3 py-2 text-right font-normal">Ay %</th>
              <th className="px-3 py-2 text-right font-normal">Yıl %</th>
              <th className="px-3 py-2 text-right font-normal">Maliyete göre</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {degerler.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center" style={{ color: 'var(--ink-muted)' }}>
                Henüz varlık yok. &quot;+ Varlık&quot; ile başla.
              </td></tr>
            )}
            {degerler.map((d) => {
              const deger = d.deger_tl === null ? null : Number(d.deger_tl)
              const yatirilan = Number(d.net_yatirilan_tl)
              const fark = deger !== null && yatirilan !== 0 ? deger - yatirilan : null
              const v = adlar.get(d.varlik_id)
              const g = getiriHaritasi.get(d.varlik_id)
              return (
                <tr key={d.varlik_id} style={{ borderBottom: '1px solid var(--hair)' }}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{d.kod}</span>
                    <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{SINIF_ETIKETI[d.sinif]}</span>
                    {v && v.kaynak_sembol && v.kaynak_sembol !== d.kod && (
                      <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>· {v.kaynak_sembol}</span>
                    )}
                  </td>
                  <td className="rakam px-3 py-2 text-right">
                    {v?.kaynak_tur === 'elle' || v?.kaynak_tur === 'nakit'
                      ? <span style={{ color: 'var(--ink-muted)' }}>—</span>
                      : miktarBicim(Number(d.miktar))}
                  </td>
                  <td className="rakam px-3 py-2 text-right">
                    {d.birim_fiyat === null
                      ? <span style={{ color: 'var(--ink-muted)' }}>—</span>
                      : fiyatBicim(Number(d.birim_fiyat), d.fiyat_para)}
                    <span className="ml-1.5 block text-[10px]" style={{ color: d.fiyat_olculdu === false ? 'var(--ciddi)' : 'var(--ink-muted)' }}>
                      {d.fiyat_tarihi ? tarihKisa(d.fiyat_tarihi) : '—'}
                      {d.fiyat_olculdu === false && ' · elle'}
                    </span>
                  </td>
                  <td className="rakam px-3 py-2 text-right font-medium">
                    {deger === null ? <span style={{ color: 'var(--ciddi)' }}>fiyat yok</span> : tl(deger)}
                  </td>
                  <td className="rakam px-3 py-2 text-right"><Yuzde deger={g?.gun_yuzde ?? null} /></td>
                  <td className="rakam px-3 py-2 text-right"><Yuzde deger={g?.hafta_yuzde ?? null} /></td>
                  <td className="rakam px-3 py-2 text-right"><Yuzde deger={g?.ay_yuzde ?? null} /></td>
                  <td className="rakam px-3 py-2 text-right"><Yuzde deger={g?.yil_yuzde ?? null} /></td>
                  <td className="rakam px-3 py-2 text-right" style={{ color: fark === null ? 'var(--ink-muted)' : fark >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)' }}>
                    {fark === null
                      ? <span className="text-[11px]">{yatirilan === 0 ? 'maliyet girilmedi' : '—'}</span>
                      : `${tl(fark)} · ${yuzde(fark / yatirilan)}`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button" disabled={bekliyor}
                      onClick={() => { if (confirm(`${d.kod} silinsin mi?`)) calistir(() => varlikSil(d.varlik_id)) }}
                      className="text-[12px]" style={{ color: 'var(--kritik)' }}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {degerler.length > 0 && (
            <tfoot>
              <tr>
                <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--ink-2)' }}>Toplam</td>
                <td colSpan={2} />
                <td className="rakam px-3 py-2 text-right text-[15px] font-semibold">{tl(toplam)}</td>
                <td colSpan={6} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        Yüzdeler <strong>birim fiyatın</strong> değişimidir; adet sabitse kalemin saf getirisi
        budur. &quot;Maliyete göre&quot; sütunu senin yatırdığın paraya kıyaslar, maliyet
        girmediysen boş kalır. Yeterli geçmişi olmayan kalemde dönem boş görünür — hisseler için
        &quot;Geçmişi çek&quot; bir yıllık seriyi doldurur; fon, altın ve nakit bugünden itibaren birikir.
      </p>

      {eksikFiyat.length > 0 && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--ciddi)' }}>
          Fiyatı okunamayan kalem var: {eksikFiyat.map((d) => d.kod).join(', ')} — toplam bu
          kalemleri İÇERMİYOR.
        </p>
      )}

      {/* ── Elle değer girilen kalemler ──────────────────────────────── */}
      {elleOlanlar.length > 0 && (
        <div className="kart mt-4 p-3">
          <h2 className="text-[13px] font-semibold">Elle değer gir</h2>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Fiyat kaynağı olmayan kalemler (BES, vadeli mevduat). Girdiğin değer o güne yazılır,
            tabloda &quot;elle&quot; diye işaretlenir.
          </p>
          <form action={(f) => calistir(() => elleFiyat(f))} className="mt-2 grid gap-2 sm:grid-cols-4">
            <select name="varlik_id" required aria-label="Varlık" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu}>
              {elleOlanlar.map((v) => <option key={v.id} value={v.id}>{v.kod} · {v.ad}</option>)}
            </select>
            <input type="date" name="tarih" defaultValue={bugun()} aria-label="Tarih" className="rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            <input name="fiyat" required inputMode="decimal" placeholder="Değer" aria-label="Değer" className="rakam rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            <button type="submit" disabled={bekliyor} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white" style={{ background: 'var(--seri-1)' }}>
              Kaydet
            </button>
          </form>
        </div>
      )}

      {/* ── Hareketler ───────────────────────────────────────────────── */}
      {hareketler.length > 0 && (
        <div className="kart mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr style={{ color: 'var(--ink-muted)', borderBottom: '1px solid var(--hair)' }}>
                <th className="px-3 py-2 text-left font-normal">Tarih</th>
                <th className="px-3 py-2 text-left font-normal">Varlık</th>
                <th className="px-3 py-2 text-left font-normal">Tür</th>
                <th className="px-3 py-2 text-right font-normal">Miktar</th>
                <th className="px-3 py-2 text-right font-normal">Tutar ₺</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {hareketler.map((h) => (
                <tr key={h.id} style={{ borderBottom: '1px solid var(--hair)' }}>
                  <td className="px-3 py-2">{tarihKisa(h.tarih)}</td>
                  <td className="px-3 py-2">{adlar.get(h.varlik_id)?.kod ?? h.varlik_id}</td>
                  <td className="px-3 py-2">{h.tur}</td>
                  <td className="rakam px-3 py-2 text-right">{miktarBicim(Number(h.miktar))}</td>
                  <td className="rakam px-3 py-2 text-right">{h.tutar === null ? '—' : tl(h.tutar)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button" disabled={bekliyor}
                      onClick={() => calistir(() => hareketSil(h.id))}
                      className="text-[12px]" style={{ color: 'var(--kritik)' }}
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
    </>
  )
}
