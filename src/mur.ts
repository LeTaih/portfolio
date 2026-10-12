import { avancer, copiesNecessaires, doitAvancer, GESTE_MS } from './boucle'
import { observer } from './chargement'
import { repartir, TUILES, type Appli } from './tuiles'

/** Vitesses en px/s ; le signe donne le sens. Une entrée par colonne. */
const VITESSES: Record<Appli, { large: number[]; etroit: number[] }> = {
  cyrose: { large: [24, -19, 28], etroit: [22, -18] },
  watchtracker: { large: [-21], etroit: [20, -16] },
}

interface Colonne {
  el: HTMLElement
  vitesse: number
  pos: number
  periode: number
  gesteJusqua: number
  nettoyer: () => void
}

const large = matchMedia('(min-width: 768px)')
const reduit = matchMedia('(prefers-reduced-motion: reduce)')

let colonnes: Colonne[] = []
let raf = 0

function tuile(id: string): HTMLElement {
  const fig = document.createElement('figure')
  fig.className = 'tuile'
  fig.dataset.id = id
  const img = document.createElement('img')
  img.src = `/tuiles/${id}.jpg`
  img.alt = ''
  img.decoding = 'async'
  // Sans affiche, le fond sombre de la tuile tient la place.
  img.addEventListener('error', () => img.remove(), { once: true })
  fig.append(img)
  return fig
}

/** Pose la colonne et sa première copie ; la mesure attend que toutes ses voisines existent. */
function poserColonne(conteneur: HTMLElement, ids: string[]): HTMLElement {
  const el = document.createElement('div')
  el.className = 'colonne'
  const copie = document.createElement('div')
  copie.className = 'copie'
  ids.forEach(id => copie.append(tuile(id)))
  el.append(copie)
  conteneur.append(el)
  return el
}

function animerColonne(el: HTMLElement, vitesse: number, rang: number): Colonne {
  // La période d'une boucle est la hauteur d'une copie, gouttière comprise. Elle
  // dépend de la largeur de la colonne : on ne la mesure qu'une fois la zone complète.
  const copie = el.firstElementChild as HTMLElement
  const periode = copie.offsetHeight
  const n = copiesNecessaires(periode, el.clientHeight)
  for (let i = 1; i < n; i++) el.append(copie.cloneNode(true))

  const c: Colonne = {
    el,
    vitesse,
    // Départs décalés : les colonnes ne défilent pas en rang d'oignons.
    pos: periode * ((rang * 0.37) % 1),
    periode,
    gesteJusqua: 0,
    nettoyer: () => {},
  }
  el.scrollTop = c.pos

  const geste = () => { c.gesteJusqua = performance.now() + GESTE_MS }
  for (const type of ['wheel', 'touchstart', 'touchmove', 'pointerdown'] as const) {
    el.addEventListener(type, geste, { passive: true })
  }
  // Un défilement qui ne vient pas de nous (élan du doigt, barre, clavier) est un geste.
  el.addEventListener('scroll', () => {
    if (Math.abs(el.scrollTop - c.pos) > 2) {
      geste()
      c.pos = el.scrollTop
    }
  }, { passive: true })

  c.nettoyer = observer(el)
  return c
}

function demonter() {
  cancelAnimationFrame(raf)
  colonnes.forEach(c => c.nettoyer())
  colonnes = []
  document.querySelectorAll<HTMLElement>('.colonnes').forEach(z => z.replaceChildren())
}

function construire() {
  demonter()
  const format = large.matches ? 'large' : 'etroit'
  let rang = 0
  document.querySelectorAll<HTMLElement>('.zone').forEach(zone => {
    const conteneur = zone.querySelector<HTMLElement>('.colonnes')
    // Une zone masquée (téléphone) n'a pas de hauteur : elle sera construite à son tour.
    if (!conteneur || !zone.offsetParent) return
    const appli = zone.dataset.appli as Appli
    const vitesses = VITESSES[appli][format]
    const ids = TUILES.filter(t => t.appli === appli).map(t => t.id)
    const poses = repartir(ids, vitesses.length).map(col => poserColonne(conteneur, col))
    poses.forEach((el, i) => colonnes.push(animerColonne(el, vitesses[i], rang++)))
  })
  if (!reduit.matches) animer()
}

function animer() {
  let avant = performance.now()
  const pas = (maintenant: number) => {
    // Plafonné : un onglet revenu de l'arrière-plan ne fait pas de bond.
    const dt = Math.min(0.05, (maintenant - avant) / 1000)
    avant = maintenant
    for (const c of colonnes) {
      if (!doitAvancer(maintenant, c.gesteJusqua)) continue
      c.pos = avancer(c.pos, c.vitesse, dt, c.periode)
      c.el.scrollTop = c.pos
    }
    raf = requestAnimationFrame(pas)
  }
  raf = requestAnimationFrame(pas)
}

function choisir(appli: Appli) {
  document.body.dataset.appli = appli
  document.querySelectorAll<HTMLButtonElement>('.bascule button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.appli === appli))
  })
  construire()
}

export function monterMur() {
  document.querySelectorAll<HTMLButtonElement>('.bascule button').forEach(b => {
    b.addEventListener('click', () => choisir(b.dataset.appli as Appli))
  })
  large.addEventListener('change', construire)
  reduit.addEventListener('change', construire)
  // Seule la largeur compte : sur téléphone, la barre d'adresse qui se replie
  // change la hauteur à chaque défilement et rechargerait toutes les tuiles.
  let attente = 0
  let largeur = innerWidth
  addEventListener('resize', () => {
    if (innerWidth === largeur) return
    largeur = innerWidth
    clearTimeout(attente)
    attente = window.setTimeout(construire, 250)
  })
  construire()
}
