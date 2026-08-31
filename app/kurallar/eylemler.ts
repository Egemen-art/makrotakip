'use server'

import { revalidatePath } from 'next/cache'
import { supabaseSunucu } from '@/lib/supabase/server'
import type { Tip } from '@/lib/tipler'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }

export async function kuralKaydet(form: FormData): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const id = Number(form.get('id'))
  const guven = Number(String(form.get('guven') ?? '1').replace(',', '.'))
  if (!isFinite(guven) || guven < 0 || guven > 1) {
    return { tamam: false, hata: 'Güven 0 ile 1 arasında olmalı.' }
  }
  const desen = String(form.get('desen') ?? '').trim()
  if (!desen) return { tamam: false, hata: 'Desen boş olamaz.' }

  const { error } = await sb.from('kural_seti').update({
    desen,
    kategori: String(form.get('kategori') ?? '').trim(),
    alt_kategori: String(form.get('alt_kategori') ?? '').trim() || null,
    tip: String(form.get('tip')) as Tip,
    guven,
    not_: String(form.get('not_') ?? '').trim() || null,
  }).eq('id', id)

  if (error) return { tamam: false, hata: error.message }
  revalidatePath('/kurallar')
  return { tamam: true }
}

export async function kuralSil(id: number): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const { error } = await sb.from('kural_seti').delete().eq('id', id)
  if (error) return { tamam: false, hata: error.message }
  revalidatePath('/kurallar')
  return { tamam: true }
}
