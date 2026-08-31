'use server'

import { revalidatePath } from 'next/cache'
import { supabaseSunucu } from '@/lib/supabase/server'
import type { Tip, YukSahibi } from '@/lib/tipler'

export type CevapSonucu = { tamam: true } | { tamam: false; hata: string }

/**
 * Soru kutusu onayi. Tek RPC ile: islem Onaylandi olur, taksonomi eksigi
 * kapanir, kural_seti'ne kalici kural yazilir.
 */
export async function cevapla(girdi: {
  islemId: number
  kategori: string
  altKategori: string
  tip: Tip
  /** Bos string: bu sefer kural yazma. */
  desen: string
  yukSahibi?: YukSahibi | null
}): Promise<CevapSonucu> {
  const sb = await supabaseSunucu()

  const { error } = await sb.rpc('soru_cevapla', {
    p_islem_id: girdi.islemId,
    p_kategori: girdi.kategori,
    p_alt_kategori: girdi.altKategori || '—',
    p_tip: girdi.tip,
    p_desen: girdi.desen.trim() || null,
    p_yuk_sahibi: girdi.yukSahibi ?? null,
  })

  if (error) return { tamam: false, hata: error.message }

  revalidatePath('/sorular')
  revalidatePath('/')
  revalidatePath('/islemler')
  revalidatePath('/kurallar')
  return { tamam: true }
}
