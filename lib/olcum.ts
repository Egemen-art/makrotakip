import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { bugun } from '@/lib/bicim'
import { kurlariGetir } from '@/lib/kur'
import { fiyatOku, type FiyatKaynagi, type NakitOkuyucu } from '@/lib/fiyatKaynak'
import type { Kurlar } from '@/lib/tipler'
import type { Varlik } from '@/lib/tipler-varlik'

/**
 * GUNLUK OLCUM — tek yerde: elle "Fiyatlari guncelle" de, sabahki otomatik
 * calisma da (/api/olcum) bunu cagirir. Fiyat cekme burada; okuma/yazma
 * disaridan verilen DEPO uzerinden:
 *   - dogrudanDepo: ekranda kullanicinin oturumu (RLS altinda).
 *   - tokenliDepo:  otomatik yol — anon istemci + Vault'taki olcum_token; yazan
 *                   DB fonksiyonlaridir (finans.olcum_baslangic / olcum_yaz),
 *                   Vercel'de hicbir sir tanimli olmasi gerekmez.
 *
 * Sira: fiyatlar -> gunun kuru -> bugunku degerler portfoy_gunluk'e
 * (finans.portfoy_gunluk_olc). Okunamayan fiyat ATLANIR ve adiyla raporlanir;
 * eski fiyat bugune kopyalanmaz, uydurma rakam yazilmaz (karar 50).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Istemci = SupabaseClient<any, 'finans', any>

export type FiyatSatiri = {
  varlik_id: number
  tarih: string
  fiyat: number
  para: 'TRY' | 'USD'
  kaynak: string
  olculdu: boolean
}

export type OlcumDeposu = {
  varliklar(): Promise<Varlik[]>
  nakit: NakitOkuyucu
  /** Fiyatlar + kur + portfoy_gunluk; yazilan kalem sayisini dondurur. */
  yaz(gun: string, fiyatlar: FiyatSatiri[], kur: Kurlar): Promise<number>
}

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

const kurKaydi = (kur: Kurlar) => ({
  usdtry: kur.usdtry, eurtry: kur.eurtry, kaynak: `/api/kur · ${kur.kaynak.usd ?? ''}`,
})

/** Oturumlu (ya da servis anahtarli) istemciyle dogrudan tablolara. */
export function dogrudanDepo(sb: Istemci): OlcumDeposu {
  return {
    async varliklar() {
      const { data, error } = await sb.from('varlik').select('*').eq('aktif', true)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Varlik[]).filter((v) => v.kaynak_tur !== 'elle')
    },
    async nakit() {
      const { data, error } = await sb.from('v_nakit').select('toplam').limit(1).single()
      if (error) throw new Error(error.message)
      return data as { toplam: unknown }
    },
    async yaz(gun, fiyatlar, kur) {
      if (fiyatlar.length > 0) {
        const { error } = await sb.from('fiyat').upsert(fiyatlar, { onConflict: 'varlik_id,tarih' })
        if (error) throw new Error(`fiyat yazılamadı: ${error.message}`)
      }
      if (kur.usdtry !== null) {
        const { error } = await sb.from('kur_gunluk').upsert({ tarih: gun, ...kurKaydi(kur) }, { onConflict: 'tarih' })
        if (error) throw new Error(`kur yazılamadı: ${error.message}`)
      }
      const { data, error } = await sb.rpc('portfoy_gunluk_olc', { p_gun: gun })
      if (error) throw new Error(`günlük ölçüm yazılamadı: ${error.message}`)
      return Number(data ?? 0)
    },
  }
}

/** Anon istemci + olcum_token: her sey DB fonksiyonlarinda, token DB'de dogrulanir. */
export function tokenliDepo(sb: Istemci, token: string): OlcumDeposu {
  let baslangic: Promise<{ varliklar: Varlik[]; nakit: { toplam: unknown } | null }> | null = null
  const baslat = () => {
    baslangic ??= (async () => {
      const { data, error } = await sb.rpc('olcum_baslangic', { p_token: token })
      if (error) throw new Error(error.message)
      const d = (data ?? {}) as { varliklar?: Varlik[]; nakit?: { toplam: unknown } | null }
      return { varliklar: d.varliklar ?? [], nakit: d.nakit ?? null }
    })()
    return baslangic
  }
  return {
    varliklar: async () => (await baslat()).varliklar,
    nakit: async () => (await baslat()).nakit,
    async yaz(gun, fiyatlar, kur) {
      const { data, error } = await sb.rpc('olcum_yaz', {
        p_token: token, p_gun: gun, p_fiyatlar: fiyatlar, p_kur: kur.usdtry === null ? null : kurKaydi(kur),
      })
      if (error) throw new Error(error.message)
      return Number((data as { kalem?: number } | null)?.kalem ?? 0)
    },
  }
}

export async function gunlukOlcum(depo: OlcumDeposu): Promise<OlcumSonucu> {
  const gun = bugun()
  const varliklar = await depo.varliklar()

  // 1) Fiyatlar — paralel, her biri kendi zaman asimiyla.
  const okumalar = await Promise.all(varliklar.map(async (v) => ({
    varlik: v,
    okuma: await fiyatOku(varligaKaynak(v), depo.nakit),
  })))
  const yazilacak: FiyatSatiri[] = okumalar
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
  const okunamayan = okumalar
    .filter((o) => o.okuma.fiyat === null)
    .map((o) => ({ kod: o.varlik.kod, neden: o.okuma.hata ?? 'bilinmiyor' }))

  // 2) Gunun kuru.
  const kur = await kurlariGetir()

  // 3) Yazim: fiyatlar -> kur -> portfoy_gunluk (ayni gun tekrar calisirsa yenilenir;
  //    akis penceresi olcum_zamani'na gore kurulur).
  const kalem = await depo.yaz(gun, yazilacak, kur)
  const olcum = kalem > 0 ? `${kalem} kalem` : 'yazılacak kalem yok'

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
