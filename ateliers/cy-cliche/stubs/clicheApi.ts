// lib/clicheApi, côté tuile : le « serveur » de Cliché est le faux serveur.
import { store } from '../store';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function clicheNow() { await pause(30); return { now: Date.now() }; }
export async function clicheStartRank() { await pause(40); return { ok: true as const }; }
// La révélation : le serveur compte les points (ici, posés à la main) et écrit
// l'état public ; l'hôte le reçoit par le temps réel.
export async function clicheReveal() { store.reveler(); await pause(40); return { ok: true as const }; }
export async function clicheCleanup() { return { ok: true as const }; }
