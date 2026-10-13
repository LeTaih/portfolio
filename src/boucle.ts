/** Fenêtre pendant laquelle un geste manuel suspend l'auto-défilement. */
export const GESTE_MS = 800

/** Une boucle de défilement : une période parcourue à vitesse constante (px/s, signe = sens). */
export function trajet(periode: number, vitesse: number): { images: Keyframe[]; duree: number } {
  const haut = { transform: `translateY(${-periode}px)` }
  const bas = { transform: 'translateY(0px)' }
  return { images: vitesse >= 0 ? [bas, haut] : [haut, bas], duree: (periode / Math.abs(vitesse)) * 1000 }
}

/** Ramène un défilement dans la première période : le contenu se répète, le saut ne se voit pas. */
export function replier(pos: number, periode: number): number {
  return periode > 0 ? pos % periode : pos
}

/**
 * Copies du contenu pour qu'une vue entière tienne, quel que soit le décalage de
 * l'animation et du défilement à la main (chacun jusqu'à une période).
 */
export function copiesNecessaires(hauteurCopie: number, hauteurVue: number): number {
  if (hauteurCopie <= 0) return 2
  return Math.max(3, Math.ceil(hauteurVue / hauteurCopie) + 2)
}
