/**
 * Supabase baglanti bilgileri.
 *
 * URL ve publishable (anon) anahtar tanimi geregi ACIKTIR — ikisi de tarayici
 * paketine giriyor, siteyi acan herkes gorebiliyor. Veriyi koruyan sey anahtar
 * degil, `finans` semasindaki RLS: politikalar tek bir kullanici kimligine
 * kilitli. Bu yuzden burada varsayilan olarak duruyorlar; ortam degiskeni
 * verilirse o kazanir (anahtar donduruldugunde kodu degistirmek gerekmesin).
 *
 * GERCEK SIRLAR burada DEGIL: SUPABASE_SERVICE_ROLE_KEY ve INGEST_TOKEN
 * yalnizca ortam degiskeninden okunur ve sunucu tarafinda kalir.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://zapkarkdzpjhkdyurfpl.supabase.co'

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'sb_publishable_LFKhr2DNDKNei7MzIxVvcA_wZX4lzGO'
