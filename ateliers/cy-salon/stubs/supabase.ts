// STUB de web/src/lib/supabase.ts — aucune écriture réseau. Les deux appels qui
// font avancer le salon (créer la room, s'y asseoir) écrivent dans le faux
// serveur après le temps d'un aller-retour ; tous les autres sont des no-op :
// l'écran a déjà appliqué son changement en local (applyRoom), comme en vrai.
import { attendre } from '../horloge';
import { serveur, salonNeuf } from '../faux-serveur';
import type { Room } from '@cy/lib/types';

/** Les délais d'aller-retour joués par la tuile (ms). */
export const ALLER_RETOUR = { creer: 560, asseoir: 420 };

const reponse = { data: [], error: null };
const requete: Record<string, unknown> = {};
for (const k of ['select', 'eq', 'in', 'order', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete', 'limit'])
  requete[k] = () => requete;
requete.then = (r: (v: unknown) => unknown) => Promise.resolve(reponse).then(r);

export const supabase = {
  from: () => requete,
  rpc: async () => ({ data: false, error: null }),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};

export async function createRoom(hostId: string): Promise<Room> {
  await attendre(ALLER_RETOUR.creer);
  const room = salonNeuf(hostId);
  serveur.poserRoom(room);
  return room;
}

export async function upsertPlayer(p: { id: string; name: string; color: string; is_host?: boolean; sobre?: boolean }): Promise<void> {
  await attendre(ALLER_RETOUR.asseoir);
  serveur.ajouterJoueur({ ...p, is_host: !!p.is_host, can_control: !!p.is_host, sobre: !!p.sobre });
}

export async function getRoom(..._: unknown[]): Promise<any> {}
export async function renameRoom(..._: unknown[]): Promise<any> {}
export async function getPlayers(..._: unknown[]): Promise<any> {}
export async function ajouterFictif(..._: unknown[]): Promise<any> {}
export async function removePlayer(..._: unknown[]): Promise<any> {}
export async function setPlayerControl(..._: unknown[]): Promise<any> {}
export async function setPlayerColor(..._: unknown[]): Promise<any> {}
export async function renamePlayer(..._: unknown[]): Promise<any> {}
export async function setForcedQuestions(..._: unknown[]): Promise<any> {}
export async function commitQuestion(..._: unknown[]): Promise<any> {}
export async function setRole(..._: unknown[]): Promise<any> {}
export async function setStats(..._: unknown[]): Promise<any> {}
export async function setRoomState(..._: unknown[]): Promise<any> {}
export async function setOrdreJoueurs(..._: unknown[]): Promise<any> {}
export async function setSipsRange(..._: unknown[]): Promise<any> {}
export async function setPacks(..._: unknown[]): Promise<any> {}
export async function setRoomGame(..._: unknown[]): Promise<any> {}
export async function setUcState(..._: unknown[]): Promise<any> {}
export async function setPurpleState(..._: unknown[]): Promise<any> {}
export async function setClicheState(..._: unknown[]): Promise<any> {}
export async function uploadClichePhoto(..._: unknown[]): Promise<any> {}
export async function setClicheVote(..._: unknown[]): Promise<any> {}
export async function setSobre(..._: unknown[]): Promise<any> {}
export async function setNavaleCamp(..._: unknown[]): Promise<any> {}
export async function setClicheProposal(..._: unknown[]): Promise<any> {}
export async function clearClicheProposal(..._: unknown[]): Promise<any> {}
export async function setClicheReady(..._: unknown[]): Promise<any> {}
export async function resetClichePlayers(..._: unknown[]): Promise<any> {}
export async function clearClicheReady(..._: unknown[]): Promise<any> {}
export async function clearClicheRound(..._: unknown[]): Promise<any> {}
export async function setVote(..._: unknown[]): Promise<any> {}
export async function setReady(..._: unknown[]): Promise<any> {}
export async function setAllVotes(..._: unknown[]): Promise<any> {}
export async function setCkkState(..._: unknown[]): Promise<any> {}
export async function setCkkGuess(..._: unknown[]): Promise<any> {}
export async function setCkkReady(..._: unknown[]): Promise<any> {}
export async function setPyraState(..._: unknown[]): Promise<any> {}
export async function setPyraAnswer(..._: unknown[]): Promise<any> {}
export async function clearPyraAnswers(..._: unknown[]): Promise<any> {}
export async function setCasinoTable(..._: unknown[]): Promise<any> {}
export async function setCasinoSession(..._: unknown[]): Promise<any> {}
export async function updateCasinoPlayer(..._: unknown[]): Promise<any> {}
export async function setAlcootest(..._: unknown[]): Promise<any> {}
export async function setAlcootestResultat(..._: unknown[]): Promise<any> {}
export async function clearAlcootestResultats(..._: unknown[]): Promise<any> {}
