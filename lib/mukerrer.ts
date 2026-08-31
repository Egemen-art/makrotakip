/**
 * Mukerrer kilidi anahtari: tarih + saat + tutar + aciklama.
 *
 * SAAT ŞART. 24.08.2026'da ayni kafede iki ayri 75 ₺ harcama vardi;
 * saati disarida birakan bir indeks bunlardan birini mukerrer sanip yutuyordu.
 */
export function mukerrerAnahtar(satir: {
  tarih: string
  saat: string | null | undefined
  tutar: string | number
  aciklama: string | null | undefined
}) {
  return [
    satir.tarih,
    satir.saat ? String(satir.saat).slice(0, 5) : '',
    Number(satir.tutar).toFixed(2),
    (satir.aciklama ?? '').trim(),
  ].join('|')
}
