'use server'

import { redirect } from 'next/navigation'
import { supabaseSunucu } from '@/lib/supabase/server'
import { SAHIP_UID } from '@/lib/sahip'

export async function girisYap(_oncekiDurum: string | null, form: FormData) {
  const eposta = String(form.get('eposta') ?? '').trim()
  const sifre = String(form.get('sifre') ?? '')
  const devam = String(form.get('devam') ?? '/')

  if (!eposta || !sifre) return 'E-posta ve şifre gerekli.'

  const supabase = await supabaseSunucu()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: eposta,
    password: sifre,
  })

  if (error) return 'Giriş başarısız: e-posta veya şifre hatalı.'

  if (data.user?.id !== SAHIP_UID) {
    await supabase.auth.signOut()
    return 'Bu hesabın finans verisine erişimi yok.'
  }

  redirect(devam.startsWith('/') ? devam : '/')
}
