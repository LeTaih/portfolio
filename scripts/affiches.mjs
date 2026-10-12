// Génère l'image fixe de chaque tuile (public/tuiles/<id>.jpg) à l'instant
// déclaré dans src/tuiles.ts, puis l'image de partage public/og.jpg.
//   npm run affiches            → toutes
//   npm run affiches cy-poker   → seulement celles-là (l'og est refaite à chaque fois)
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const serveur = await createServer({ server: { port: 4310, strictPort: true }, logLevel: 'error' })
await serveur.listen()
const BASE = 'http://localhost:4310'
const { TUILES } = await serveur.ssrLoadModule('/src/tuiles.ts')
const voulues = process.argv.slice(2)
const pause = ms => new Promise(r => setTimeout(r, ms))

const navigateur = await chromium.launch({ channel: 'chrome' })
try {
  const p = await navigateur.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  for (const t of TUILES) {
    if (voulues.length && !voulues.includes(t.id)) continue
    await p.goto(`${BASE}/tuiles/${t.id}.html?t=${t.affiche}`)
    await p.evaluate(() => document.fonts.ready)
    // Certaines tuiles rejouent leur script jusqu'à t et le signalent (data-pret, data-fige).
    // Sondé depuis Node : une tuile à horloge virtuelle détourne son propre rAF.
    for (let i = 0; i < 40; i++) {
      const pret = await p.evaluate(() => { const d = document.documentElement.dataset; return d.pret === '1' || d.fige === '1' })
      if (pret) break
      await pause(100)
    }
    await pause(1500)
    await p.screenshot({ path: `public/tuiles/${t.id}.jpg`, type: 'jpeg', quality: 85 })
    console.log(`✓ ${t.id} (t=${t.affiche} s)`)
  }

  const og = await navigateur.newPage({ viewport: { width: 1200, height: 630 } })
  await og.goto(BASE + '/')
  await pause(5000)
  await og.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 85 })
  console.log('✓ og.jpg')
} finally {
  await navigateur.close()
  await serveur.close()
}
