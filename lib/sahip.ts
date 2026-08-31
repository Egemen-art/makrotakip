/**
 * Finans verisinin sahibi. Ayni Supabase projesinde baska bir uygulamanin
 * (beslenme takibi) kullanicilari da var; veritabaninda RLS bu kimlige
 * daraltildi (finans.sahip_mi()). Buradaki kontrol arayuz tarafindaki
 * ikinci katman: baska bir hesapla girilirse bos ekran yerine net mesaj.
 */
export const SAHIP_UID = '94eb2769-6841-4a56-9fed-67fcce3a65ee'
