// lib/supabase, côté tuile : aucune base. Les écritures des vrais écrans
// arrivent dans le faux serveur et reviennent en écho, avec une latence.
import { store } from '../store';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const supabase = {} as unknown;
export async function setClicheVote(playerId: string, vote: Record<string, string[]>) { store.echo(playerId, { cliche_vote: vote }); await pause(60); }
export async function setClicheReady(playerId: string, ready: boolean) { store.echo(playerId, { cliche_ready: ready }); await pause(60); }
export async function clearClicheReady() { await pause(40); }
export async function setClicheState() { await pause(40); }
export async function setClicheProposal() { await pause(40); }
export async function clearClicheProposal() { await pause(40); }
export async function resetClichePlayers() { await pause(40); }
export async function clearClicheRound() { await pause(40); }
export async function uploadClichePhoto() { await pause(40); return { photoId: '', url: '' }; }
