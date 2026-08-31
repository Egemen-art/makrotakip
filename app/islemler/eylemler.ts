'use server'

import { revalidatePath } from 'next/cache'
import { supabaseSunucu } from '@/lib/supabase/server'
import type { Baglam, Durum, Kaynak, Tip, YukSahibi } from '@/lib/tipler'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }

const bosaNull = (d: FormDataEntryValue | null) => {
  const s = String(d ?? '').trim()
  return s === '' ? null : s
}

function tazele() {
  revalidatePath('/islemler')
  revalidatePath('/')
  revalidatePath('/sorular')
}

export async function islemKaydet(form: FormData): Promise<Sonuc> {
  const sb = await supabaseSunucu()

  const tutarHam = String(form.get('tutar') ?? '').replace(',', '.')
  const tutar = Number(tutarHam)
  if (!isFinite(tutar) || tutar < 0) {
    return { tamam: false, hata: 'Tutar sıfır ya da daha büyük bir sayı olmalı.' }
  }

  const kategori = bosaNull(form.get('kategori'))
  const alt = bosaNull(form.get('alt_kategori'))

  const satir = {
    tarih: String(form.get('tarih')),
    saat: bosaNull(form.get('saat')),
    aciklama: String(form.get('aciklama') ?? '').trim(),
    tutar,
    tip: String(form.get('tip')) as Tip,
    kategori,
    // Taksonomi FK'si (kategori, alt_kategori) ciftini bekler; kategori varsa
    // alt bos birakilmaz.
    alt_kategori: kategori ? (alt ?? '—') : null,
    baglam: String(form.get('baglam') || 'Normal') as Baglam,
    hesap: bosaNull(form.get('hesap')),
    durum: String(form.get('durum') || 'Elle') as Durum,
    kaynak: (bosaNull(form.get('kaynak')) ?? 'Elle') as Kaynak,
    yuk_sahibi: (bosaNull(form.get('yuk_sahibi')) as YukSahibi | null),
    not_: bosaNull(form.get('not_')),
  }

  if (!satir.aciklama) return { tamam: false, hata: 'Açıklama boş olamaz.' }

  const idHam = bosaNull(form.get('id'))

  if (idHam) {
    const { error } = await sb.from('islemler').update(satir).eq('id', Number(idHam))
    if (error) return { tamam: false, hata: error.message }
  } else {
    const { error } = await sb.from('islemler').insert(satir)
    if (error) return { tamam: false, hata: error.message }
  }

  tazele()
  return { tamam: true }
}

export async function islemSil(id: number): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const { error } = await sb.from('islemler').delete().eq('id', id)
  if (error) return { tamam: false, hata: error.message }
  tazele()
  return { tamam: true }
}
