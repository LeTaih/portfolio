// lib/supabase — aucune écriture réseau. Les échos « temps réel » des écritures
// du joueur sont joués par le script de la tuile (harnais.tsx), à l'heure dite.
export const supabase = {} as any;
const ok = async () => {};
export const setReady = ok;
export const setVote = ok;
export const setUcState = ok;
export const setAllVotes = ok;
export async function createRoom(): Promise<any> {
  return { code: 'tuile' };
}
