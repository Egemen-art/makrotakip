'use client'

import { useEffect, useState } from 'react'
import type { Kurlar } from '@/lib/tipler'
import type { KurGecmisi } from '@/app/api/kur/gecmis/route'
import { tl, tlKurus, usdKurus } from '@/lib/bicim'
import { SERIT_DONEMLERI, seriDegisimi, seriFarki, yuzdeMetni, yuzdeRengi, type SeritDonemi } from '@/lib/serit'

/**
 * Panonun ustundeki canli piyasa seridi: ons altin, gram altin, USD/TRY, EUR/USD.
 * Anlik deger /api/kur'dan (karar 42: tum ajanlar icin tek kur ucu); "dususte mi
 * yukseliste mi" yuzdesi /api/kur/gecmis'teki gunluk kapanis serisinden (PanoSeritleri
 * ceker, prop olarak gelir), secili doneme gore. Sayfa acildiktan SONRA cekilir —
 * kaynak yavaslarsa pano beklemesin. Gelmeyen alan "—" kalir; uydurma rakam yok.
 */

const ORAN = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const oran = (n: number | null | undefined) => (n === null || n === undefined ? '—' : ORAN.format(n))

const AY_ADI = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

/** Son aciklanan ayin yillik/aylik degisimi, seri basina (finans.v_enflasyon). */
export type EnflasyonKutulari = Record<'tufe' | 'cpi' | 'pce', { ay: string; yillik: number | null; aylik: number | null } | null>
/** ABD faiz serileri (FRED, gunluk): kutuda son deger, secili donemde baz puan farki. */
export type FaizSerileri = Record<'tr10y' | 'tr2y' | 'tcmb' | 'dgs10' | 'dgs2' | 'fedUst' | 'fedAlt', { tarih: string; deger: number }[]>
const FAIZ = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const faizMetni = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${FAIZ.format(n)} %`)
const bpMetni = (fark: number | null) => (fark === null ? null : `${fark > 0 ? '+' : ''}${Math.round(fark * 100)} bp`)
const kisaTarih = (iso: string) => `${Number(iso.slice(8, 10))} ${AY_ADI[Number(iso.slice(5, 7)) - 1]}`

const ayEtiketi = (ym: string) => `${AY_ADI[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const yuzdeDuz = (n: number | null) => (n === null ? '—' : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} %`)

export default function KurSeridi({
  donem = 'gun', gecmis = null, enflasyon = null, faiz = null,
}: {
  donem?: SeritDonemi
  gecmis?: KurGecmisi | null
  /** Enflasyon kutulari (karar 53); veri yoksa "—" ve anahtar notu. */
  enflasyon?: EnflasyonKutulari | null
  /** ABD faizleri: 10Y, 2Y, Fed hedef araligi. */
  faiz?: FaizSerileri | null
}) {
  const [kur, setKur] = useState<Kurlar | null>(null)
  const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'hata'>('yukleniyor')

  useEffect(() => {
    let iptal = false
    fetch('/api/kur', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((k: Kurlar) => { if (!iptal) { setKur(k); setDurum('hazir') } })
      .catch(() => { if (!iptal) setDurum('hata') })
    return () => { iptal = true }
  }, [])

  // EUR/USD dogrudan gelmiyor: iki TL kurundan capraz hesaplanir (ikisi de alis tarafi).
  const parite = kur?.eurtry && kur?.usdtry ? kur.eurtry / kur.usdtry : null
  const degisim = (seri: { tarih: string; deger: number }[] | undefined) => (seri ? seriDegisimi(seri, donem) : null)
  const donemAdi = SERIT_DONEMLERI.find((d) => d.kod === donem)?.ad ?? ''

  const kutular: { etiket: string; deger: string; alt: string; degisim: number | null }[] = [
    {
      etiket: 'Ons altın',
      deger: kur?.altin_ons_usd ? usdKurus(kur.altin_ons_usd) : '—',
      // Onsun TL karsiligi: kafadan carpmaya gerek kalmasin.
      alt: kur?.altin_ons_usd && kur?.usdtry ? `≈ ${tl(kur.altin_ons_usd * kur.usdtry)}` : 'XAU · $',
      degisim: degisim(gecmis?.ons),
    },
    {
      etiket: 'Gram altın',
      deger: kur?.altin_gram_alis_tl ? tlKurus(kur.altin_gram_alis_tl) : '—',
      alt: kur?.altin_gram_satis_tl ? `satış ${tlKurus(kur.altin_gram_satis_tl)}` : (kur?.kaynak.altin_gram ?? 'gram alış'),
      degisim: degisim(gecmis?.gram),
    },
    {
      etiket: 'USD/TRY',
      deger: oran(kur?.usdtry),
      alt: kur?.usdtry_satis ? `satış ${oran(kur.usdtry_satis)}` : (kur?.kaynak.usd ?? 'alış'),
      degisim: degisim(gecmis?.usdtry),
    },
    {
      etiket: 'EUR/USD',
      deger: oran(parite),
      alt: kur?.eurtry ? `EUR/TRY ${oran(kur.eurtry)}` : 'çapraz',
      degisim: degisim(gecmis?.eurusd),
    },
  ]

  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kutular.map((k) => (
          <div key={k.etiket} className="kart p-3">
            <div className="flex items-baseline justify-between gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              <span>{k.etiket}</span>
              {k.degisim !== null && (
                <span className="rakam shrink-0" title={`${donemAdi} değişimi (Yahoo kapanış)`} style={{ color: yuzdeRengi(k.degisim) }}>
                  {yuzdeMetni(k.degisim)}
                </span>
              )}
            </div>
            <div className="rakam mt-0.5 text-[17px] font-semibold leading-tight">
              {durum === 'yukleniyor' ? <span style={{ color: 'var(--ink-muted)' }}>…</span> : k.deger}
            </div>
            <div className="rakam mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              {durum === 'hazir' ? k.alt : ' '}
            </div>
          </div>
        ))}
      </div>

      {enflasyon && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {([['tufe', 'TÜFE (TÜİK)'], ['cpi', 'CPI-U (ABD)'], ['pce', 'PCE (ABD)']] as const).map(([k, ad]) => {
            const e = enflasyon[k]
            return (
              <div key={k} className="kart p-3">
                <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{ad} · yıllık</div>
                <div className="rakam mt-0.5 text-[17px] font-semibold leading-tight">{e ? yuzdeDuz(e.yillik) : '—'}</div>
                <div className="rakam mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  {e ? `aylık ${yuzdeDuz(e.aylik)} · ${ayEtiketi(e.ay)}` : 'veri yok'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {faiz && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([['tr10y', 'TR 10Y tahvil'], ['tr2y', 'TR 2Y tahvil']] as const).map(([k, ad]) => {
            const seri = faiz[k]
            const son = seri.at(-1) ?? null
            const fark = seriFarki(seri, donem)
            return (
              <div key={k} className="kart p-3">
                <div className="flex items-baseline justify-between gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  <span>{ad}</span>
                  {fark !== null && <span className="rakam shrink-0" title={`${donemAdi} değişimi, baz puan`} style={{ color: yuzdeRengi(fark) }}>{bpMetni(fark)}</span>}
                </div>
                <div className="rakam mt-0.5 text-[17px] font-semibold leading-tight">{faizMetni(son?.deger)}</div>
                <div className="rakam mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{son ? `gösterge getiri · ${kisaTarih(son.tarih)}` : 'veri yok'}</div>
              </div>
            )
          })}
          {(() => {
            const seri = faiz.tcmb
            const son = seri.at(-1) ?? null
            const fark = seriFarki(seri, donem)
            return (
              <div className="kart p-3">
                <div className="flex items-baseline justify-between gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  <span>TCMB politika faizi</span>
                  {fark !== null && fark !== 0 && <span className="rakam shrink-0" title={`${donemAdi} değişimi, baz puan`} style={{ color: yuzdeRengi(fark) }}>{bpMetni(fark)}</span>}
                </div>
                <div className="rakam mt-0.5 text-[17px] font-semibold leading-tight">{faizMetni(son?.deger)}</div>
                <div className="rakam mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{son ? `1 hafta repo · ${kisaTarih(son.tarih)}'den beri` : 'veri yok'}</div>
              </div>
            )
          })()}
          {([['dgs10', 'ABD 10Y tahvil'], ['dgs2', 'ABD 2Y tahvil']] as const).map(([k, ad]) => {
            const seri = faiz[k]
            const son = seri.at(-1) ?? null
            const fark = seriFarki(seri, donem)
            return (
              <div key={k} className="kart p-3">
                <div className="flex items-baseline justify-between gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  <span>{ad}</span>
                  {fark !== null && <span className="rakam shrink-0" title={`${donemAdi} değişimi, baz puan`} style={{ color: yuzdeRengi(fark) }}>{bpMetni(fark)}</span>}
                </div>
                <div className="rakam mt-0.5 text-[17px] font-semibold leading-tight">{faizMetni(son?.deger)}</div>
                <div className="rakam mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{son ? `getiri · ${kisaTarih(son.tarih)}` : 'veri yok'}</div>
              </div>
            )
          })}
          {(() => {
            const ust = faiz.fedUst.at(-1) ?? null
            const alt = faiz.fedAlt.at(-1) ?? null
            const fark = seriFarki(faiz.fedUst, donem)
            return (
              <div className="kart p-3">
                <div className="flex items-baseline justify-between gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  <span>Fed politika faizi</span>
                  {fark !== null && fark !== 0 && <span className="rakam shrink-0" title={`${donemAdi} değişimi, baz puan`} style={{ color: yuzdeRengi(fark) }}>{bpMetni(fark)}</span>}
                </div>
                <div className="rakam mt-0.5 text-[17px] font-semibold leading-tight">
                  {ust && alt ? `${FAIZ.format(alt.deger)}–${FAIZ.format(ust.deger)} %` : '—'}
                </div>
                <div className="rakam mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{ust ? `hedef aralık · ${kisaTarih(ust.tarih)}` : 'veri yok'}</div>
              </div>
            )
          })()}
        </div>
      )}

      <p className="mt-1 text-[11px]" style={{ color: durum === 'hata' ? 'var(--ciddi)' : 'var(--ink-muted)' }}>
        {durum === 'hata'
          ? 'Piyasa verisi alınamadı.'
          : durum === 'yukleniyor'
            ? 'Piyasa verisi alınıyor…'
            : [
                kur?.piyasa_zamani ?? null,
                'EUR/USD, TL kurlarından çapraz',
                gecmis ? `değişim: ${donemAdi.toLocaleLowerCase('tr')} · gram altın = ons × kur` : 'değişim serisi alınıyor…',
              ].filter(Boolean).join(' · ')}
        {durum === 'hazir' && kur?.uyarilar.length ? (
          <span style={{ color: 'var(--ciddi)' }}> · {kur.uyarilar[0]}</span>
        ) : null}
      </p>
    </div>
  )
}
