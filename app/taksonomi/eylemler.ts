'use server'

import { revalidatePath } from 'next/cache'
import { supabaseSunucu } from '@/lib/supabase/server'
import type { Yon } from '@/lib/tipler'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }

/** Notion'un 100+ secenekte yeni deger kabul etmeme tikanmasinin cozuldugu yer. */
export async function taksonomiEkle(form: FormData): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const kategori = String(form.get('kategori') ?? '').trim()
  const alt = String(form.get('alt_kategori') ?? '').trim() || '—'
  if (!kategori) return { tamam: false, hata: 'Kategori boş olamaz.' }

  const { error } = await sb.from('taksonomi').insert({
    kategori,
    alt_kategori: alt,
    yon: String(form.get('yon') || 'Gider') as Yon,
    kaynak: 'Egemen onayladı',
    not_: String(form.get('not_') ?? '').trim() || null,
  })

  if (error) {
    return {
      tamam: false,
      hata: error.code === '23505'
        ? 'Bu kategori/alt kategori çifti zaten var.'
        : error.message,
    }
  }
  revalidatePath('/taksonomi')
  revalidatePath('/sorular')
  revalidatePath('/islemler')
  return { tamam: true }
}

export async function taksonomiSil(id: number): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const { error } = await sb.from('taksonomi').delete().eq('id', id)
  if (error) {
    return {
      tamam: false,
      hata: error.code === '23503'
        ? 'Bu kategoriye bağlı işlem var; önce o işlemleri taşı.'
        : error.message,
    }
  }
  revalidatePath('/taksonomi')
  return { tamam: true }
}
