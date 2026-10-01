/**
 * SATIR TAVANINI ASAN SORGULAR.
 *
 * PostgREST (Supabase) tek yanitta en fazla `max-rows` satir dondurur —
 * varsayilan 1000. `.limit(20000)` bunu ASMAZ: istek 20000 der, sunucu 1000'e
 * kirpar, hata vermez; siralamaya gore EN BASTAKI 1000 satir gelir, gerisi
 * sessizce dusur. (01.10.2026: v_varlik_performans 1.876 satira cikinca
 * portfoy sayfasi 26 Haziran'da kesilmis gorundu; olaylar 458.)
 *
 * Cozum: .range(bas, bit) ile sayfa sayfa cekmek — her sayfa tavanin altinda
 * kalir, dolu sayfa geldikce bir sonraki istenir. Siralama DETERMINISTIK
 * olmali (esit tarihli satirlar icin ikinci bir anahtar), yoksa sayfalar
 * arasinda satir kayar.
 */

type Yanit<T> = { data: T[] | null; error: { message: string } | null }

export async function hepsiniGetir<T>(
  sorgu: (bas: number, bit: number) => PromiseLike<Yanit<T>>,
  sayfa = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const hepsi: T[] = []
  for (let bas = 0; ; bas += sayfa) {
    const { data, error } = await sorgu(bas, bas + sayfa - 1)
    if (error) return { data: hepsi, error }
    const parca = data ?? []
    hepsi.push(...parca)
    if (parca.length < sayfa) return { data: hepsi, error: null }
  }
}
