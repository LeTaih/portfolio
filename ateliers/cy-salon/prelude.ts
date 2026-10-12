// PREMIER MODULE ÉVALUÉ (avant l'horloge et avant React).
//
// Un localStorage en mémoire : la tuile ne lit ni n'écrit celui de la page qui
// l'héberge. Il est pré-rempli comme chez quelqu'un qui revient : son pseudo
// est mémorisé (lib/playerName) et il est déjà entré dans un salon
// (lib/firstVisit, d'où l'accueil sans le bloc d'explication).
const memoire = new Map<string, string>();
function remplir() {
  memoire.clear();
  memoire.set('soiree_player_name', 'Léa');
  memoire.set('cyrose_room_entered', '1');
}
remplir();
const stockage = {
  getItem: (k: string) => (memoire.has(k) ? (memoire.get(k) as string) : null),
  setItem: (k: string, v: string) => void memoire.set(k, String(v)),
  removeItem: (k: string) => void memoire.delete(k),
  clear: () => memoire.clear(),
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() {
    return memoire.size;
  },
};
Object.defineProperty(window, 'localStorage', { configurable: true, get: () => stockage });
Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => stockage });

export { remplir as remettreStockage };
