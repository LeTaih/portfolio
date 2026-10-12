// Une iframe de tuile embarque parfois une appli React entière, et elle partage
// le fil principal de la page : on n'en garde que pour les tuiles proches de
// l'écran, et on les démarre une par une pour ne jamais figer le mur.

const MARGE = '10% 0px'
/** Délai entre deux démarrages de tuile. */
const ECART_MS = 220
/** Au-delà, une tuile visible garde son affiche fixe jusqu'à ce qu'une place se libère. */
const MAX_VIVANTES = () => (matchMedia('(min-width: 768px)').matches ? 8 : 4)
const vivantes = () => document.querySelectorAll('.tuile iframe').length

const enAttente = new Set<HTMLElement>()
let minuterie = 0

function suivante() {
  minuterie = 0
  const tuile = enAttente.values().next().value
  if (!tuile || vivantes() >= MAX_VIVANTES()) return
  enAttente.delete(tuile)
  monter(tuile)
  planifier()
}

function planifier() {
  if (minuterie || !enAttente.size) return
  minuterie = window.setTimeout(() => {
    // Le démarrage attend un creux : jamais au milieu d'une image du défilement.
    if ('requestIdleCallback' in window) requestIdleCallback(suivante, { timeout: 500 })
    else suivante()
  }, ECART_MS)
}

export function observer(colonne: HTMLElement): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  const io = new IntersectionObserver(
    entrees => {
      for (const e of entrees) {
        const tuile = e.target as HTMLElement
        if (e.isIntersecting) {
          enAttente.add(tuile)
        } else {
          enAttente.delete(tuile)
          // Une place se libère : la suivante en attente pourra démarrer.
          tuile.querySelector('iframe')?.remove()
        }
      }
      planifier()
    },
    { root: colonne, rootMargin: MARGE },
  )
  const tuiles = colonne.querySelectorAll<HTMLElement>('.tuile')
  tuiles.forEach(t => io.observe(t))

  return () => {
    io.disconnect()
    tuiles.forEach(t => enAttente.delete(t))
    colonne.querySelectorAll('iframe').forEach(f => f.remove())
  }
}

function monter(tuile: HTMLElement) {
  if (!tuile.isConnected || tuile.querySelector('iframe')) return
  const f = document.createElement('iframe')
  // En production, Vercel sert les pages sans extension (cleanUrls) : pas de détour par une 308.
  f.src = `/tuiles/${tuile.dataset.id}${import.meta.env.DEV ? '.html' : ''}`
  f.tabIndex = -1
  f.title = ''
  f.setAttribute('aria-hidden', 'true')
  // Fondu d'entrée : l'affiche reste visible tant que la tuile n'a pas peint.
  f.addEventListener('load', () => f.classList.add('pret'), { once: true })
  tuile.append(f)
}
