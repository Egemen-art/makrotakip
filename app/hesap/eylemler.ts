'use server'

import { supabaseSunucu } from '@/lib/supabase/server'
import { SAHIP_UID } from '@/lib/sahip'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }

export async function sifreDegistir(
  _oncekiDurum: Sonuc | null,
  form: FormData,
): Promise<Sonuc> {
  const yeni = String(form.get('yeni') ?? '')
  const tekrar = String(form.get('tekrar') ?? '')

  if (yeni.length < 10) {
    return { tamam: false, hata: 'Şifre en az 10 karakter olmalı.' }
  }
  if (yeni !== tekrar) {
    return { tamam: false, hata: 'İki şifre birbirini tutmuyor.' }
  }

  const sb = await supabaseSunucu()

  // Oturum gercekten sahibe mi ait, guncellemeden once dogrula.
  const { data: { user }, error: kullaniciHatasi } = await sb.auth.getUser()
  if (kullaniciHatasi || user?.id !== SAHIP_UID) {
    return { tamam: false, hata: 'Oturum doğrulanamadı, yeniden giriş yap.' }
  }

  const { error } = await sb.auth.updateUser({ password: yeni })
  if (error) return { tamam: false, hata: error.message }

  return { tamam: true }
}
