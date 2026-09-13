'use server'

import { revalidatePath } from 'next/cache'
import { supabaseSunucu } from '@/lib/supabase/server'
import { sayiOku, bugun } from '@/lib/bicim'
import { fiyatOku, kurTarihli, type FiyatKaynagi } from '@/lib/fiyatKaynak'
import {
  HAREKET_TURLERI, KAYNAK_TURLERI, VARLIK_SINIFLARI,
  type KaynakTur, type Varlik, type VarlikSinif,
} from '@/lib/tipler-varlik'

export type Sonuc = { tamam: true; bilgi?: string } | { tamam: false; hata: string }

const metin = (f: FormData, ad: string) => String(f.get(ad) ?? '').trim()

export async function varlikEkle(form: FormData): Promise<Sonuc> {
  const kod = metin(form, 'kod').toLocaleUpperCase('tr')
  const ad = metin(form, 'ad') || kod
  const sinif = metin(form, 'sinif') as VarlikSinif
  const kaynakTur = metin(form, 'kaynak_tur') as KaynakTur
  const sembol = metin(form, 'kaynak_sembol').toLocaleUpperCase('tr') || null
  const para = metin(form, 'para') || 'TRY'

  if (!kod) return { tamam: false, hata: 'Kod gerekli.' }
  if (!VARLIK_SINIFLARI.includes(sinif)) return { tamam: false, hata: 'Sınıf geçersiz.' }
  if (!KAYNAK_TURLERI.includes(kaynakTur)) return { tamam: false, hata: 'Fiyat kaynağı geçersiz.' }
  // Semboller fiyatin nereden okunacagini soyler; elle ve gram altin disinda zorunlu.
  if (!['elle', 'gram_altin'].includes(kaynakTur) && !sembol) {
    return { tamam: false, hata: 'Bu kaynak için sembol gerekli (THYAO, AAPL, TP2 gibi).' }
  }

  const sb = await supabaseSunucu()
  const { data: yeni, error } = await sb.from('varlik').insert({
    kod, ad, sinif, para, kaynak_tur: kaynakTur, kaynak_sembol: sembol,
    not_: metin(form, 'not_') || null,
  }).select('id').single()
  if (error) {
    return { tamam: false, hata: error.code === '23505' ? `${kod} zaten var.` : error.message }
  }

  // Elle degerlenen kalemde (BES, vadeli mevduat) "adet" diye bir sey yok:
  // deger dogrudan kalemin kendisidir. Kullaniciya 1 yazdirmak yerine
  // pozisyonu 1'e sabitleyip degeri fiyat olarak tutuyoruz.
  let bilgi: string | undefined
  if (kaynakTur === 'elle' && yeni) {
    const deger = sayiOku(form.get('deger'))
    const yatirilan = sayiOku(form.get('yatirilan'))
    const gun = bugun()

    await sb.from('varlik_hareket').insert({
      varlik_id: yeni.id, tarih: gun, tur: 'Giriş', miktar: 1,
      tutar: yatirilan, kaynak: 'Elle değerlenen kalem',
    })
    if (deger !== null && deger > 0) {
      await sb.from('fiyat').upsert({
        varlik_id: yeni.id, tarih: gun, fiyat: deger, para,
        kaynak: 'Elle girildi', olculdu: false,
      }, { onConflict: 'varlik_id,tarih' })
      bilgi = `${kod} eklendi · değer ${deger.toFixed(2)} ${para === 'USD' ? '$' : '₺'} olarak yazıldı.`
    } else {
      bilgi = `${kod} eklendi · değerini "Elle değer gir" bölümünden yaz.`
    }
  }

  revalidatePath('/portfoy/varliklar')
  return { tamam: true, bilgi }
}

export async function varlikSil(id: number): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const { error } = await sb.from('varlik').delete().eq('id', id)
  if (error) {
    return {
      tamam: false,
      // Hareketi olan varlik silinmez: gecmis kopmasin.
      hata: error.code === '23503' ? 'Bu varlığın hareketleri var; önce onları sil.' : error.message,
    }
  }
  revalidatePath('/portfoy/varliklar')
  return { tamam: true }
}

export async function hareketEkle(form: FormData): Promise<Sonuc> {
  const varlikId = Number(metin(form, 'varlik_id'))
  const tarih = metin(form, 'tarih')
  const tur = metin(form, 'tur')
  const miktar = sayiOku(form.get('miktar'))

  if (!varlikId) return { tamam: false, hata: 'Varlık seç.' }
  if (!tarih) return { tamam: false, hata: 'Tarih gerekli.' }
  if (!(HAREKET_TURLERI as readonly string[]).includes(tur)) return { tamam: false, hata: 'Hareket türü geçersiz.' }
  if (miktar === null) return { tamam: false, hata: 'Miktar gerekli.' }
  // Duzeltme MUTLAKTIR: elindeki gercek adet. 0 gecerlidir (hepsi cikti), negatif degil.
  if (miktar < 0) return { tamam: false, hata: 'Miktar negatif olamaz (azaltmak için Satım/Çıkış kullan).' }
  if (miktar === 0 && tur !== 'Düzeltme') return { tamam: false, hata: 'Miktar sıfırdan büyük olmalı.' }

  const sb = await supabaseSunucu()
  const birimFiyat = sayiOku(form.get('birim_fiyat'))
  let tutar = sayiOku(form.get('tutar'))
  let usdtry = sayiOku(form.get('usdtry'))
  let bilgi: string | undefined

  // TL tutari ELLE ZORUNLU DEGIL: birim fiyat varsa buradan hesaplanir.
  // Doviz kalemlerinde o GUNUN kuru cekilir (bugunku kurla gecmis cevrilmez).
  const { data: varlik } = await sb.from('varlik').select('para, kod').eq('id', varlikId).single()
  const para = (varlik?.para ?? 'TRY') as 'TRY' | 'USD' | 'EUR'

  if (tutar === null && birimFiyat !== null) {
    if (para === 'TRY') {
      tutar = Math.round(miktar * birimFiyat * 100) / 100
      bilgi = `Tutar birim fiyattan hesaplandı: ${tutar.toFixed(2)} ₺`
    } else {
      const kur = await kurTarihli(para, tarih)
      if (kur === null) {
        bilgi = `${tarih} için ${para}/TRY kuru gelmedi; tutar boş bırakıldı — getiri hesabı bu hareketi saymaz.`
      } else {
        tutar = Math.round(miktar * birimFiyat * kur * 100) / 100
        if (para === 'USD') usdtry = usdtry ?? Math.round(kur * 10000) / 10000
        bilgi = `Tutar ${para}/TRY ${kur.toFixed(4)} ile hesaplandı: ${tutar.toFixed(2)} ₺`
      }
    }
  }
  // Dolar bazli getiri icin gunun kuru her zaman kayda dusulsun (karar 43).
  if (usdtry === null) {
    const k = await kurTarihli('USD', tarih)
    if (k !== null) usdtry = Math.round(k * 10000) / 10000
  }

  const { error } = await sb.from('varlik_hareket').insert({
    varlik_id: varlikId,
    tarih,
    tur,
    miktar,
    birim_fiyat: birimFiyat,
    tutar,
    usdtry,
    kaynak: 'Elle',
    not_: metin(form, 'not_') || null,
  })
  if (error) return { tamam: false, hata: error.message }
  revalidatePath('/portfoy/varliklar')
  if (tur === 'Düzeltme') {
    bilgi = `${varlik?.kod ?? 'Varlık'} adedi ${miktar} olarak ayarlandı${bilgi ? ` · ${bilgi}` : ''}`
  }
  return { tamam: true, bilgi }
}

export async function hareketSil(id: number): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const { error } = await sb.from('varlik_hareket').delete().eq('id', id)
  if (error) return { tamam: false, hata: error.message }
  revalidatePath('/portfoy/varliklar')
  return { tamam: true }
}

/** Kaynagi olmayan kalemler (BES, vadeli mevduat) icin degeri elle yaz. */
export async function elleFiyat(form: FormData): Promise<Sonuc> {
  const varlikId = Number(metin(form, 'varlik_id'))
  const fiyat = sayiOku(form.get('fiyat'))
  const tarih = metin(form, 'tarih') || bugun()
  if (!varlikId || fiyat === null || fiyat <= 0) return { tamam: false, hata: 'Varlık ve değer gerekli.' }

  const sb = await supabaseSunucu()
  const { data: varlik } = await sb.from('varlik').select('para').eq('id', varlikId).single()
  const { error } = await sb.from('fiyat').upsert({
    varlik_id: varlikId, tarih, fiyat, para: varlik?.para ?? 'TRY',
    kaynak: 'Elle girildi', olculdu: false,
  }, { onConflict: 'varlik_id,tarih' })
  if (error) return { tamam: false, hata: error.message }
  revalidatePath('/portfoy/varliklar')
  return { tamam: true }
}

/**
 * Kaynagi olan her aktif varligin fiyatini okur ve finans.fiyat'a yazar.
 * Okunamayan kalem ATLANIR ve raporlanir — eski fiyat bugunun fiyatiymis gibi
 * kopyalanmaz, uydurma rakam yazilmaz.
 */
export async function fiyatlariGuncelle(): Promise<Sonuc> {
  const sb = await supabaseSunucu()
  const { data, error } = await sb.from('varlik').select('*').eq('aktif', true)
  if (error) return { tamam: false, hata: error.message }

  const varliklar = ((data ?? []) as Varlik[]).filter((v) => v.kaynak_tur !== 'elle')
  if (varliklar.length === 0) return { tamam: true, bilgi: 'Kaynağı olan varlık yok.' }

  const okumalar = await Promise.all(varliklar.map(async (v) => {
    const kaynak: FiyatKaynagi =
      v.kaynak_tur === 'bist' ? { tur: 'bist', sembol: v.kaynak_sembol ?? v.kod }
      : v.kaynak_tur === 'abd' ? { tur: 'abd', sembol: v.kaynak_sembol ?? v.kod }
      : v.kaynak_tur === 'fon' ? { tur: 'fon', kod: v.kaynak_sembol ?? v.kod, kurucu: 'tera' }
      : { tur: 'gram_altin' }
    return { varlik: v, okuma: await fiyatOku(kaynak) }
  }))

  const yazilacak = okumalar
    .filter((o) => o.okuma.fiyat !== null && o.okuma.para !== null)
    .map((o) => ({
      varlik_id: o.varlik.id,
      // Kaynak kendi tarihini veriyorsa o gune yazilir: borsa kapaliyken bugune
      // yazmak, olculmemis bir gunu olculmus gibi gosterirdi.
      tarih: o.okuma.tarih ?? bugun(),
      fiyat: o.okuma.fiyat!,
      para: o.okuma.para!,
      kaynak: o.okuma.kaynak,
      olculdu: true,
    }))

  if (yazilacak.length > 0) {
    const { error: yazmaHatasi } = await sb.from('fiyat').upsert(yazilacak, { onConflict: 'varlik_id,tarih' })
    if (yazmaHatasi) return { tamam: false, hata: yazmaHatasi.message }
  }

  const basarisiz = okumalar.filter((o) => o.okuma.fiyat === null)
  revalidatePath('/portfoy/varliklar')
  revalidatePath('/portfoy')
  return {
    tamam: true,
    bilgi: basarisiz.length === 0
      ? `${yazilacak.length} fiyat güncellendi.`
      : `${yazilacak.length} fiyat güncellendi · okunamadı: ${basarisiz.map((o) => `${o.varlik.kod} (${o.okuma.hata})`).join(', ')}`,
  }
}
