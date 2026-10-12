// Faux serveur en mémoire. Le salon et les joueurs vivent ici ; le script de la
// tuile y pose les écritures « des autres téléphones » (temps réel simulé) et les
// vrais écrans d'Undercover s'y abonnent comme à useRoom.
type Any = any;
const abonnes = new Set<() => void>();

export const magasin: {
  room: Any;
  players: Any[];
  notifier(): void;
  abonner(f: () => void): () => void;
  applyRoom(r: Any): void;
  uc(patch: Any): void;
  joueur(id: string, patch: Any): void;
  tous(patch: Any): void;
} = {
  room: null,
  players: [],
  notifier() {
    abonnes.forEach((f) => f());
  },
  abonner(f) {
    abonnes.add(f);
    return () => abonnes.delete(f);
  },
  applyRoom(r) {
    magasin.room = r;
    magasin.notifier();
  },
  uc(patch) {
    magasin.room = { ...magasin.room, uc: { ...magasin.room.uc, ...patch } };
    magasin.notifier();
  },
  joueur(id, patch) {
    magasin.players = magasin.players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    magasin.notifier();
  },
  tous(patch) {
    magasin.players = magasin.players.map((p) => ({ ...p, ...patch }));
    magasin.notifier();
  },
};
