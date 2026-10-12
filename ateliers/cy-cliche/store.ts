// Le faux serveur en mémoire : l'état de la salle, les joueurs, et l'écho
// temps réel (avec la latence d'un téléphone) des écritures des vrais écrans.
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const abonnes = new Set<() => void>();
let dernierEcho = 0;

export const store: {
  room: Any; players: Any[]; gen: number; revelation: Any[];
  notify(): void; sub(f: () => void): () => void;
  applyRoom(r: Any): void;
  setCliche(patch: Record<string, unknown>): void;
  setPlayer(id: string, patch: Record<string, unknown>): void;
  echo(id: string, patch: Record<string, unknown>, latence?: number): void;
  reveler(): void;
} = {
  room: null, players: [], gen: 0, revelation: [],
  notify() { abonnes.forEach((f) => f()); },
  sub(f) { abonnes.add(f); return () => { abonnes.delete(f); }; },
  applyRoom(r) { store.room = r; store.notify(); },
  setCliche(patch) {
    store.room = { ...store.room, cliche: { ...store.room.cliche, ...patch } };
    store.notify();
  },
  setPlayer(id, patch) {
    store.players = store.players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    store.notify();
  },
  echo(id, patch, latence = 130) {
    const g = store.gen;
    const now = performance.now();
    const at = Math.max(now + latence, dernierEcho + 90);
    dernierEcho = at;
    setTimeout(() => { if (g === store.gen) store.setPlayer(id, patch); }, at - now);
  },
  // /api/cliche { action: 'reveal' } : le serveur écrit la révélation, qui
  // revient à l'hôte par le temps réel.
  reveler() {
    const g = store.gen;
    setTimeout(() => {
      if (g !== store.gen) return;
      store.setCliche({ phase: 'reveal', reveal: store.revelation, deadline: null });
    }, 420);
  },
};
