// Remplace web/src/lib/appelApi.ts : aucun fetch. L'appel au poker part au faux
// serveur après un aller-retour simulé ; les autres fonctions n'existent pas ici.
import { repondre } from './serveur';

export type FonctionJeu = 'uc' | 'ckk' | 'cliche' | 'navale' | 'menteur' | 'poker';

const ALLER_RETOUR_MS = 140;

export async function appelerApi<T>(fonction: FonctionJeu, body: Record<string, unknown>): Promise<T> {
  await new Promise((ok) => setTimeout(ok, ALLER_RETOUR_MS));
  if (fonction !== 'poker') throw new Error(`${fonction} : hors de la tuile`);
  return repondre(body) as T;
}
