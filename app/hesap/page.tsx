import { supabaseSunucu } from '@/lib/supabase/server'
import SifreFormu from './SifreFormu'

export const dynamic = 'force-dynamic'

export default async function HesapSayfasi() {
  const sb = await supabaseSunucu()
  const { data: { user } } = await sb.auth.getUser()

  return (
    <>
      <h1 className="text-[17px] font-semibold">Hesap</h1>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        {user?.email}
      </p>

      <div className="kart mt-4 max-w-sm p-4">
        <h2 className="text-[14px] font-medium">Şifre değiştir</h2>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          Supabase panelinden atadığın geçici şifreyi burada kendi şifrenle
          değiştirebilirsin.
        </p>
        <SifreFormu />
      </div>
    </>
  )
}
