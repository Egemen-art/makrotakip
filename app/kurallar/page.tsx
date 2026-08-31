import { kuralListesi, taksonomiListesi } from '@/lib/veri'
import KuralTablosu from './KuralTablosu'

export const dynamic = 'force-dynamic'

export default async function KurallarSayfasi() {
  const [kurallar, taksonomi] = await Promise.all([kuralListesi(), taksonomiListesi()])
  const toplamIsabet = kurallar.reduce((t, k) => t + (k.isabet ?? 0), 0)

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-semibold">Kurallar</h1>
        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          {kurallar.length} kural · toplam {toplamIsabet} isabet
        </span>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
        Sabahki görev harcamaları bu desenlere göre sınıflandırıyor. Sistemin en kıymetli parçası.
      </p>
      <KuralTablosu kurallar={kurallar} taksonomi={taksonomi} />
    </>
  )
}
