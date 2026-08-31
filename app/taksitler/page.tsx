import { supabaseSunucu } from '@/lib/supabase/server'
import type { TaksitPlani } from '@/lib/tipler'
import { tl, tlKurus } from '@/lib/bicim'

export const dynamic = 'force-dynamic'

const say = (n: string | null | undefined) => Number(n ?? 0)

const YUK_RENGI: Record<string, string> = {
  'Kendi gideri': 'var(--seri-1)',
  'Şirket ödüyor': 'var(--iyi)',
  'Kişi ödüyor': 'var(--seri-5)',
  Belirsiz: 'var(--uyari)',
}

export default async function TaksitlerSayfasi() {
  const sb = await supabaseSunucu()
  const { data, error } = await sb
    .from('taksit_plani')
    .select('*')
    .order('durum')
    .order('aylik_tutar', { ascending: false })

  const planlar = (data ?? []) as TaksitPlani[]
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
    </>
  )
}
