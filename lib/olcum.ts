import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { bugun } from '@/lib/bicim'
import { kurlariGetir } from '@/lib/kur'
import { fiyatOku, type FiyatKaynagi } from '@/lib/fiyatKaynak'
import type { Varlik, VarlikDeger } from '@/lib/tipler-varlik'

/**
 * GUNLUK OLCUM — tek yerde: elle "Fiyatlari guncelle" de, sabahki otomatik
 * calisma da (/api/olcum) bunu cagirir. Istemci disaridan verilir: ekranda
 * kullanicinin oturumu, cron'da servis anahtari.
 *
 * Sira: fiyatlar -> gunun kuru -> bugunku degerler portfoy_gunluk'e.
 * Okunamayan fiyat ATLANIR ve adiyla raporlanir; eski fiyat bugune
 * kopyalanmaz, uydurma rakam yazilmaz (karar 50).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Istemci = SupabaseClient<any, 'finans', any>

export type OlcumSonucu = {
  gun: string
  guncellenen: number
  okunamayan: { kod: string; neden: string }[]
  usdtry: number | null
  olcum: string
}

/** Varlik satirini fiyat kaynagina cevirir. */
export function varligaKaynak(v: Varlik): FiyatKaynagi {
  switch (v.kaynak_tur) {
    case 'bist': return { tur: 'bist', sembol: v.kaynak_sembol ?? v.kod }
    case 'abd': return { tur: 'abd', sembol: v.kaynak_sembol ?? v.kod }
    case 'fon': return { tur: 'fon', kod: v.kaynak_sembol ?? v.kod, kurucu: 'tera' }
    case 'nakit': return { tur: 'nakit' }
    default: return { tur: 'gram_altin' }
  }
}

export async function gunlukOlcum(sb: Istemci): Promise<OlcumSonucu> {
  const gun = bugun()
  const { data, error } = await sb.from('varlik').select('*').eq('aktif', true)
  if (error) throw new Error(error.message)
  const varliklar = ((data ?? []) as Varlik[]).filter((v) => v.kaynak_tur !== 'elle')

  // 1) Fiyatlar — paralel, her biri kendi zaman asimiyla.
  const okumalar = await Promise.all(varliklar.map(async (v) => ({
    varlik: v,
    okuma: await fiyatOku(varligaKaynak(v), sb),
  })))
  const yazilacak = okumalar
    .filter((o) => o.okuma.fiyat !== null && o.okuma.para !== null)
    .map((o) => ({
      varlik_id: o.varlik.id,
      // Kaynak kendi tarihini veriyorsa o gune yazilir (borsa kapaliyken bugune
      // yazmak olculmemis gunu olculmus gosterir).
      tarih: o.okuma.tarih ?? gun,
      fiyat: o.okuma.fiyat!,
      para: o.okuma.para!,
      kaynak: o.okuma.kaynak,
      olculdu: true,
    }))
  if (yazilacak.length > 0) {
    const { error: e } = await sb.from('fiyat').upsert(yazilacak, { onConflict: 'varlik_id,tarih' })
    if (e) throw new Error(`fiyat yazılamadı: ${e.message}`)
  }
  const okunamayan = okumalar
    .filter((o) => o.okuma.fiyat === null)
    .map((o) => ({ kod: o.varlik.kod, neden: o.okuma.hata ?? 'bilinmiyor' }))

  // 2) Gunun kuru.
  const kur = await kurlariGetir()
  if (kur.usdtry !== null) {
    await sb.from('kur_gunluk').upsert({
      tarih: gun, usdtry: kur.usdtry, eurtry: kur.eurtry,
      kaynak: `/api/kur · ${kur.kaynak.usd ?? ''}`,
    }, { onConflict: 'tarih' })
  }

  // 3) Bugunku degerler -> portfoy_gunluk. Ayni gun tekrar calisirsa yenilenir.
  const [{ data: degerler }, { data: sonKur }] = await Promise.all([
    sb.from('v_varlik_deger').select('varlik_id, miktar, birim_fiyat, fiyat_para, fiyat_olculdu, deger_tl'),
    sb.from('kur_gunluk').select('usdtry').order('tarih', { ascending: false }).limit(1).maybeSingle(),
  ])
  const satirlar = ((degerler ?? []) as VarlikDeger[])
    .filter((d) => Number(d.miktar) !== 0 && d.deger_tl !== null)
    .map((d) => ({
      tarih: gun,
      varlik_id: d.varlik_id,
      miktar: Number(d.miktar),
      fiyat: d.birim_fiyat === null ? null : Number(d.birim_fiyat),
      para: d.fiyat_para,
      usdtry: sonKur?.usdtry ?? null,
      deger_tl: Number(d.deger_tl),
      olculdu: d.fiyat_olculdu !== false,
      // Akis penceresi bu zamana gore kurulur: onceki olcumden sonra kaydedilen
      // hareketler bu olcumun akisidir. Ayni gun yeniden olculunce yenilenir.
      olcum_zamani: new Date().toISOString(),
    }))
  let olcum = 'yazılacak kalem yok'
  if (satirlar.length > 0) {
    const { error: e } = await sb.from('portfoy_gunluk').upsert(satirlar, { onConflict: 'tarih,varlik_id' })
    olcum = e ? `yazılamadı: ${e.message}` : `${satirlar.length} kalem`
  }

  return { gun, guncellenen: yazilacak.length, okunamayan, usdtry: kur.usdtry, olcum }
}

export function olcumOzeti(s: OlcumSonucu): string {
  const parcalar = [
    `${s.guncellenen} fiyat güncellendi`,
    s.okunamayan.length ? `okunamadı: ${s.okunamayan.map((o) => `${o.kod} (${o.neden})`).join(', ')}` : null,
    s.usdtry === null ? 'kur alınamadı' : `USD/TRY ${s.usdtry}`,
    `günlük ölçüm ${s.gun}: ${s.olcum}`,
  ]
  return parcalar.filter(Boolean).join(' · ')
}
