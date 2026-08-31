# Finans Takip

Egemen'in kişisel finans sistemi. Notion + Google Drive + statik HTML panonun
yerine geçen Next.js uygulaması; tek doğru kaynak **Supabase** (`finans` şeması).

Her sabah 08:00'de (Europe/Istanbul) bulutta çalışan zamanlanmış bir Claude
oturumu Gmail'den banka bildirimlerini okuyup aynı veritabanına yazıyor.
Uygulama hem onu gösterir hem üzerine yazar.

## Ekranlar

| Yol | Ne yapar |
|---|---|
| `/` | Pano: aylık gider/gelir/aktarım trendi, kategori kıyaslama, denge, sabit aylık yükler, son işlemler |
| `/sorular` | **Soru kutusu** — `durum='Soruldu'` işlemleri tek dokunuşla sınıflandırır ve kalıcı kural yazar |
| `/islemler` | Canlı defter ve arşiv: filtre, arama, sayfalama, satır düzenleme, manuel giriş |
| `/kurallar` | Kural seti: hangi desen kaç kez isabet etmiş, düzenleme, silme |
| `/taksonomi` | Kategori / alt kategori ekleme — sınır yok |
| `/taksitler` | Plan listesi, kalan taksit, aylık yük, yük sahibi dağılımı |
| `/portfoy` | Anlık görüntü ekleme, geçmiş tablo, Modified Dietz getirisi |
| `/api/ingest` | Zamanlanmış görev için **yedek** yazma ucu (Bearer token) |

## Kurulum

```bash
npm install
cp .env.example .env.local   # değerleri doldur
npm run dev
```

### Ortam değişkenleri

| Değişken | Nerede kullanılır |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | her yerde |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | her yerde (RLS koruyor) |
| `SUPABASE_SERVICE_ROLE_KEY` | **yalnız** `/api/ingest`; tarayıcıya sızmaz |
| `INGEST_TOKEN` | `/api/ingest` Bearer koruması |

`SUPABASE_SERVICE_ROLE_KEY` boşsa uygulamanın geri kalanı normal çalışır,
yalnızca `/api/ingest` `503` döner.

## Giriş

Supabase Auth (e-posta + şifre). Veriye erişim veritabanında RLS ile tek bir
kullanıcı kimliğine kilitli — aynı Supabase projesinde başka bir uygulamanın
(beslenme takibi) kullanıcıları da var, onlar `finans` şemasında hiçbir satır
göremiyor.

## `/api/ingest`

```bash
curl -X POST https://<alan-adi>/api/ingest \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "content-type: application/json" \
  -d '{"islemler":[{"tarih":"2026-09-01","saat":"14:05","aciklama":"KRONOTROP",
       "tutar":180,"tip":"Gider","kategori":"🍜 Food","alt_kategori":"Kahve",
       "hesap":"Yapı Kredi Kart","durum":"Otomatik","guven":1,
       "kaynak":"Bildirim maili"}]}'
```

Yanıt: `{ "eklenen": n, "atlanan": n, "hatalar": [{ "sira": i, "sebep": "..." }] }`

Mükerrer kilidi **`tarih + saat + tutar + aciklama`**. Saat şart: aynı gün aynı
tutarda iki ayrı harcama olabiliyor.

## Bu uygulamanın uyduğu kurallar

- Toplamlara yalnızca `Gider` ve `Gelir` girer. `Transfer` ve `Hesaplaşma`
  toplam dışıdır ama panoda **görünür** — yatırıma 30.000 aktarmak ile 30.000
  harcamak aynı şey değil.
- Sapma ölçüsü `v_kategori_bant` (son 7 ay). 20 aylık ortalama kullanılmaz;
  `Market` kategorisi 2025/2026 arasında sınıflandırma değişikliği yüzünden
  kırıldı, uzun ortalama sürekli yanlış alarm üretir.
- `arsiv_islemler` donmuştur. Uygulama üzerinden yalnızca okunur — bu, RLS'te de
  `select`'e kısıtlanmıştır.
- Arşiv satırlarında `aciklama` null; listede kategoriye düşülür.
- Portföyde `eklenen_cekilen` boş bırakılamaz; para girişi yoksa `0`.
- Kart limiti yalnızca `6930` satırında tutulur (6930 · 8236 · 8588 aynı limiti
  paylaşır); toplam limit bu yüzden üç kat görünmez.
- Sınıflandırılamayan harcama tahminle `Onaylandı` yapılmaz, `Soruldu` kalır.
- Kategori listeleri Türkçe sıralanır (`localeCompare('tr')`).

## Test

```bash
npm test
```

Brief'teki iki kritik iş kuralını doğrular: mükerrer kilidi ve kural deseni
üretimi. Ayrıntı: `testler/README.md`.
