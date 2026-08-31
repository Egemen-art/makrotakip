// Kritik is kurallarinin duman testi. `node --experimental-strip-types` ile
// TypeScript kaynagi dogrudan calistirilir.
import assert from 'node:assert/strict'
import { mukerrerAnahtar } from '../lib/mukerrer.ts'
import { desenUret } from '../lib/oneri.ts'

let gecen = 0
const t = (ad, fn) => {
  try { fn(); gecen++; console.log(`  ✓ ${ad}`) }
  catch (e) { console.error(`  ✗ ${ad}\n    ${e.message}`); process.exitCode = 1 }
}

console.log('Mükerrer kilidi (tuzak 13 — saat şart):')
t('aynı gün, aynı tutar, farklı saat MÜKERRER DEĞİL', () => {
  const a = mukerrerAnahtar({ tarih: '2026-08-24', saat: '11:20', tutar: 75, aciklama: 'KAHVE' })
  const b = mukerrerAnahtar({ tarih: '2026-08-24', saat: '16:45', tutar: 75, aciklama: 'KAHVE' })
  assert.notEqual(a, b)
})
t('her şeyi aynı olan iki satır mükerrer', () => {
  assert.equal(
    mukerrerAnahtar({ tarih: '2026-08-24', saat: '11:20', tutar: '75.00', aciklama: 'KAHVE' }),
    mukerrerAnahtar({ tarih: '2026-08-24', saat: '11:20:00', tutar: 75, aciklama: ' KAHVE ' }),
  )
})
t('saatsiz iki satır birbiriyle mükerrer sayılır', () => {
  assert.equal(
    mukerrerAnahtar({ tarih: '2026-08-24', saat: null, tutar: 75, aciklama: 'KAHVE' }),
    mukerrerAnahtar({ tarih: '2026-08-24', saat: undefined, tutar: '75.0', aciklama: 'KAHVE' }),
  )
})
t('saatli ile saatsiz ayrı kayıt', () => {
  assert.notEqual(
    mukerrerAnahtar({ tarih: '2026-08-24', saat: '11:20', tutar: 75, aciklama: 'KAHVE' }),
    mukerrerAnahtar({ tarih: '2026-08-24', saat: null, tutar: 75, aciklama: 'KAHVE' }),
  )
})

console.log('\nKural deseni üretimi (gerçek banka bildirimleri):')
const ornekler = [
  ['FİLE FİLE F157 GÖRÜKLE N', 'FİLE FİLE'],
  ['KALAN MARKET 2', 'KALAN MARKET'],
  ['KOCTAS FIX BURSA GORUKLE', 'KOCTAS FIX'],
  ['UBER EATS/TRENDYOL GO', 'UBER EATS TRENDYOL GO'],
  ['IYZICO/HBOMAX.COM', 'IYZICO HBOMAX COM'],
  ['FAST — Selda Eşseven (gelen)', 'FAST SELDA EŞSEVEN'],
  ['TRENDYOL.COM', 'TRENDYOL COM'],
  ['Spotify', 'SPOTIFY'],
]
for (const [ham, beklenen] of ornekler) {
  t(`${ham} → ${beklenen}`, () => assert.equal(desenUret(ham), beklenen))
}
t('boş açıklama boş desen üretir', () => assert.equal(desenUret(null), ''))

console.log(`\n${gecen} kontrol geçti.`)
