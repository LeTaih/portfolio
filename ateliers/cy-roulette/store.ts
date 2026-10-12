// Faux serveur en mémoire : les écritures des vrais écrans y arrivent, et
// reviennent comme un écho temps réel, avec une latence de téléphone (et dans
// l'ordre d'émission, à 170 ms d'écart au moins, comme une file realtime).
type Any = any;
const listeners = new Set<() => void>();
let dernier = 0;
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
    const at = Math.max(now + latence, dernier + 170);
    dernier = at;
    setTimeout(() => { if (g === store.gen) store.setPlayer(id, updates); }, at - now);
  },
};
