export type Appli = 'cyrose' | 'watchtracker'

/** Une tuile vit dans public/tuiles/<id>.html ; `affiche` = l'instant (s) de son image fixe. */
export interface Tuile {
  id: string
  appli: Appli
  titre: string
  affiche: number
}

export const TUILES: Tuile[] = [
  { id: 'cy-blackjack', appli: 'cyrose', titre: 'Blackjack', affiche: 6 },
  { id: 'wt-pile', appli: 'watchtracker', titre: 'La Pile', affiche: 2.6 },
]

/** Répartit en tourniquet ; recycle les éléments pour qu'aucune colonne ne reste vide. */
export function repartir<T>(items: T[], n: number): T[][] {
  const cols: T[][] = Array.from({ length: n }, () => [])
  if (!items.length) return cols
  const total = Math.max(items.length, n)
  for (let i = 0; i < total; i++) cols[i % n].push(items[i % items.length])
  return cols
}
