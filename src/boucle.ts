/** Fenêtre pendant laquelle un geste manuel suspend l'auto-défilement. */
export const GESTE_MS = 800

/** Avance une position de défilement et la replie sur une copie du contenu. */
export function avancer(pos: number, vitesse: number, dt: number, periode: number): number {
  if (periode <= 0) return pos
  const p = (pos + vitesse * dt) % periode
  return p < 0 ? p + periode : p
}

/** Copies du contenu pour qu'une vue entière tienne après n'importe quel repli. */
export function copiesNecessaires(hauteurCopie: number, hauteurVue: number): number {
  if (hauteurCopie <= 0) return 2
  return Math.max(2, Math.ceil(hauteurVue / hauteurCopie) + 1)
}

export function doitAvancer(maintenant: number, gesteJusqua: number): boolean {
  return maintenant >= gesteJusqua
}
