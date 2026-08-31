import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import {
  BAGLAMLAR, DURUMLAR, KAYNAKLAR, TIPLER, YUK_SAHIPLERI,
} from '@/lib/tipler'
import { mukerrerAnahtar } from '@/lib/mukerrer'
import { SUPABASE_URL } from '@/lib/ortam'

export const dynamic = 'force-dynamic'

/**
 * Zamanlanmis gorev icin YEDEK yazma ucu. Normalde gorev Supabase'e MCP
 * baglayicisi uzerinden yaziyor; o yol duserse buraya POST atar.
 *
 *   POST /api/ingest
 *   Authorization: Bearer <INGEST_TOKEN>
 *   { "islemler": [ { tarih, aciklama, tutar, tip, ... } ] }
 *
 * Mukerrer kilidi: tarih + saat + tutar + aciklama. SAAT ŞART —
 * 24.08.2026'da ayni kafede iki ayri 75 ₺ vardi, saatsiz kilit birini yutuyordu.
 */

type Girdi = Record<string, unknown>

const metin = (d: unknown) => (typeof d === 'string' && d.trim() ? d.trim() : null)

function tokenGecerli(baslik: string | null, beklenen: string) {
  const verilen = baslik?.startsWith('Bearer ') ? baslik.slice(7) : ''
  const a = Buffer.from(verilen)
  const b = Buffer.from(beklenen)
  // timingSafeEqual esit uzunluk ister; uzunluk farki zaten gecersiz demek.
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(istek: Request) {
  const beklenenToken = process.env.INGEST_TOKEN
  const servisAnahtari = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!beklenenToken || !servisAnahtari) {
    return NextResponse.json(
      {
        hata: 'Uç yapılandırılmamış. INGEST_TOKEN ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli.',
      },
      { status: 503 },
    )
  }

  if (!tokenGecerli(istek.headers.get('authorization'), beklenenToken)) {
    return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 401 })
  }

  let govde: unknown
  try {
    govde = await istek.json()
  } catch {
    return NextResponse.json({ hata: 'Gövde geçerli JSON değil.' }, { status: 400 })
  }

  const ham = Array.isArray(govde)
    ? govde
    : Array.isArray((govde as { islemler?: unknown })?.islemler)
      ? ((govde as { islemler: unknown[] }).islemler)
      : null

  if (!ham) {
    return NextResponse.json(
      { hata: 'Gövde bir işlem dizisi ya da { "islemler": [...] } olmalı.' },
      { status: 400 },
    )
  }
  if (ham.length === 0) return NextResponse.json({ eklenen: 0, atlanan: 0, hatalar: [] })
  if (ham.length > 500) {
    return NextResponse.json({ hata: 'Tek istekte en fazla 500 işlem.' }, { status: 413 })
  }

  const hatalar: { sira: number; sebep: string }[] = []
  const gecerliler: Record<string, unknown>[] = []

  ham.forEach((satirHam, sira) => {
    const s = satirHam as Girdi
    const tarih = metin(s.tarih)
    const aciklama = metin(s.aciklama)
    const tutar = Number(s.tutar)
    const tip = metin(s.tip)

    if (!tarih || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
      return hatalar.push({ sira, sebep: 'tarih YYYY-AA-GG biçiminde olmalı' })
    }
    if (!aciklama) return hatalar.push({ sira, sebep: 'aciklama boş olamaz' })
    if (!isFinite(tutar) || tutar < 0) {
      return hatalar.push({ sira, sebep: 'tutar sıfır ya da daha büyük bir sayı olmalı' })
    }
    if (!tip || !TIPLER.includes(tip as never)) {
      return hatalar.push({ sira, sebep: `tip şunlardan biri olmalı: ${TIPLER.join(', ')}` })
    }

    const saat = metin(s.saat)
    if (saat && !/^\d{2}:\d{2}(:\d{2})?$/.test(saat)) {
      return hatalar.push({ sira, sebep: 'saat SS:DD biçiminde olmalı' })
    }

    const baglam = metin(s.baglam)
    const durum = metin(s.durum)
    const kaynak = metin(s.kaynak)
    const yukSahibi = metin(s.yuk_sahibi)
    const guvenHam = s.guven === undefined || s.guven === null ? null : Number(s.guven)

    if (baglam && !BAGLAMLAR.includes(baglam as never)) {
      return hatalar.push({ sira, sebep: 'baglam geçersiz' })
    }
    if (durum && !DURUMLAR.includes(durum as never)) {
      return hatalar.push({ sira, sebep: 'durum geçersiz' })
    }
    if (kaynak && !KAYNAKLAR.includes(kaynak as never)) {
      return hatalar.push({ sira, sebep: 'kaynak geçersiz' })
    }
    if (yukSahibi && !YUK_SAHIPLERI.includes(yukSahibi as never)) {
      return hatalar.push({ sira, sebep: 'yuk_sahibi geçersiz' })
    }
    if (guvenHam !== null && (!isFinite(guvenHam) || guvenHam < 0 || guvenHam > 1)) {
      return hatalar.push({ sira, sebep: 'guven 0 ile 1 arasında olmalı' })
    }

    const kategori = metin(s.kategori)

    gecerliler.push({
      tarih,
      saat: saat ? saat.slice(0, 5) : null,
      aciklama,
      tutar: Number(tutar.toFixed(2)),
      tip,
      kategori,
      // Taksonomi FK'si cifti bekler; kategori varsa alt bos birakilmaz.
      alt_kategori: kategori ? (metin(s.alt_kategori) ?? '—') : null,
      baglam: baglam ?? 'Normal',
      hesap: metin(s.hesap),
      // Siniflandirilamayani tahminle doldurup Onaylandi yapma — Soruldu birak.
      durum: durum ?? 'Soruldu',
      guven: guvenHam,
      kaynak: kaynak ?? 'Bildirim maili',
      yuk_sahibi: yukSahibi,
      not_: metin(s.not_),
    })
  })

  if (gecerliler.length === 0) {
    return NextResponse.json({ eklenen: 0, atlanan: 0, hatalar }, { status: hatalar.length ? 422 : 200 })
  }

  const sb = createClient(
    SUPABASE_URL,
    servisAnahtari,
    { db: { schema: 'finans' }, auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Mukerrer kontrolu: yalnizca ilgili tarihleri cek, bellekte karsilastir.
  const tarihler = [...new Set(gecerliler.map((g) => g.tarih as string))]
  const { data: mevcutlar, error: okumaHatasi } = await sb
    .from('islemler')
    .select('tarih, saat, tutar, aciklama')
    .in('tarih', tarihler)

  if (okumaHatasi) {
    return NextResponse.json({ hata: `Mükerrer kontrolü başarısız: ${okumaHatasi.message}` }, { status: 500 })
  }

  const mevcutAnahtarlar = new Set(
    (mevcutlar ?? []).map((m) => mukerrerAnahtar(m as Parameters<typeof mukerrerAnahtar>[0])),
  )

  const eklenecekler: Record<string, unknown>[] = []
  let atlanan = 0
  for (const g of gecerliler) {
    const k = mukerrerAnahtar(g as Parameters<typeof mukerrerAnahtar>[0])
    // Ayni gonderim icinde tekrarlananlari da yakala
    if (mevcutAnahtarlar.has(k)) { atlanan++; continue }
    mevcutAnahtarlar.add(k)
    eklenecekler.push(g)
  }

  if (eklenecekler.length === 0) {
    return NextResponse.json({ eklenen: 0, atlanan, hatalar })
  }

  const { data: eklenenler, error: yazmaHatasi } = await sb
    .from('islemler')
    .insert(eklenecekler)
    .select('id')

  if (yazmaHatasi) {
    return NextResponse.json(
      {
        hata: yazmaHatasi.message,
        ipucu: yazmaHatasi.code === '23503'
          ? 'Kategori/alt kategori çifti taksonomide yok. Önce taksonomiye ekle.'
          : undefined,
        eklenen: 0, atlanan, hatalar,
      },
      { status: 400 },
    )
  }

  return NextResponse.json({
    eklenen: eklenenler?.length ?? 0,
    atlanan,
    hatalar,
  })
}
