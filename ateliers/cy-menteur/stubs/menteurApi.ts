// Aucun appel réseau dans la tuile : la salle reçoit toujours une `api`
// injectée (comme au banc /labo-menteur). Ces fonctions ne sont jamais appelées.
const refus = () => Promise.reject(new Error('hors-ligne'));
export const menteurDemarrer = refus;
export const menteurMaMain = refus;
export const menteurJouer = refus;
export const menteurAccuser = refus;
export const menteurPasser = refus;
export const menteurPresser = refus;
export const menteurContinuer = refus;
export const menteurPresent = refus;
export const menteurAuSalon = refus;
export const menteurAbandonner = refus;
