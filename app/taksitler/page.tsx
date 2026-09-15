import Link from 'next/link'
import { supabaseSunucu } from '@/lib/supabase/server'
import type { Kart, TaksitPlani } from '@/lib/tipler'
import { bugun, tarihKisa, tl, tlKurus } from '@/lib/bicim'
import { bekleyenTaksitler } from '@/lib/taksit'

export const dynamic = 'force-dynamic'

const say = (n: string | null | undefined) => Number(n ?? 0)

const YUK_RENGI: Record<string, string> = {
  'Kendi gideri': 'var(--seri-1)',
  'Şirket ödüyor': 'var(--iyi)',
  'Kişi ödüyor': 'var(--seri-5)',
  Belirsiz: 'var(--uyari)',
}

export default async function TaksitlerSayfasi({ searchParams }: { searchParams: Promise<{ bekleyen?: string }> }) {
  const { bekleyen: filtre } = await searchParams
  const sb = await supabaseSunucu()
  const [{ data, error }, kartlar, yazilanlar] = await Promise.all([
    sb.from('taksit_plani').select('*').order('durum').order('aylik_tutar', { ascending: false }),
    sb.from('kartlar').select('kod, kesim_gunu'),
    // Deftere yazilmis taksit satirlari: bekleyenleri bunlardan ayiklamak icin.
    sb.from('islemler').select('taksit_plan_id, taksit_no, tarih').not('taksit_plan_id', 'is', null),
  ])

  const planlar = (data ?? []) as TaksitPlani[]
  const gunBugun = bugun()
  const bekleyen = bekleyenTaksitler(
    planlar,
    (kartlar.data ?? []) as Pick<Kart, 'kod' | 'kesim_gunu'>[],
    (yazilanlar.data ?? []) as { taksit_plan_id: number; taksit_no: number | null; tarih: string }[],
    gunBugun,
  )
  const buAy = bekleyen.filter((b) => b.ay === gunBugun.slice(0, 7))
  const gecikmis = bekleyen.filter((b) => b.gecikmis)
  // Kutuya tiklayinca tablo suzulur (?bekleyen=buay | gecikmis); tekrar tiklayinca acilir.
  const suzgec = filtre === 'buay' ? 'buay' : filtre === 'gecikmis' ? 'gecikmis' : null
  const listelenen = suzgec === 'buay' ? buAy : suzgec === 'gecikmis' ? gecikmis : bekleyen
  const kutuStil = (aktif: boolean, renk?: string) => ({
    borderColor: aktif ? 'var(--seri-1)' : renk,
    boxShadow: aktif ? '0 0 0 1px var(--seri-1)' : undefined,
  })
  const aktif = planlar.filter((p) => p.durum === 'Aktif')
  const aylikToplam = aktif.reduce((t, p) => t + say(p.aylik_tutar), 0)
  const kalanToplam = aktif.reduce((t, p) => t + say(p.aylik_tutar) * p.kalan_taksit, 0)

  // Yuk sahibi asla varsayilmaz; Belirsiz kalanlar ayrica gosterilir.
  const yukDagilimi = new Map<string, number>()
  for (const p of aktif) {
    yukDagilimi.set(p.yuk_sahibi, (yukDagilimi.get(p.yuk_sahibi) ?? 0) + say(p.aylik_tutar))
  }

  return (
    <>
      <h1 className="text-[17px] font-semibold">Taksitler</h1>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Banka bildirimi taksit bilgisi taşımıyor; planlar ekstrelerden kuruldu.
      </p>

      {error && (
        <div className="kart mt-3 p-3 text-[13px]" style={{ borderColor: 'var(--kritik)', color: 'var(--kritik)' }}>
          {error.message}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kart p-4">
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Aylık yük</div>
          <div className="mt-1 text-[22px] font-semibold">{tl(aylikToplam)}</div>
        </div>
        <div className="kart p-4">
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Kalan toplam</div>
          <div className="mt-1 text-[22px] font-semibold">{tl(kalanToplam)}</div>
        </div>
        <div className="kart p-4">
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Aktif plan</div>
          <div className="mt-1 text-[22px] font-semibold">{aktif.length}</div>
        </div>
        <div className="kart p-4">
          <div className="mb-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>Aylık yükün sahibi</div>
          {[...yukDagilimi.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([sahip, tutar]) => (
              <div key={sahip} className="flex items-center gap-1.5 text-[12px]">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: YUK_RENGI[sahip] }} />
                <span style={{ color: 'var(--ink-2)' }}>{sahip}</span>
                <span className="rakam ml-auto">{tl(tutar)}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="kart mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr style={{ color: 'var(--ink-muted)' }}>
              <th className="px-3 py-2 text-left font-medium">Ürün</th>
              <th className="px-3 py-2 text-left font-medium">Kart</th>
              <th className="px-3 py-2 text-left font-medium">Kategori</th>
              <th className="px-3 py-2 text-center font-medium">Taksit</th>
              <th className="px-3 py-2 text-right font-medium">Aylık</th>
              <th className="px-3 py-2 text-right font-medium">Kalan</th>
              <th className="px-3 py-2 text-left font-medium">Yük sahibi</th>
              <th className="px-3 py-2 text-left font-medium">Durum</th>
            </tr>
          </thead>
          <tbody>
            {planlar.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--hair)', opacity: p.durum === 'Bitti' ? 0.55 : 1 }}>
                <td className="px-3 py-2">
                  {p.urun}
                  {p.son_taksit_ayi && (
                    <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                      {p.ilk_taksit_ayi} → {p.son_taksit_ayi}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>{p.kart ?? '—'}</td>
                <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>
                  {p.kategori ?? '—'}
                  {p.alt_kategori && <span style={{ color: 'var(--ink-muted)' }}> › {p.alt_kategori}</span>}
                </td>
                <td className="rakam px-3 py-2 text-center">
                  {p.odenen_taksit}/{p.taksit_sayisi}
                  <div
                    className="mx-auto mt-1 h-1 w-14 overflow-hidden rounded-full"
                    style={{ background: 'var(--grid)' }}
                    role="img"
                    aria-label={`${p.taksit_sayisi} taksitin ${p.odenen_taksit} tanesi ödendi`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(p.odenen_taksit / p.taksit_sayisi) * 100}%`,
                        background: 'var(--seri-1)',
                      }}
                    />
                  </div>
                </td>
                <td className="rakam px-3 py-2 text-right">{tlKurus(p.aylik_tutar)}</td>
                <td className="rakam px-3 py-2 text-right">{tl(say(p.aylik_tutar) * p.kalan_taksit)}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
                    <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: YUK_RENGI[p.yuk_sahibi] }} />
                    {p.yuk_sahibi}
                  </span>
                </td>
                <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--ink-muted)' }}>{p.durum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        Taksitli alımlar ürünün kendi kategorisine yazılır, ayrı bir “taksitli alışverişler”
        kategorisine değil.
      </p>

      {/* ── Gidere henuz yansimayan taksitler ─────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Gidere yansımayan taksitler</h2>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Her taksit kartın kesim gününde deftere Gider olarak yazılır; burada henüz yazılmamış olanlar.
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href={suzgec === 'buay' ? '/taksitler' : '/taksitler?bekleyen=buay'} className="kart block p-4 hover:bg-[var(--plane)]" style={kutuStil(suzgec === 'buay')} aria-pressed={suzgec === 'buay'}>
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Bu ay yansıyacak</div>
          <div className="rakam mt-1 text-[22px] font-semibold">{tl(buAy.reduce((t, b) => t + b.tutar, 0))}</div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{buAy.length} taksit · {suzgec === 'buay' ? 'süzgeci kaldır' : 'süzmek için tıkla'}</div>
        </Link>
        <Link href="/taksitler?bekleyen=tumu" className="kart block p-4 hover:bg-[var(--plane)]" style={kutuStil(suzgec === null)} aria-pressed={suzgec === null}>
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>Toplam bekleyen</div>
          <div className="rakam mt-1 text-[22px] font-semibold">{tl(bekleyen.reduce((t, b) => t + b.tutar, 0))}</div>
          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{bekleyen.length} taksit · hepsi</div>
        </Link>
        {gecikmis.length > 0 && (
          <Link href={suzgec === 'gecikmis' ? '/taksitler' : '/taksitler?bekleyen=gecikmis'} className="kart block p-4 hover:bg-[var(--plane)] lg:col-span-2" style={kutuStil(suzgec === 'gecikmis', 'var(--ciddi)')} aria-pressed={suzgec === 'gecikmis'}>
            <div className="text-[12px]" style={{ color: 'var(--ciddi)' }}>Kesimi geçmiş, deftere yazılmamış</div>
            <div className="rakam mt-1 text-[22px] font-semibold">{tl(gecikmis.reduce((t, b) => t + b.tutar, 0))}</div>
            <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              {gecikmis.length} taksit — ekstre gelince görev doğrular ya da yazar; plan bilgisi arşivle çelişebilir.
            </div>
          </Link>
        )}
      </div>

      {listelenen.length === 0 ? (
        <p className="kart mt-3 p-6 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          {suzgec ? 'Bu süzgeçte taksit yok.' : 'Bekleyen taksit yok.'}
        </p>
      ) : (
        <div className="kart mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr style={{ color: 'var(--ink-muted)' }}>
                <th className="px-3 py-2 text-left font-medium">Beklenen tarih</th>
                <th className="px-3 py-2 text-left font-medium">Ürün</th>
                <th className="px-3 py-2 text-left font-medium">Kart</th>
                <th className="px-3 py-2 text-center font-medium">Taksit</th>
                <th className="px-3 py-2 text-right font-medium">Tutar</th>
                <th className="px-3 py-2 text-left font-medium">Yük sahibi</th>
                <th className="px-3 py-2 text-left font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {listelenen.map((b) => (
                <tr key={`${b.plan.id}-${b.no}`} style={{ borderTop: '1px solid var(--hair)' }}>
                  <td className="rakam px-3 py-2 whitespace-nowrap" style={{ color: b.gecikmis ? 'var(--ciddi)' : undefined }}>
                    {b.tarih ? tarihKisa(b.tarih) : b.ay}
                    {b.ay === gunBugun.slice(0, 7) && !b.gecikmis && (
                      <span className="ml-1.5 text-[11px]" style={{ color: 'var(--seri-1)' }}>bu ay</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {b.plan.urun}
                    {b.plan.kategori && (
                      <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {b.plan.kategori}{b.plan.alt_kategori ? ` › ${b.plan.alt_kategori}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--ink-2)' }}>
                    {b.plan.kart ?? '—'}
                    {b.kesimGunu === null && <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>kesim günü bilinmiyor</div>}
                  </td>
                  <td className="rakam px-3 py-2 text-center">{b.no}/{b.plan.taksit_sayisi}</td>
                  <td className="rakam px-3 py-2 text-right">{tlKurus(b.tutar)}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
                      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: YUK_RENGI[b.plan.yuk_sahibi] }} />
                      {b.plan.yuk_sahibi}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[12px]" style={{ color: b.gecikmis ? 'var(--ciddi)' : 'var(--ink-muted)' }}>
                    {b.gecikmis ? 'kesim geçti, yazılmadı' : b.plan.durum === 'Doğrulanmadı' ? 'plan doğrulanmadı' : 'bekliyor'}
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
