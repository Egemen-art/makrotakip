'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { girisYap } from './eylemler'

function Gonder() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      style={{ background: 'var(--seri-1)' }}
    >
      {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
    </button>
  )
}

export default function GirisFormu({ devam }: { devam: string }) {
  const [hata, eylem] = useActionState(girisYap, null)

  return (
    <form action={eylem} className="mt-5 space-y-3">
      <input type="hidden" name="devam" value={devam} />
      <label className="block">
        <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>E-posta</span>
        <input
          name="eposta"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--plane)', border: '1px solid var(--hair)', color: 'var(--ink)' }}
        />
      </label>
      <label className="block">
        <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Şifre</span>
        <input
          name="sifre"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--plane)', border: '1px solid var(--hair)', color: 'var(--ink)' }}
        />
      </label>
      {hata && (
        <p role="alert" className="text-[13px]" style={{ color: 'var(--kritik)' }}>
          {hata}
        </p>
      )}
      <Gonder />
    </form>
  )
}
