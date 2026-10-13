import { copiesNecessaires, GESTE_MS, replier, trajet } from './boucle'
import { observer } from './chargement'
import { repartir, TUILES, type Appli } from './tuiles'

/** Vitesses en px/s ; le signe donne le sens. Une entrée par colonne. */
const VITESSES: Record<Appli, { large: number[]; etroit: number[] }> = {
  cyrose: { large: [24, -19, 28], etroit: [22, -18] },
  watchtracker: { large: [-21], etroit: [20, -16] },
}

interface Colonne {
  nettoyer: () => void
}

const large = matchMedia('(min-width: 768px)')
const reduit = matchMedia('(prefers-reduced-motion: reduce)')

let colonnes: Colonne[] = []

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

/** Pose la colonne, sa piste et une première copie ; la mesure attend que toutes ses voisines existent. */
function poserColonne(conteneur: HTMLElement, ids: string[]): HTMLElement {
  const el = document.createElement('div')
  el.className = 'colonne'
  const piste = document.createElement('div')
  piste.className = 'piste'
  const copie = document.createElement('div')
  copie.className = 'copie'
  ids.forEach(id => copie.append(tuile(id)))
  piste.append(copie)
  el.append(piste)
  conteneur.append(el)
  return el
}

function animerColonne(el: HTMLElement, vitesse: number, rang: number): Colonne {
  // La période d'une boucle est la hauteur d'une copie, gouttière comprise. Elle
  // dépend de la largeur de la colonne : on ne la mesure qu'une fois la zone complète.
  const piste = el.firstElementChild as HTMLElement
  const copie = piste.firstElementChild as HTMLElement
  const periode = copie.offsetHeight
  const n = copiesNecessaires(periode, el.clientHeight)
  for (let i = 1; i < n; i++) piste.append(copie.cloneNode(true))

  const arreterTuiles = observer(el)
  if (reduit.matches || periode <= 0) return { nettoyer: arreterTuiles }

  // Le mouvement est une animation de transform : le compositeur la joue seul,
  // sans le fil principal que les tuiles React des iframes partagent avec la page.
  // Un défilement piloté en JS sautait une image à chaque fois qu'une tuile calculait.
  const { images, duree } = trajet(periode, vitesse)
  const anim = piste.animate(images, { duration: duree, iterations: Infinity })
  // Départs décalés : les colonnes ne défilent pas en rang d'oignons.
  anim.currentTime = duree * ((rang * 0.37) % 1)

  // Un geste fige la piste ; le défilement natif de la colonne s'ajoute à son
  // décalage, puis l'animation reprend d'où le doigt l'a laissée.
  let reprise = 0
  let pose = -1 // le scrollTop que nous venons de poser nous-mêmes
  const geste = () => {
    anim.pause()
    clearTimeout(reprise)
    reprise = window.setTimeout(() => {
      pose = el.scrollTop = replier(el.scrollTop, periode)
      anim.play()
    }, GESTE_MS)
  }
  for (const type of ['wheel', 'touchstart', 'touchmove', 'pointerdown'] as const) {
    el.addEventListener(type, geste, { passive: true })
  }
  // Un défilement qui ne vient pas de nous (élan du doigt, barre, clavier) est un geste.
  el.addEventListener('scroll', () => {
    if (Math.abs(el.scrollTop - pose) > 2) geste()
  }, { passive: true })

  return {
    nettoyer: () => {
      clearTimeout(reprise)
      anim.cancel()
      arreterTuiles()
    },
  }
}

function demonter() {
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
