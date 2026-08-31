import Link from 'next/link'

export default function Bolum({
  baslik, aciklama, baglanti, children, sarmalaMi = true,
}: {
  baslik: string
  aciklama?: string
  baglanti?: { yol: string; ad: string }
  children: React.ReactNode
  sarmalaMi?: boolean
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{baslik}</h2>
          {aciklama && (
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>{aciklama}</p>
          )}
        </div>
        {baglanti && (
          <Link
            href={baglanti.yol}
            className="shrink-0 text-[12px] font-medium"
            style={{ color: 'var(--seri-1)' }}
          >
            {baglanti.ad} →
          </Link>
        )}
      </div>
      {sarmalaMi ? <div className="kart p-4">{children}</div> : children}
    </section>
  )
}
