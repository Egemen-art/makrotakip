'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BAGLANTILAR = [
  { yol: '/', ad: 'Pano' },
  { yol: '/sorular', ad: 'Sorular' },
  { yol: '/islemler', ad: 'İşlemler' },
  { yol: '/taksitler', ad: 'Taksitler' },
  { yol: '/portfoy', ad: 'Portföy' },
  { yol: '/kurallar', ad: 'Kurallar' },
  { yol: '/taksonomi', ad: 'Taksonomi' },
]

export default function Gezinti() {
  const yol = usePathname()
  if (yol.startsWith('/giris')) return null

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur"
      style={{
        background: 'color-mix(in srgb, var(--plane) 88%, transparent)',
        borderBottom: '1px solid var(--hair)',
      }}
    >
      <nav className="mx-auto flex max-w-[1180px] items-center gap-1 overflow-x-auto px-4 py-2.5 sm:px-6">
        {BAGLANTILAR.map((b) => {
          const etkin = b.yol === '/' ? yol === '/' : yol.startsWith(b.yol)
          return (
            <Link
              key={b.yol}
              href={b.yol}
              aria-current={etkin ? 'page' : undefined}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={{
                background: etkin ? 'var(--seri-1)' : 'transparent',
                color: etkin ? '#fff' : 'var(--ink-2)',
              }}
            >
              {b.ad}
            </Link>
          )
        })}
        <form action="/giris/cikis" method="post" className="ml-auto shrink-0">
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-[13px]"
            style={{ color: 'var(--ink-muted)' }}
          >
            Çıkış
          </button>
        </form>
      </nav>
    </header>
  )
}
