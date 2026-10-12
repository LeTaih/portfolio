// La tuile est muette : le son de la salle (lib/sound) devient un objet qui
// accepte tous les appels et ne joue rien.
const rien = () => {};
export const sonSalle: Record<string, any> = new Proxy({} as Record<string, any>, {
  get: (cible, cle) => (cle in cible ? cible[cle as string] : rien),
  set: (cible, cle, v) => ((cible[cle as string] = v), true),
});
export const preloadMenteurSamples = rien;
export const playVictory = rien;
