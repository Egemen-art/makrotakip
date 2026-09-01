import Link from 'next/link'
import { panoVerisi } from '@/lib/veri'
import { Istatistik, ParaSatiri } from '@/components/Istatistik'
import Bolum from '@/components/Bolum'
import TrendGrafigi from '@/components/grafik/TrendGrafigi'
import KategoriGrafigi from '@/components/grafik/KategoriGrafigi'
import { bugun, donemEtiket, tarihKisa, tl, tlKurus } from '@/lib/bicim'

export const dynamic = 'force-dynamic'

const say = (n: string | null | undefined) => Number(n ?? 0)

export default async function Pano() {
  const d = await panoVerisi()

  const buAy = bugun().slice(0, 7)
  const siraliOzet = [...d.ozet].sort((a, b) => a.ay.localeCompare(b.ay))
  const buAyOzet = siraliOzet.find((o) => o.ay === buAy)
  const gecenAyOzet = siraliOzet.filter((o) => o.ay < buAy).at(-1)

  const oran = (simdi: number, once: number) => (once > 0 ? (simdi - once) / once : NaN)
  const giderDelta = gecenAyOzet
    ? { oran: oran(say(buAyOzet?.gider), say(gecenAyOzet.gider)), artisIyiMi: false }
    : null
  const gelirDelta = gecenAyOzet
    ? { oran: oran(say(buAyOzet?.gelir), say(gecenAyOzet.gelir)), artisIyiMi: true }
    : null

  const net = say(buAyOzet?.gelir) - say(buAyOzet?.gider)

  const kartBorcu = d.kartlar.reduce((t, k) => t + say(k.ekstre_borcu), 0)
  const kartKullanim = d.kartlar.reduce((t, k) => t + say(k.kullanim_tl), 0)
  const toplamLimit = d.kartlar.reduce((t, k) => t + say(k.limit_tl), 0)
  const portfoyToplam = say(d.portfoy?.toplam_tl)
  const netPozisyon = portfoyToplam - kartBorcu

  const aylikYuk = d.taksitler.reduce((t, p) => t + say(p.aylik_tutar), 0)
  const kendiYuku = d.taksitler
    .filter((p) => p.yuk_sahibi === 'Kendi gideri')
    .reduce((t, p) => t + say(p.aylik_tutar), 0)

  const trend = siraliOzet.slice(-12).map((o) => ({
    ay: o.ay, gider: say(o.gider), gelir: say(o.gelir), aktarim: say(o.aktarim),
  }))

  // Sapma: finans.kategori_bant(bu ay). Olculen ay bandin DISINDA kalir; bant
  // ondan onceki 6 tam aydan kurulur. Esik `esik` sutunudur (= max(ust_sinir,
  // ortalama+2σ)) — `ust_sinir` degil, o sadece bandin ust ucu.
  // 20 aylik ortalama kullanilmaz: Market kategorisi 2025/2026 arasinda
  // siniflandirma degisikligiyle kirildi, uzun ortalama yanlis alarm uretir.
  // Kaynak: finans.kararlar > "Sapma olcusu".
  const buAyKategori = new Map<string, number>()
  for (const k of d.seriler.ay) {
    if (k.donem === buAy && k.yon === 'Gider') {
      buAyKategori.set(k.kategori, Number(k.toplam))
    }
  }
  const sapmalar = d.bant
    .map((b) => ({ ...b, simdi: buAyKategori.get(b.kategori) ?? 0 }))
    .filter((b) => b.simdi > Number(b.esik))
    .sort((a, b) => (b.simdi - Number(b.esik)) - (a.simdi - Number(a.esik)))
    .slice(0, 5)

  return (
    <>
      {d.hatalar.length > 0 && (
        <div
          className="kart mb-4 p-3 text-[13px]"
          style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}
        >
          Veri çekilirken hata: {d.hatalar[0]}
        </div>
      )}

      {d.soruSayisi > 0 && (
        <Link
          href="/sorular"
          className="kart mb-4 flex items-center gap-3 p-3.5 transition-colors hover:opacity-90"
          style={{ borderColor: 'var(--uyari)' }}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ background: 'var(--uyari)', color: '#0b0b0b' }}
            aria-hidden
          >
            {d.soruSayisi}
          </span>
          <span className="text-[13px]">
            <strong className="font-semibold">Sınıflandırılmayı bekleyen işlem var.</strong>{' '}
            <span style={{ color: 'var(--ink-2)' }}>Soru kutusunu aç →</span>
          </span>
        </Link>
      )}

      <h1 className="text-[17px] font-semibold">
        {donemEtiket(buAy)} <span style={{ color: 'var(--ink-muted)' }}>· özet</span>
      </h1>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Istatistik
          etiket="Bu ay gider" deger={tl(say(buAyOzet?.gider))}
          delta={giderDelta} altMetin="ay devam ediyor"
        />
        <Istatistik
          etiket="Bu ay gelir" deger={tl(say(buAyOzet?.gelir))}
          delta={gelirDelta} altMetin="ay devam ediyor"
        />
        <Istatistik
          etiket="Bu ay aktarım" deger={tl(say(buAyOzet?.aktarim))}
          altMetin="gider değil · yer değiştirme"
        />
        <Istatistik
          etiket="Net (gelir − gider)" deger={tl(net)}
          vurgu={net >= 0 ? 'iyi' : 'kritik'}
          altMetin={
            say(buAyOzet?.hesaplasma) > 0
              ? `ayrıca ${tl(say(buAyOzet?.hesaplasma))} hesaplaşma`
              : undefined
          }
        />
      </div>

      <Bolum
        baslik="Aylık gider, gelir ve aktarım"
        aciklama="Arşiv ve canlı defter birlikte · son 12 ay. Aktarım toplamlara girmez ama görünür kalır."
      >
        <TrendGrafigi veri={trend} />
      </Bolum>

      <Bolum
        baslik="Kategori kıyaslama"
        aciklama="Dönem ve kategori seç; renkler kategoriye sabittir"
      >
        <KategoriGrafigi seriler={d.seriler} />
      </Bolum>

      {sapmalar.length > 0 && (
        <Bolum
          baslik="Bandın dışında"
          aciklama="Son 7 ayın bandına göre bu ay yüksek kalan kategoriler"
        >
          <ul>
            {sapmalar.map((b) => (
              <li
                key={b.kategori}
                className="flex items-baseline justify-between gap-3 py-1.5"
              >
                <span className="text-[13px]">{b.kategori}</span>
                <span className="flex items-baseline gap-2 text-[13px]">
                  <span className="rakam font-medium" style={{ color: 'var(--ciddi)' }}>
                    {tl(b.simdi)}
                  </span>
                  <span className="rakam text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    bant {tl(b.alt_sinir)}–{tl(b.ust_sinir)} · eşik {tl(b.esik)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Ay devam ediyor; eşiği geçmek kesin aşım değil, bakılacak yer demek.
            Bant, ölçülen aydan önceki 6 tam aydan kuruluyor.
          </p>
        </Bolum>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Bolum baslik="Denge" aciklama="Portföy, kart borçları ve net pozisyon" baglanti={{ yol: '/portfoy', ad: 'Portföy' }}>
          <ParaSatiri
            ad="Portföy toplamı"
            deger={portfoyToplam}
            ikincil={d.portfoy ? tarihKisa(d.portfoy.tarih) : undefined}
          />
          <ParaSatiri ad="Kart ekstre borcu" deger={-kartBorcu} />
          <ParaSatiri ad="Kart kullanımı" deger={-kartKullanim} ikincil="taksitler dahil" />
          <div className="my-1.5" style={{ borderTop: '1px solid var(--hair)' }} />
          <div className="flex items-baseline justify-between gap-3 py-1">
            <span className="text-[13px] font-medium">Net pozisyon</span>
            <span
              className="rakam text-[15px] font-semibold"
              style={{ color: netPozisyon >= 0 ? 'var(--artis-iyi)' : 'var(--kritik)' }}
            >
              {tl(netPozisyon)}
            </span>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Toplam kart limiti {tl(toplamLimit)}. 6930 · 8236 · 8588 aynı limiti paylaşır,
            limit yalnızca 6930 satırında tutulur.
          </p>
        </Bolum>

        <Bolum
          baslik="Sabit aylık yükler"
          aciklama={`${d.taksitler.length} aktif taksit planı`}
          baglanti={{ yol: '/taksitler', ad: 'Taksitler' }}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>Aylık toplam</span>
            <span className="rakam text-[15px] font-semibold">{tl(aylikYuk)}</span>
          </div>
          <div className="mb-3 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Bunun {tl(kendiYuku)} kadarı kendi gideri; kalanı şirket ya da başka kişi ödüyor.
          </div>
          <ul>
            {d.taksitler.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 py-1">
                <span className="truncate text-[13px]" style={{ color: 'var(--ink-2)' }}>
                  {p.urun}
                  <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    {p.odenen_taksit}/{p.taksit_sayisi}
                  </span>
                </span>
                <span className="rakam shrink-0 text-[13px]">{tl(p.aylik_tutar)}</span>
              </li>
            ))}
          </ul>
        </Bolum>
      </div>

      <Bolum
        baslik="Son işlemler"
        aciklama="Tam liste, filtre ve arama İşlemler ekranında"
        baglanti={{ yol: '/islemler', ad: 'Tümü' }}
        sarmalaMi={false}
      >
        <div className="kart overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr style={{ color: 'var(--ink-muted)' }}>
                <th className="px-3 py-2 text-left font-medium">Tarih</th>
                <th className="px-3 py-2 text-left font-medium">Açıklama</th>
                <th className="px-3 py-2 text-left font-medium">Kategori</th>
                <th className="px-3 py-2 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {d.sonIslemler.map((i) => (
                <tr key={i.id} style={{ borderTop: '1px solid var(--hair)' }}>
                  <td className="rakam whitespace-nowrap px-3 py-2" style={{ color: 'var(--ink-muted)' }}>
                    {tarihKisa(i.tarih)}
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2">{i.aciklama}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>
                    {i.kategori ?? '—'}
                    {i.tip !== 'Gider' && i.tip !== 'Gelir' && (
                      <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {i.tip}
                      </span>
                    )}
                  </td>
                  <td
                    className="rakam whitespace-nowrap px-3 py-2 text-right"
                    style={{ color: i.tip === 'Gelir' ? 'var(--artis-iyi)' : 'var(--ink)' }}
                  >
                    {i.tip === 'Gelir' ? '+' : ''}{tlKurus(i.tutar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bolum>
    </>
  )
}
