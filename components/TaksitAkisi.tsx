'use client'

import { useState } from 'react'
import type { BekleyenTaksit, YansiyanTaksit } from '@/lib/taksit'
import { tarihKisa, tl, tlKurus } from '@/lib/bicim'

/**
 * Taksitlerin gidere yansima durumu: bu ay yansiyacak / bu ay yansidi /
 * toplam bekleyen / kesimi gecmis yazilmamis. Kutuya tiklayinca alttaki
 * tablo SUZULUR — sayfa yenilenmez, adres degismez, kaydirma yerinde kalir.
 * Ayni bilesen panoda (kompakt) ve Taksitler sayfasinda (tam) kullanilir.
 */

type Suzgec = 'buay' | 'yansidi' | 'tumu' | 'gecikmis'

const YUK_RENGI: Record<string, string> = {
  'Kendi gideri': 'var(--seri-1)',
  'Şirket ödüyor': 'var(--iyi)',
  'Kişi ödüyor': 'var(--seri-5)',
  Belirsiz: 'var(--uyari)',
}

type Satir = {
  anahtar: string
  tarih: string | null
  ay: string
  urun: string
  kategori: string | null
  kart: string | null
  no: number | null
  toplamTaksit: number | null
  tutar: number
  yukSahibi: string | null
  durum: 'bekliyor' | 'gecikmis' | 'yazildi' | 'dogrulanmadi'
}

const toplam = (s: { tutar: number }[]) => s.reduce((t, x) => t + x.tutar, 0)

export default function TaksitAkisi({
  bekleyen, yansiyan, bugun, kompakt = false, baslangic = 'buay',
}: {
  bekleyen: BekleyenTaksit[]
  yansiyan: YansiyanTaksit[]
  bugun: string
  kompakt?: boolean
  baslangic?: Suzgec | null
}) {
  // Ayni kutuya ikinci tiklama suzgeci kapatir; tablo gizlenir.
  const [suzgec, setSuzgec] = useState<Suzgec | null>(baslangic)
  const buAy = bugun.slice(0, 7)

  const bekleyenSatir = (b: BekleyenTaksit): Satir => ({
    anahtar: `b-${b.plan.id}-${b.no}`, tarih: b.tarih, ay: b.ay, urun: b.plan.urun,
    kategori: b.plan.kategori ? `${b.plan.kategori}${b.plan.alt_kategori ? ` › ${b.plan.alt_kategori}` : ''}` : null,
    kart: b.plan.kart, no: b.no, toplamTaksit: b.plan.taksit_sayisi, tutar: b.tutar, yukSahibi: b.plan.yuk_sahibi,
    durum: b.gecikmis ? 'gecikmis' : b.plan.durum === 'Doğrulanmadı' ? 'dogrulanmadi' : 'bekliyor',
  })
  const yansiyanSatir = (y: YansiyanTaksit): Satir => ({
    anahtar: `y-${y.id}`, tarih: y.tarih, ay: y.tarih.slice(0, 7), urun: y.plan?.urun ?? `plan #${y.plan ?? '?'}`,
    kategori: y.plan?.kategori ? `${y.plan.kategori}${y.plan.alt_kategori ? ` › ${y.plan.alt_kategori}` : ''}` : null,
    kart: y.plan?.kart ?? null, no: y.no, toplamTaksit: y.plan?.taksit_sayisi ?? null, tutar: y.tutar,
    yukSahibi: y.plan?.yuk_sahibi ?? null, durum: 'yazildi',
  })

  const buAyBekleyen = bekleyen.filter((b) => b.ay === buAy)
  const gecikmis = bekleyen.filter((b) => b.gecikmis)
  const kumeler: Record<Suzgec, Satir[]> = {
    buay: buAyBekleyen.map(bekleyenSatir),
    yansidi: yansiyan.map(yansiyanSatir),
    tumu: bekleyen.map(bekleyenSatir),
    gecikmis: gecikmis.map(bekleyenSatir),
  }
  const listelenen = suzgec === null ? [] : kumeler[suzgec]

  const kutular: { kod: Suzgec; ad: string; tutar: number; adet: number; alt: string; renk?: string }[] = [
    { kod: 'buay', ad: 'Bu ay yansıyacak', tutar: toplam(buAyBekleyen), adet: buAyBekleyen.length, alt: 'gidere henüz girmedi' },
    { kod: 'yansidi', ad: 'Bu ay yansıdı', tutar: toplam(yansiyan), adet: yansiyan.length, alt: 'deftere yazıldı' },
    { kod: 'tumu', ad: 'Toplam bekleyen', tutar: toplam(bekleyen), adet: bekleyen.length, alt: 'tüm aylar' },
  ]
  if (gecikmis.length > 0) {
    kutular.push({ kod: 'gecikmis', ad: 'Kesimi geçmiş, yazılmamış', tutar: toplam(gecikmis), adet: gecikmis.length, alt: 'ekstre gelince doğrulanır', renk: 'var(--ciddi)' })
  }

  const durumMetni = (s: Satir) =>
    s.durum === 'yazildi' ? 'deftere yazıldı'
      : s.durum === 'gecikmis' ? 'kesim geçti, yazılmadı'
        : s.durum === 'dogrulanmadi' ? 'plan doğrulanmadı' : 'bekliyor'
  const durumRengi = (s: Satir) =>
    s.durum === 'yazildi' ? 'var(--artis-iyi)' : s.durum === 'gecikmis' ? 'var(--ciddi)' : 'var(--ink-muted)'

  return (
    <div>
      <div className={`grid gap-2 ${kompakt ? 'grid-cols-2' : 'grid-cols-2 gap-3 lg:grid-cols-4'}`}>
        {kutular.map((k) => {
          const aktif = suzgec === k.kod
          return (
            <button
              key={k.kod} type="button" onClick={() => setSuzgec((s) => (s === k.kod ? null : k.kod))} aria-pressed={aktif}
              className={`kart text-left hover:bg-[var(--plane)] ${kompakt ? 'px-3 py-2' : 'p-4'}`}
              style={{ borderColor: aktif ? 'var(--seri-1)' : k.renk, boxShadow: aktif ? '0 0 0 1px var(--seri-1)' : undefined }}
            >
              <div className={kompakt ? 'text-[11px]' : 'text-[12px]'} style={{ color: k.renk ?? 'var(--ink-muted)' }}>{k.ad}</div>
              <div className={`rakam font-semibold ${kompakt ? 'text-[15px]' : 'mt-1 text-[22px]'}`}>{tl(k.tutar)}</div>
              <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{k.adet} taksit · {k.alt}</div>
            </button>
          )
        })}
      </div>

      {suzgec === null ? (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>Ayrıntı için bir kutuya tıkla.</p>
      ) : listelenen.length === 0 ? (
        <p className={`text-center text-[12px] ${kompakt ? 'py-3' : 'kart mt-3 p-6 text-[13px]'}`} style={{ color: 'var(--ink-muted)' }}>
          Bu kümede taksit yok.
        </p>
      ) : (
        <div className={`overflow-x-auto ${kompakt ? 'mt-2' : 'kart mt-3'}`}>
          <table className={`w-full ${kompakt ? 'text-[12px]' : 'min-w-[720px] text-[13px]'}`}>
            <thead>
              <tr className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                <th className={`text-left font-medium ${kompakt ? 'py-1 pr-2' : 'px-3 py-2'}`}>Tarih</th>
                <th className={`text-left font-medium ${kompakt ? 'py-1 pr-2' : 'px-3 py-2'}`}>Ürün</th>
                {!kompakt && <th className="px-3 py-2 text-left font-medium">Kart</th>}
                <th className={`text-center font-medium ${kompakt ? 'py-1 pr-2' : 'px-3 py-2'}`}>Taksit</th>
                <th className={`text-right font-medium ${kompakt ? 'py-1 pr-2' : 'px-3 py-2'}`}>Tutar</th>
                {!kompakt && <th className="px-3 py-2 text-left font-medium">Yük sahibi</th>}
                <th className={`text-left font-medium ${kompakt ? 'py-1' : 'px-3 py-2'}`}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {listelenen.map((s) => (
                <tr key={s.anahtar} style={{ borderTop: '1px solid var(--hair)' }}>
                  <td className={`rakam whitespace-nowrap ${kompakt ? 'py-1 pr-2' : 'px-3 py-2'}`} style={{ color: s.durum === 'gecikmis' ? 'var(--ciddi)' : undefined }}>
                    {s.tarih ? tarihKisa(s.tarih) : s.ay}
                  </td>
                  <td className={kompakt ? 'py-1 pr-2' : 'px-3 py-2'}>
                    <span className={kompakt ? 'block max-w-[160px] truncate' : ''}>{s.urun}</span>
                    {!kompakt && s.kategori && <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{s.kategori}</div>}
                  </td>
                  {!kompakt && <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>{s.kart ?? '—'}</td>}
                  <td className={`rakam text-center ${kompakt ? 'py-1 pr-2' : 'px-3 py-2'}`}>
                    {s.no ?? '?'}{s.toplamTaksit ? `/${s.toplamTaksit}` : ''}
                  </td>
                  <td className={`rakam text-right ${kompakt ? 'py-1 pr-2' : 'px-3 py-2'}`}>{tlKurus(s.tutar)}</td>
                  {!kompakt && (
                    <td className="px-3 py-2">
                      {s.yukSahibi && (
                        <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
                          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: YUK_RENGI[s.yukSahibi] }} />
                          {s.yukSahibi}
                        </span>
                      )}
                    </td>
                  )}
                  <td className={`text-[11px] ${kompakt ? 'py-1' : 'px-3 py-2 text-[12px]'}`} style={{ color: durumRengi(s) }}>{durumMetni(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
