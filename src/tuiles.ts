export type Appli = 'cyrose' | 'watchtracker'

/** Une tuile vit dans public/tuiles/<id>.html ; `affiche` = l'instant (s) de son image fixe. */
export interface Tuile {
  id: string
  appli: Appli
  titre: string
  affiche: number
}

export const TUILES: Tuile[] = [
  { id: 'cy-blackjack', appli: 'cyrose', titre: 'Blackjack', affiche: 11.4 },
  { id: 'cy-purple', appli: 'cyrose', titre: 'Purple', affiche: 8.15 },
  { id: 'cy-undercover', appli: 'cyrose', titre: 'Undercover', affiche: 12.6 },
  { id: 'cy-cliche', appli: 'cyrose', titre: 'Cliché', affiche: 5.45 },
  { id: 'cy-navale', appli: 'cyrose', titre: 'Bataille navale', affiche: 9.2 },
  { id: 'cy-menteur', appli: 'cyrose', titre: 'Bar des menteurs', affiche: 3 },
  { id: 'cy-salon', appli: 'cyrose', titre: 'Le salon', affiche: 5.5 },
  { id: 'cy-poker', appli: 'cyrose', titre: 'Poker', affiche: 12.5 },
  { id: 'cy-roulette', appli: 'cyrose', titre: 'Roulette', affiche: 9.8 },
  { id: 'wt-pile', appli: 'watchtracker', titre: 'La Pile', affiche: 2.6 },
  { id: 'wt-fiche', appli: 'watchtracker', titre: 'La fiche', affiche: 5.6 },
  { id: 'wt-avenir', appli: 'watchtracker', titre: 'À venir', affiche: 1.6 },
  { id: 'wt-amis', appli: 'watchtracker', titre: 'Les amis', affiche: 8.4 },
]

/** Répartit en tourniquet ; recycle les éléments pour qu'aucune colonne ne reste vide. */
export function repartir<T>(items: T[], n: number): T[][] {
  const cols: T[][] = Array.from({ length: n }, () => [])
  if (!items.length) return cols
  const total = Math.max(items.length, n)
  for (let i = 0; i < total; i++) cols[i % n].push(items[i % items.length])
  return cols
}
