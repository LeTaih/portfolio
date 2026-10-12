// LE MAGASIN : ce que Supabase et le temps réel tiennent dans l'appli — la ligne
// `rooms` et les lignes `players` du salon — en mémoire. `gen` change à chaque
// boucle : une écriture en retard d'une boucle ne touche pas la suivante.
import type { Player, Room } from '@cy/lib/types';

const ecouteurs = new Set<() => void>();

export const magasin = {
  room: null as unknown as Room,
  players: [] as Player[],
  gen: 0,
  notifier() { ecouteurs.forEach((f) => f()); },
  abonner(f: () => void) { ecouteurs.add(f); return () => { ecouteurs.delete(f); }; },
  applyRoom(r: Room) { magasin.room = r; magasin.notifier(); },
  setPlayer(id: string, patch: Partial<Player>) {
    magasin.players = magasin.players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    magasin.notifier();
  },
  /** Un écho du temps réel, `ms` plus tard, s'il est encore de cette boucle. */
  plusTard(ms: number, f: () => void) {
    const g = magasin.gen;
    setTimeout(() => { if (g === magasin.gen) f(); }, ms);
  },
};
