import GirisFormu from './GirisFormu'

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>
}) {
  const { devam } = await searchParams
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="kart w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Finans Takip</h1>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Devam etmek için giriş yap.
        </p>
        <GirisFormu devam={devam ?? '/'} />
      </div>
    </div>
  )
}
