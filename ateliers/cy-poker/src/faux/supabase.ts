// Remplace web/src/lib/supabase.ts : aucune requête. Les écritures de la table
// sont déjà appliquées en local par l'appli (transition optimiste) ; celles des
// lignes `players` reviennent par le magasin, comme un écho temps réel.
import type { Player } from '@cy/lib/types';
import { magasin } from '../magasin';

const rien = async () => {};

export const supabase = new Proxy({}, { get: () => () => { throw new Error('supabase : hors de la tuile'); } });

export const setCasinoTable = rien;
export const setCasinoSession = rien;
export async function updateCasinoPlayer(playerId: string, updates: Partial<Player>): Promise<void> {
  magasin.plusTard(120, () => magasin.setPlayer(playerId, updates));
}
export const removePlayer = rien;
