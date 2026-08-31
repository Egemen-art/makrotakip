import { taksonomiListesi } from '@/lib/veri'
import TaksonomiYonetimi from './TaksonomiYonetimi'

export const dynamic = 'force-dynamic'

export default async function TaksonomiSayfasi() {
  const taksonomi = await taksonomiListesi()
  const kategoriSayisi = new Set(taksonomi.map((t) => t.kategori)).size

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-semibold">Taksonomi</h1>
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          {kategoriSayisi} kategori · {taksonomi.length} alt kategori
        </span>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Yeni kategori ve alt kategori buradan eklenir; sınır yok.
      </p>
      <TaksonomiYonetimi taksonomi={taksonomi} />
    </>
  )
}
