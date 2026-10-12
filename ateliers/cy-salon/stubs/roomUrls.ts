// STUB de web/src/screens/shared/roomUrls.ts — l'URL de partage (et donc le QR
// code) est celle de la production, pas celle de la page qui héberge la tuile.
export function roomUrls(code: string): { joinUrl: string; displayUrl: string } {
  return { joinUrl: `https://cyrose.fr/${code}`, displayUrl: `cyrose.fr/${code}` };
}
