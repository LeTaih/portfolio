// lib/ucApi — le serveur d'Undercover (api/uc), en mémoire. `myword` rend le
// mot du joueur, et toute la table secrète une fois la partie finie (phase
// 'ended'), exactement comme l'action du vrai serveur.
import { magasin } from '../magasin';

export const TABLE: { player_id: string; role: 'civil' | 'undercover' | 'mrwhite'; word: string | null }[] = [];

export function ucMyWord(_room: string, cibleId: string) {
  const x = TABLE.find((r) => r.player_id === cibleId);
  const fin = magasin.room?.uc?.phase === 'ended';
  return Promise.resolve({
    role: x?.role ?? null,
    word: x?.word ?? null,
    pair: fin ? magasin.room.uc.pair : null,
    reveal: fin ? TABLE : undefined,
  });
}
const ok = () => Promise.resolve({ ok: true as const });
export const ucDeal = ok;
export const ucResolve = ok;
export const ucGuess = () => Promise.resolve({ ok: true as const, correct: false });
export const ucRemove = () => Promise.resolve({ ok: true as const, eliminated: null });
export const ucStatus = () => Promise.reject(new Error('hors ligne'));
