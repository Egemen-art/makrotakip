import { NextResponse } from 'next/server'
import { supabaseSunucu } from '@/lib/supabase/server'

export async function POST(istek: Request) {
  const supabase = await supabaseSunucu()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/giris', istek.url), { status: 303 })
}
