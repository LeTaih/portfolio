// Vérifie le mur dans un vrai Chrome : défilement autonome et indépendant,
// gestes, bascule mobile, redimensionnement, mouvement réduit, tuiles présentes.
// Captures dans /tmp/leteh-verif/. Sort en erreur à la première violation.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const SORTIE = '/tmp/leteh-verif'
mkdirSync(SORTIE, { recursive: true })

const serveur = await createServer({ server: { port: 4311, strictPort: true }, logLevel: 'error' })
await serveur.listen()
const BASE = 'http://localhost:4311'
const { TUILES } = await serveur.ssrLoadModule('/src/tuiles.ts')

const navigateur = await chromium.launch({ channel: 'chrome' })
let echecs = 0
const verifier = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`)
  if (!ok) echecs++
}
const pause = ms => new Promise(r => setTimeout(r, ms))

async function page(options) {
  const contexte = await navigateur.newContext(options)
  const p = await contexte.newPage()
  const erreurs = []
  p.on('pageerror', e => erreurs.push(e.message))
  await p.goto(BASE + '/')
  await pause(3500) // les tuiles démarrent une par une
  return { p, erreurs, contexte }
}
const positions = p => p.$$eval('.colonne', cs => cs.map(c => c.scrollTop))

try {
  // Chaque tuile du manifeste existe vraiment (le repli SPA de Vite renverrait la page).
  for (const t of TUILES) {
    const r = await fetch(`${BASE}/tuiles/${t.id}.html`)
    const texte = await r.text()
    verifier(r.ok && !texte.includes('class="mur"'), `tuile ${t.id} servie`)
  }

  // --- Ordinateur
  {
    const { p, erreurs, contexte } = await page({ viewport: { width: 1440, height: 900 } })
    const visibles = await p.$$eval('.colonne', cs => cs.filter(c => c.offsetParent).length)
    verifier(visibles === 4, `ordinateur : 4 colonnes (${visibles})`)
    const a = await positions(p)
    await pause(1000)
    const b = await positions(p)
    verifier(a.every((v, i) => Math.abs(b[i] - v) > 5), `chaque colonne avance seule (${a.map(Math.round)} → ${b.map(Math.round)})`)

    // Molette sur la 2e colonne : seule elle saute (écarts mesurés modulo la boucle).
    const periodes = await p.$$eval('.colonne', cs => cs.map(c => c.firstElementChild.offsetHeight))
    const ecart = (v, w, i) => { const d = Math.abs(v - w) % periodes[i]; return Math.min(d, periodes[i] - d) }
    const boite = await p.$eval('.colonne:nth-child(2)', c => { const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
    await p.mouse.move(boite.x, boite.y)
    const avant = await positions(p)
    await p.mouse.wheel(0, 300)
    await pause(120)
    const g1 = await positions(p)
    await pause(350)
    const g2 = await positions(p)
    const sauts = g2.map((v, i) => ecart(v, avant[i], i))
    verifier(sauts[1] > 200 && sauts.filter((_, i) => i !== 1).every(s => s < 60), `la molette ne bouge que sa colonne (${sauts.map(Math.round)})`)
    // Pendant le geste, l'auto-défilement se retire ; il reprend ensuite.
    verifier(ecart(g2[1], g1[1], 1) < 120, `pause pendant le geste (${Math.round(g1[1])} → ${Math.round(g2[1])})`)
    await pause(1200)
    const g3 = await positions(p)
    verifier(ecart(g3[1], g2[1], 1) > 3, 'reprise après le geste')

    // « Jouer » ouvre le choix des deux tables, Échap le referme.
    await p.click('[data-choix="cyrose"]')
    await pause(900)
    const choix = await p.evaluate(() => ({
      ouvert: document.querySelector('#choix-cyrose').open,
      liens: [...document.querySelectorAll('#choix-cyrose .porte')].map(a => a.href),
    }))
    verifier(choix.ouvert && choix.liens.join() === 'https://cyrose.fr/,https://alt.cyrose.fr/', `« Jouer » ouvre les deux tables (${choix.liens})`)
    await pause(2600)
    await p.mouse.move(1100, 300)
    await pause(400)
    await p.screenshot({ path: `${SORTIE}/choix.png` })
    await p.keyboard.press('Escape')
    await pause(300)
    verifier(!(await p.evaluate(() => document.querySelector('#choix-cyrose').open)), 'Échap referme le choix')

    const pageDefile = await p.evaluate(() => document.scrollingElement.scrollHeight > innerHeight)
    verifier(!pageDefile, 'la page elle-même ne défile pas')
    const iframes = await p.$$eval('iframe', fs => fs.length)
    verifier(iframes > 0 && iframes <= 8, `iframes chargées près de l'écran seulement (${iframes})`)
    await p.screenshot({ path: `${SORTIE}/ordinateur.png` })

    // Passage sous 768 px : reconstruction propre.
    await p.setViewportSize({ width: 600, height: 900 })
    await pause(1200)
    const etroites = await p.$$eval('.colonne', cs => cs.filter(c => c.offsetParent).length)
    verifier(etroites === 2, `après redimensionnement : 2 colonnes (${etroites})`)
    const orphelines = await p.$$eval('iframe', fs => fs.filter(f => !f.closest('.colonne')).length)
    verifier(orphelines === 0, 'aucune iframe orpheline')
    verifier(erreurs.length === 0, `aucune erreur JS (${erreurs.join(' | ')})`)
    await contexte.close()
  }

  // --- Téléphone
  {
    const { p, erreurs, contexte } = await page({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
    const zoneVisible = () => p.$$eval('.zone', zs => zs.filter(z => z.offsetParent).map(z => z.dataset.appli))
    verifier(JSON.stringify(await zoneVisible()) === '["cyrose"]', 'téléphone : Cyrose seul au départ')
    await p.screenshot({ path: `${SORTIE}/telephone-cyrose.png` })
    await p.tap('[data-choix="cyrose"]')
    await pause(3200)
    await p.screenshot({ path: `${SORTIE}/telephone-choix.png` })
    await p.tap('.choix-fermer')
    await pause(300)
    await p.tap('.bascule button[data-appli="watchtracker"]')
    await pause(1200)
    verifier(JSON.stringify(await zoneVisible()) === '["watchtracker"]', 'la bascule montre Watchtracker')
    const colonnesWt = await p.$$eval('.colonne', cs => cs.filter(c => c.offsetParent).length)
    verifier(colonnesWt === 2, `Watchtracker sur 2 colonnes (${colonnesWt})`)
    const a = await positions(p)
    await pause(800)
    const b = await positions(p)
    verifier(a.some((v, i) => Math.abs(b[i] - v) > 5), 'Watchtracker défile')
    await p.screenshot({ path: `${SORTIE}/telephone-watchtracker.png` })
    verifier(erreurs.length === 0, `aucune erreur JS (${erreurs.join(' | ')})`)
    await contexte.close()
  }

  // --- Mouvement réduit
  {
    const { p, erreurs, contexte } = await page({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const a = await positions(p)
    await pause(800)
    const b = await positions(p)
    verifier(a.every((v, i) => v === b[i]), 'mouvement réduit : immobile')
    verifier((await p.$$eval('iframe', fs => fs.length)) === 0, 'mouvement réduit : aucune iframe')
    verifier(erreurs.length === 0, 'aucune erreur JS')
    await contexte.close()
  }
} finally {
  await navigateur.close()
  await serveur.close()
}

console.log(echecs ? `\n${echecs} échec(s) — captures dans ${SORTIE}` : `\nTout est vert — captures dans ${SORTIE}`)
process.exit(echecs ? 1 : 0)
