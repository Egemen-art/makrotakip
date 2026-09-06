'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import type { HesapBakiye, Kurlar, PortfoyGetiri } from '@/lib/tipler'
import { bugun, sayiOku, tarihKisa, tl, tlKurus, yuzde } from '@/lib/bicim'
import { portfoyKaydet, portfoySil, type Birim } from './eylemler'

const kutu: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)',
}

type Alan = 'ppf' | 'vadeli_mevduat' | 'hisse_abd' | 'hisse_bist' | 'altin_fiziksel' | 'altin_etf' | 'nakit' | 'bes'

/**
 * Her kalem kendi biriminde girilir; TL'ye cevirme sunucuda (eylemler.ts).
 * Buradaki "= ₺" onizlemesi ayni kurla ayni carpimdir, yalniz gosterim.
 * GRAM yalniz fiziksel altinda anlamli; digerleri ₺/$/€.
 */
const KALEMLER: { ad: Alan; etiket: string; birimler: Birim[]; varsayilan: Birim }[] = [
  { ad: 'ppf',            etiket: 'PPF',              birimler: ['TRY', 'USD', 'EUR'], varsayilan: 'TRY' },
  { ad: 'vadeli_mevduat', etiket: 'Vadeli mevduat',   birimler: ['TRY', 'USD', 'EUR'], varsayilan: 'TRY' },
  { ad: 'hisse_abd',      etiket: 'Hisse (ABD)',      birimler: ['USD', 'TRY'],        varsayilan: 'USD' },
  { ad: 'hisse_bist',     etiket: 'Hisse (BİST)',     birimler: ['TRY'],               varsayilan: 'TRY' },
  { ad: 'altin_fiziksel', etiket: 'Altın (fiziksel)', birimler: ['GRAM', 'TRY'],       varsayilan: 'GRAM' },
  { ad: 'altin_etf',      etiket: 'Altın (ETF)',      birimler: ['TRY', 'USD'],        varsayilan: 'TRY' },
  { ad: 'nakit',          etiket: 'Nakit',            birimler: ['TRY', 'USD', 'EUR'], varsayilan: 'TRY' },
  { ad: 'bes',            etiket: 'BES',              birimler: ['TRY'],               varsayilan: 'TRY' },
]
const BIRIM_ETIKETI: Record<Birim, string> = { TRY: '₺', USD: '$', EUR: '€', GRAM: 'gram' }

/** Sayiyi girdi kutusuna Turkce ondalikla, binlik ayiraci OLMADAN yaz ("3531,09"). */
const girdiMetni = (n: number | null | undefined, basamak = 2) =>
  n === null || n === undefined || !isFinite(n) ? '' : n.toFixed(basamak).replace(/\.?0+$/, '').replace('.', ',')

export default function PortfoyYonetimi({ satirlar, ykBakiye }: { satirlar: PortfoyGetiri[]; ykBakiye: HesapBakiye | null }) {
  const [acik, setAcik] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, basla] = useTransition()

  const tersSirali = [...satirlar].reverse()
  const son = tersSirali[0]

  // Son kayittan on-dolum: altin gram, hisse ABD dolar olarak geri hesaplanir (kur kayitta varsa).
  const [miktar, setMiktar] = useState<Record<Alan, string>>(() => {
    const m = {} as Record<Alan, string>
    const s = (k: keyof PortfoyGetiri) => Number(son?.[k] ?? 0)
    for (const k of KALEMLER) m[k.ad] = girdiMetni(s(k.ad))
    if (son?.altin_gram_tl && s('altin_gram_tl') > 0) m.altin_fiziksel = girdiMetni(s('altin_fiziksel') / s('altin_gram_tl'), 3)
    if (son?.usdtry && s('usdtry') > 0) m.hisse_abd = girdiMetni(s('hisse_abd') / s('usdtry'))
    // Nakit: gorevin yazdigi en son YK guncel bakiyesi varsa o; yoksa son kayittaki deger.
    if (ykBakiye) m.nakit = girdiMetni(Number(ykBakiye.bakiye))
    return m
  })
  const ykGunFarki = ykBakiye
    ? Math.round((Date.parse(bugun()) - Date.parse(ykBakiye.tarih)) / 86_400_000)
    : null
  const [birim, setBirim] = useState<Record<Alan, Birim>>(() => {
    const b = {} as Record<Alan, Birim>
    for (const k of KALEMLER) b[k.ad] = k.varsayilan
    if (!son?.altin_gram_tl) b.altin_fiziksel = 'TRY'
    if (!son?.usdtry) b.hisse_abd = 'TRY'
    return b
  })

  // Kurlar: form acilinca /api/kur'dan gelir, kutulara yazilir, elle degistirilebilir.
  const [kurlar, setKurlar] = useState<Kurlar | null>(null)
  const [kurDurumu, setKurDurumu] = useState<'bekliyor' | 'hazir' | 'hata'>('bekliyor')
  const [kur, setKur] = useState({ usdtry: '', eurtry: '', altin_gram_tl: '' })
  useEffect(() => {
    if (!acik || kurlar) return
    let iptal = false
    setKurDurumu('bekliyor')
    fetch('/api/kur', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((k: Kurlar) => {
        if (iptal) return
        setKurlar(k)
        setKur({
          usdtry: girdiMetni(k.usdtry, 4),
          eurtry: girdiMetni(k.eurtry, 4),
          altin_gram_tl: girdiMetni(k.altin_gram_alis_tl, 2),
        })
        setKurDurumu('hazir')
      })
      .catch(() => { if (!iptal) setKurDurumu('hata') })
    return () => { iptal = true }
  }, [acik, kurlar])

  // Onizleme: sunucuyla ayni carpim.
  const oran = (b: Birim): number | null =>
    b === 'TRY' ? 1 : b === 'USD' ? sayiOku(kur.usdtry) : b === 'EUR' ? sayiOku(kur.eurtry) : sayiOku(kur.altin_gram_tl)
  const onizleme = useMemo(() => {
    const p = {} as Record<Alan, number | null>
    let toplam = 0; let eksik = false
    for (const k of KALEMLER) {
      const m = sayiOku(miktar[k.ad]) ?? 0
      const o = oran(birim[k.ad])
      if (m === 0) { p[k.ad] = 0; continue }
      if (o === null || o <= 0) { p[k.ad] = null; eksik = true; continue }
      p[k.ad] = Math.round(m * o * 100) / 100
      toplam += p[k.ad]!
    }
    return { p, toplam, eksik }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miktar, birim, kur])

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Geçmiş</h2>
        <button
          onClick={() => setAcik((v) => !v)}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white"
          style={{ background: 'var(--seri-1)' }}
        >
          {acik ? 'Formu kapat' : '+ Anlık görüntü ekle'}
        </button>
      </div>

      {acik && (
        <div className="kart mb-3 p-3">
          {/* Kur seridi */}
          <div className="mb-3 rounded-lg p-3" style={{ background: 'var(--plane)', border: '1px solid var(--hair)' }}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[12px] font-medium">Kurlar</span>
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {kurDurumu === 'bekliyor' && 'piyasadan çekiliyor…'}
                {kurDurumu === 'hata' && 'kur ucu yanıt vermedi — elle gir'}
                {kurDurumu === 'hazir' && kurlar && (
                  <>alış · {kurlar.piyasa_zamani ?? new Date(kurlar.zaman).toLocaleString('tr-TR')}
                    {kurlar.altin_ons_usd !== null && <> · ons {kurlar.altin_ons_usd.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} $</>}
                  </>
                )}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Alan etiket={`USD/TRY${kurlar?.kaynak.usd ? ` · ${kurlar.kaynak.usd}` : ''}`}>
                <input name="usdtry" form="portfoy-formu" inputMode="decimal" value={kur.usdtry}
                  onChange={(e) => setKur({ ...kur, usdtry: e.target.value })}
                  className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
              </Alan>
              <Alan etiket={`EUR/TRY${kurlar?.kaynak.eur ? ` · ${kurlar.kaynak.eur}` : ''}`}>
                <input name="eurtry" form="portfoy-formu" inputMode="decimal" value={kur.eurtry}
                  onChange={(e) => setKur({ ...kur, eurtry: e.target.value })}
                  className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
              </Alan>
              <Alan etiket={`Gram altın ₺${kurlar?.kaynak.altin_gram ? ` · ${kurlar.kaynak.altin_gram}` : ''}`}>
                <input name="altin_gram_tl" form="portfoy-formu" inputMode="decimal" value={kur.altin_gram_tl}
                  onChange={(e) => setKur({ ...kur, altin_gram_tl: e.target.value })}
                  className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
              </Alan>
            </div>
            {kurlar && kurlar.uyarilar.length > 0 && (
              <ul className="mt-2 text-[11px]" style={{ color: 'var(--ciddi)' }}>
                {kurlar.uyarilar.map((u) => <li key={u}>⚠ {u}</li>)}
              </ul>
            )}
          </div>

          <form
            id="portfoy-formu"
            action={(form) => {
              setHata(null)
              basla(async () => {
                const s = await portfoyKaydet(form)
                if (s.tamam) setAcik(false)
                else setHata(s.hata)
              })
            }}
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          >
            <input type="hidden" name="altin_ons_usd" value={kurlar?.altin_ons_usd ?? ''} />
            <Alan etiket="Tarih">
              <input type="date" name="tarih" required defaultValue={bugun()} className="w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            </Alan>

            {KALEMLER.map((k) => {
              const deger = onizleme.p[k.ad]
              const b = birim[k.ad]
              return (
                <Alan key={k.ad} etiket={k.etiket}>
                  <div className="flex gap-1">
                    <input
                      name={k.ad} inputMode="decimal" value={miktar[k.ad]}
                      onChange={(e) => setMiktar({ ...miktar, [k.ad]: e.target.value })}
                      className="rakam w-full min-w-0 rounded-lg px-2 py-1.5 text-[13px]" style={kutu}
                    />
                    {k.birimler.length === 1 ? (
                      <>
                        <input type="hidden" name={`${k.ad}_birim`} value={b} />
                        <span className="flex shrink-0 items-center px-1.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>{BIRIM_ETIKETI[b]}</span>
                      </>
                    ) : (
                      <select
                        name={`${k.ad}_birim`} value={b} aria-label={`${k.etiket} birimi`}
                        onChange={(e) => setBirim({ ...birim, [k.ad]: e.target.value as Birim })}
                        className="shrink-0 rounded-lg px-1.5 py-1.5 text-[12px]" style={kutu}
                      >
                        {k.birimler.map((x) => <option key={x} value={x}>{BIRIM_ETIKETI[x]}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="rakam mt-0.5 text-[11px]" style={{ color: deger === null ? 'var(--kritik)' : 'var(--ink-muted)' }}>
                    {k.ad === 'nakit' && b === 'TRY'
                      ? (ykBakiye
                          ? <span style={{ color: (ykGunFarki ?? 0) > 3 ? 'var(--ciddi)' : 'var(--ink-muted)' }}>
                              YK güncel bakiye · {tarihKisa(ykBakiye.tarih)}{(ykGunFarki ?? 0) > 3 ? ` · ${ykGunFarki} gün eski` : ''}
                            </span>
                          : <span>YK bakiyesi henüz yazılmamış · elle gir</span>)
                      : b === 'TRY' ? ' ' : deger === null ? 'kur yok' : `= ${tl(deger)}`}
                  </div>
                </Alan>
              )
            })}

            <Alan etiket="Eklenen / Çekilen ₺">
              <input
                name="eklenen_cekilen" inputMode="decimal" required defaultValue="0"
                className="rakam w-full rounded-lg px-2 py-1.5 text-[13px]"
                style={{ ...kutu, borderColor: 'var(--uyari)' }}
              />
            </Alan>
            <Alan etiket="Not">
              <input name="not_" className="w-full rounded-lg px-2 py-1.5 text-[13px]" style={kutu} />
            </Alan>

            <div className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 sm:col-span-2 lg:col-span-4" style={{ background: 'var(--plane)' }}>
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Toplam (₺ karşılığı)</span>
              <span className="rakam text-[15px] font-semibold" style={{ color: onizleme.eksik ? 'var(--kritik)' : 'var(--ink)' }}>
                {onizleme.eksik ? 'eksik kur var' : tl(onizleme.toplam)}
              </span>
            </div>

            <p className="text-[11px] sm:col-span-2 lg:col-span-4" style={{ color: 'var(--ink-muted)' }}>
              Kurlar kayıtla birlikte dondurulur; geçmiş her zaman o günkü kurla okunur.
              Para giriş/çıkışı olmadıysa <strong>Eklenen / Çekilen</strong> 0 kalsın — boş bırakılırsa getiri olduğundan yüksek çıkar.
              Aynı tarihte kayıt varsa güncellenir.
            </p>

            {hata && (
              <p role="alert" className="text-[12px] sm:col-span-2 lg:col-span-4" style={{ color: 'var(--kritik)' }}>{hata}</p>
            )}

            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="submit" disabled={bekliyor || onizleme.eksik}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--seri-1)' }}
              >
                {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="kart overflow-x-auto">
        <table className="w-full min-w-[680px] text-[13px]">
          <thead>
            <tr style={{ color: 'var(--ink-muted)' }}>
              <th className="px-3 py-2 text-left font-medium">Tarih</th>
              <th className="px-3 py-2 text-right font-medium">Toplam</th>
              <th className="px-3 py-2 text-right font-medium">Eklenen / Çekilen</th>
              <th className="px-3 py-2 text-right font-medium">Net getiri</th>
              <th className="px-3 py-2 text-right font-medium">Getiri %</th>
              <th className="px-3 py-2 text-right font-medium">USD · gram</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tersSirali.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--hair)' }}>
                <td className="rakam px-3 py-2">{tarihKisa(s.tarih)}</td>
                <td className="rakam px-3 py-2 text-right font-medium">{tl(s.toplam_tl)}</td>
                <td className="rakam px-3 py-2 text-right" style={{ color: 'var(--ink-2)' }}>{tlKurus(s.eklenen_cekilen)}</td>
                <td className="rakam px-3 py-2 text-right"
                  style={{ color: s.net_getiri === null ? 'var(--ink-muted)' : Number(s.net_getiri) >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)' }}>
                  {s.net_getiri === null ? '—' : tl(s.net_getiri)}
                </td>
                <td className="rakam px-3 py-2 text-right" style={{ color: 'var(--ink-2)' }}>
                  {s.getiri_yuzde === null ? '—' : yuzde(Number(s.getiri_yuzde))}
                </td>
                <td className="rakam px-3 py-2 text-right text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                  {s.usdtry ? Number(s.usdtry).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—'}
                  {' · '}
                  {s.altin_gram_tl ? Number(s.altin_gram_tl).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => {
                      if (!confirm(`${tarihKisa(s.tarih)} kaydı silinsin mi?`)) return
                      basla(async () => {
                        const r = await portfoySil(s.id)
                        if (!r.tamam) setHata(r.hata)
                      })
                    }}
                    disabled={bekliyor}
                    className="text-[12px] disabled:opacity-50" style={{ color: 'var(--kritik)' }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Alan({ etiket, children }: { etiket: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{etiket}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  )
}
