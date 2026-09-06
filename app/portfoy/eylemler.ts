'use server'

import { revalidatePath } from 'next/cache'
import { supabaseSunucu } from '@/lib/supabase/server'
import { sayiOku } from '@/lib/bicim'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }

/** Formdaki para/miktar birimleri. Sunucu TL'ye burada cevirir; istemcideki onizleme sadece gosterimdir. */
export type Birim = 'TRY' | 'USD' | 'EUR' | 'GRAM'
const BIRIMLER: Birim[] = ['TRY', 'USD', 'EUR', 'GRAM']

const KALEMLER = [
  'ppf', 'vadeli_mevduat', 'hisse_abd', 'hisse_bist',
  'altin_fiziksel', 'altin_etf', 'nakit', 'bes',
] as const
const ETIKET: Record<(typeof KALEMLER)[number], string> = {
  ppf: 'PPF', vadeli_mevduat: 'Vadeli mevduat', hisse_abd: 'Hisse (ABD)', hisse_bist: 'Hisse (BİST)',
  altin_fiziksel: 'Altın (fiziksel)', altin_etf: 'Altın (ETF)', nakit: 'Nakit', bes: 'BES',
}

const kurus = (n: number) => Math.round(n * 100) / 100

export async function portfoyKaydet(form: FormData): Promise<Sonuc> {
  const sb = await supabaseSunucu()

  const tarih = String(form.get('tarih') ?? '').trim()
  if (!tarih) return { tamam: false, hata: 'Tarih gerekli.' }

  // TUZAK: eklenen_cekilen bos birakilirsa getiri oldugundan yuksek cikar.
  // Para girisi yoksa 0 yazilir — burada zorlaniyor.
  const eklenenCekilen = sayiOku(form.get('eklenen_cekilen')) ?? 0

  // Kurlar: kayit ANINDA dondurulur. Bos = o birim kullanilamaz.
  const usdtry = sayiOku(form.get('usdtry'))
  const eurtry = sayiOku(form.get('eurtry'))
  const altinGramTl = sayiOku(form.get('altin_gram_tl'))
  const altinOnsUsd = sayiOku(form.get('altin_ons_usd'))

  const kur: Record<Birim, number | null> = { TRY: 1, USD: usdtry, EUR: eurtry, GRAM: altinGramTl }
  const kurAdi: Record<Birim, string> = { TRY: '', USD: 'USD/TRY', EUR: 'EUR/TRY', GRAM: 'gram altın fiyatı' }

  const tl: Record<string, number> = {}
  for (const k of KALEMLER) {
    const miktar = sayiOku(form.get(k)) ?? 0
    const birimHam = String(form.get(`${k}_birim`) ?? 'TRY').toUpperCase()
    const birim = (BIRIMLER as string[]).includes(birimHam) ? (birimHam as Birim) : 'TRY'
    if (miktar === 0) { tl[k] = 0; continue }
    const oran = kur[birim]
    if (oran === null || oran <= 0) {
      return { tamam: false, hata: `${ETIKET[k]} ${birim === 'GRAM' ? 'gram' : birim} ile girildi ama ${kurAdi[birim]} boş. Kuru gir ya da birimi ₺ yap.` }
    }
    tl[k] = kurus(miktar * oran)
  }

  const satir = {
    tarih,
    ...tl,
    eklenen_cekilen: eklenenCekilen,
    usdtry, eurtry,
    altin_gram_tl: altinGramTl,
    altin_ons_usd: altinOnsUsd,
    not_: String(form.get('not_') ?? '').trim() || null,
  }

  // Ayni tarihte satir varsa guncelle (tarih unique).
  const { error } = await sb.from('portfoy').upsert(satir, { onConflict: 'tarih' })
  if (error) return { tamam: false, hata: error.message }

  revalidatePath('/portfoy')
  revalidatePath('/')
  return { tamam: true }
}

export async function portfoySil(id: number): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const { error } = await sb.from('portfoy').delete().eq('id', id)
  if (error) return { tamam: false, hata: error.message }
  revalidatePath('/portfoy')
  revalidatePath('/')
  return { tamam: true }
}
