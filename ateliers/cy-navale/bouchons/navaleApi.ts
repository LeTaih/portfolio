// Bouchon de web/src/lib/navaleApi.ts : la tuile ne parle à aucun serveur.
// Chaque appel répond « rien à signaler », sans requête.
const rien = <T>(v: T) => Promise.resolve(v);
export const navaleDemarrer = (_c: string) => rien({ ok: true as const });
export const navalePlacer = (_c: string, _f: unknown) => rien({ ok: true as const });
export const navaleMaFlotte = (_c: string) => rien({ flotte: null, esquiveArmee: false });
export const navaleFlottesFin = (_c: string) => rien({ flottes: {} });
export const navaleTirer = (_c: string, _i: number) => rien({ ok: true as const });
export const navaleAuSalon = (_c: string) => rien({ ok: true as const });
export const navalePresent = (_c: string) => rien({ ok: true as const });
export const navalePasser = (_c: string) => rien({ ok: true as const });
export const navaleAbandonner = (_c: string, _id: string) => rien({ ok: true as const });
