import { store } from '../store';
export const supabase = {} as any;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function setCasinoTable() { await pause(40); }
export async function setCasinoSession() { await pause(40); }
export async function updateCasinoPlayer(id: string, updates: Record<string, unknown>) { store.echo(id, updates); await pause(50); }
export async function getPlayers() { await pause(60); return store.players; }
export async function removePlayer() {}
