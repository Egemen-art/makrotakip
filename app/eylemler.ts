'use server'

import { supabaseSunucu } from '@/lib/supabase/server'
import type { GunSatiri, Yon } from '@/lib/tipler'

/**
 * Panodaki kirilim zincirinin son halkasi: secili ayda, secili kategori/alt
 * kategorideki TEK TEK kayitlar. Aylik veriler sayfayla birlikte geliyor;
 * gun seviyesi sadece tiklanunca cekilir — pano yuku artmasin.
 */
export async function gunlukKirilim(
  { yon, kategori, alt, ay }: { yon: Yon; kategori: string; alt: string; ay: string },
): Promise<{ satirlar: GunSatiri[]; hata: string | null }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ay)) return { satirlar: [], hata: 'Ay biçimi geçersiz.' }

  // Ayin ilk gunu ile bir sonraki ayin ilk gunu arasi (yerel gun, saat dilimi kaymasi yok).
  const [y, a] = ay.split('-').map(Number)
  const bas = `${ay}-01`
  const son = a === 12 ? `${y + 1}-01-01` : `${y}-${String(a + 1).padStart(2, '0')}-01`

  const sb = await supabaseSunucu()
  let sorgu = sb
    .from('v_kayit')
    .select('tarih,aciklama,tutar,hesap,bolum')
    .eq('yon', yon)
    .eq('kategori', kategori)
    .gte('tarih', bas)
    .lt('tarih', son)
    .order('tarih')
    .limit(200)
  // alt bos gelirse kategori butunu istenmistir.
  if (alt) sorgu = sorgu.eq('alt', alt)

  const { data, error } = await sorgu
  if (error) return { satirlar: [], hata: error.message }
  return { satirlar: (data ?? []) as GunSatiri[], hata: null }
}
