// STUB de web/src/lib/identity.ts — la session anonyme est déjà là : Léa.
import { MOI } from '../faux-serveur';

export interface Identity {
  playerId: string;
}
export const identityFromUser = (): Identity => ({ playerId: MOI });
export const ensureIdentity = async (): Promise<Identity> => ({ playerId: MOI });
export const hasIdentity = () => true;
export const currentPlayerId = () => MOI;
export const setIdentityForTests = () => {};
export const deconnecterSansRecharger = () => {};
