// Faux serveur en mémoire : les écritures des vrais écrans y arrivent, et
// reviennent comme un écho temps réel, avec une latence de téléphone.
type Any = any;
const listeners = new Set<() => void>();
let lastEcho = 0;
const DONNE: Record<string, number> = { 'p-marc': 160, 'p-ines': 360, 'p-lea': 560 };
export const store: {
  room: Any; players: Any[]; gen: number;
  notify(): void; sub(f: () => void): () => void;
  applyRoom(r: Any): void;
  echo(id: string, updates: Record<string, unknown>, latence?: number): void;
  setPlayer(id: string, patch: Record<string, unknown>): void;
} = {
  room: null, players: [], gen: 0,
  notify() { listeners.forEach((f) => f()); },
  sub(f) { listeners.add(f); return () => listeners.delete(f); },
  applyRoom(r) { store.room = r; store.notify(); },
  setPlayer(id, patch) {
    store.players = store.players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    store.notify();
  },
  echo(id, updates, latence = 130) {
    const g = store.gen;
    const now = performance.now();
    // La donne : trois écritures parties ensemble, trois échos qui reviennent
    // l'un après l'autre (l'ordre d'arrivée d'un temps réel n'est pas garanti).
    const donne = (updates as any).bj_state?.draws ? DONNE[id] : undefined;
    if (donne !== undefined) {
      setTimeout(() => { if (g === store.gen) store.setPlayer(id, updates); }, donne);
      lastEcho = Math.max(lastEcho, now + donne);
      return;
    }
    const at = Math.max(now + latence, lastEcho + 170);
    lastEcho = at;
    setTimeout(() => { if (g === store.gen) store.setPlayer(id, updates); }, at - now);
  },
};
