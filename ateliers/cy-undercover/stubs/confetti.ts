// canvas-confetti — la vraie bibliothèque, mêmes appels que UcEnded, mais tirée
// dans une toile posée DANS le téléphone (#cy-confetti) : elle suit l'échelle de
// la tuile et son fondu de reprise. Rien quand la tuile est figée (?t=, mouvement
// réduit) : une pluie de confettis n'a pas d'instant fixe.
import vraie from 'canvas-confetti/dist/confetti.module.mjs';

let tir: any = null;
export default function confetti(opts: any) {
  if ((window as any).__cyFige) return null;
  if (!tir) {
    const toile = document.getElementById('cy-confetti') as HTMLCanvasElement | null;
    if (!toile) return null;
    tir = vraie.create(toile, { resize: true, useWorker: false });
  }
  return tir(opts);
}
// À chaque reprise la toile est refaite : on oublie l'ancienne.
export function viderConfettis() {
  tir?.reset();
  tir = null;
}
