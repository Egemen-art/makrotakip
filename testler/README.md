# Testler

`node --experimental-strip-types testler/kontrol.mjs` ya da `npm test`.

Kapsam, brief'teki iki kritik iş kuralı:

- **Mükerrer kilidi** — `tarih + saat + tutar + aciklama`. Saat şart: 24.08.2026'da
  aynı kafede iki ayrı 75 ₺ harcama vardı, saatsiz kilit birini yutuyordu (tuzak 13).
- **Kural deseni üretimi** — gerçek banka bildirimlerinden `kural_seti.desen`
  karşılıkları. Türkçe locale ile büyük harfe çevirmek `Spotify` → `SPOTİFY`
  üretip görevin sınıflandırıcısıyla eşleşmeyi bozuyordu.
