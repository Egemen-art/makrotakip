'use server'

import { revalidatePath } from 'next/cache'
import { supabaseSunucu } from '@/lib/supabase/server'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }

const sayi = (d: FormDataEntryValue | null, varsayilan: number | null = 0) => {
  const s = String(d ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (s === '') return varsayilan
  const n = Number(s)
  return isFinite(n) ? n : varsayilan
}

export async function portfoyKaydet(form: FormData): Promise<Sonuc> {
  const sb = await supabaseSunucu()

  const tarih = String(form.get('tarih') ?? '').trim()
  if (!tarih) return { tamam: false, hata: 'Tarih gerekli.' }

  // TUZAK: eklenen_cekilen bos birakilirsa getiri olduğundan yuksek cikar.
  // Para girisi yoksa 0 yazilir — burada zorlaniyor.
  const eklenenCekilen = sayi(form.get('eklenen_cekilen'), 0) ?? 0

  const satir = {
    tarih,
    ppf: sayi(form.get('ppf')) ?? 0,
    vadeli_mevduat: sayi(form.get('vadeli_mevduat')) ?? 0,
    hisse_abd: sayi(form.get('hisse_abd')) ?? 0,
    hisse_bist: sayi(form.get('hisse_bist')) ?? 0,
    altin_fiziksel: sayi(form.get('altin_fiziksel')) ?? 0,
    altin_etf: sayi(form.get('altin_etf')) ?? 0,
    nakit: sayi(form.get('nakit')) ?? 0,
    bes: sayi(form.get('bes')) ?? 0,
    eklenen_cekilen: eklenenCekilen,
    usdtry: sayi(form.get('usdtry'), null),
    altin_gram_tl: sayi(form.get('altin_gram_tl'), null),
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
