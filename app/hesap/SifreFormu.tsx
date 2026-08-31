'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { sifreDegistir } from './eylemler'

const kutu: React.CSSProperties = {
  background: 'var(--plane)', border: '1px solid var(--hair)', color: 'var(--ink)',
}

function Gonder() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit" disabled={pending}
      className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      style={{ background: 'var(--seri-1)' }}
    >
      {pending ? 'Değiştiriliyor…' : 'Şifreyi değiştir'}
    </button>
  )
}

export default function SifreFormu() {
  const [sonuc, eylem] = useActionState(sifreDegistir, null)

  return (
    <form action={eylem} className="mt-4 space-y-3">
      <label className="block">
        <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Yeni şifre</span>
        <input
          name="yeni" type="password" autoComplete="new-password" required minLength={10}
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={kutu}
        />
      </label>
      <label className="block">
        <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Yeni şifre (tekrar)</span>
        <input
          name="tekrar" type="password" autoComplete="new-password" required minLength={10}
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={kutu}
        />
      </label>

      {sonuc && !sonuc.tamam && (
        <p role="alert" className="text-[13px]" style={{ color: 'var(--kritik)' }}>{sonuc.hata}</p>
      )}
      {sonuc?.tamam && (
        <p role="status" className="text-[13px]" style={{ color: 'var(--iyi)' }}>
          Şifre değiştirildi.
        </p>
      )}

      <Gonder />
    </form>
  )
}
