// LE FAUX api/poker.ts : la VRAIE machine (partie.ts, qui tire evaluer.ts et
// pots.ts) sur une main tenue en mémoire. Ce que le vrai serveur écrit dans
// rooms.poker_main part ici dans le magasin, avec la latence d'un écho temps
// réel ; le secret (paquet, mains) ne sort que par « ma-main », comme en vrai.
import { agir, nouvelleMain } from '@cy/lib/poker/partie';
import { lireAction } from '@cy/lib/poker/serveur';
import type { Action, Donne } from '@cy/lib/poker/types';
import type { Card } from '@cy/lib/purple/types';
import { magasin } from '../magasin';

export const MOI = 'p-lea';
const ECHO_MS = 90;

let donne: Donne | null = null;

function publier(d: Donne, ms = ECHO_MS) {
  donne = d;
  const main = d.main;
  const pub = () => magasin.applyRoom({ ...magasin.room, poker_main: main, updated_at: new Date().toISOString() });
  if (ms <= 0) pub(); else magasin.plusTard(ms, pub);
}

export function oublier() { donne = null; }

/** La donne : le vrai `nouvelleMain`, sur un paquet arrangé. */
export function donner(p: { manche: number; joueurs: { id: string; tapis: number }[]; bouton: number; paquet: Card[] }) {
  publier(nouvelleMain({ ...p, maintenant: Date.now() }), 0);
}

/** Le geste d'un autre téléphone, appliqué par la machine. */
export function jouerPour(id: string, a: Action) {
  if (!donne) throw new Error('pas de main');
  const r = agir(donne, id, a, Date.now());
  if (typeof r === 'string') throw new Error(`${id} : ${r}`);
  publier(r, 0);
}

export const mainCourante = () => donne?.main ?? null;

/** /api/poker, vu de l'appelant (cf. lib/pokerApi.ts). */
export function repondre(body: Record<string, unknown>): unknown {
  switch (body.action) {
    case 'ma-main':
      return { main: donne && donne.secret.manche === body.manche ? donne.secret.mains[MOI] ?? null : null };
    case 'agir': {
      const coup = lireAction(body.coup);
      if (!donne || !coup) throw Object.assign(new Error('poker api 400 : illegal'), { code: 'illegal' });
      const r = agir(donne, MOI, coup, Date.now());
      if (typeof r === 'string') throw Object.assign(new Error(`poker api 409 : ${r}`), { code: r });
      publier(r);
      return { ok: true };
    }
    case 'passer':
      return { ok: false };
    case 'donner':
      return { ok: true };
    default:
      throw new Error('poker api 400');
  }
}
