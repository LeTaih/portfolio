// ateliers/cy-menteur/horloge.ts
// L'HORLOGE DE LA TUILE. Importée AVANT React et la salle : tout ce qui lit
// l'heure (performance.now, Date.now, requestAnimationFrame, setTimeout,
// setInterval) lit une heure VIRTUELLE que la tuile avance elle-même, image
// par image (1/60 s). Les animations CSS et Web Animations sont mises en pause
// à leur naissance et recalées sur cette heure à chaque image.
//
// Ce que ça donne :
//  - une boucle identique à chaque tour (avec le hasard semé, cf. `semer`) ;
//  - `?t=<s>` : on rejoue la partie aussi vite que possible jusqu'à t, puis on
//    cesse d'avancer — tout est figé à l'image près, transitions comprises.

const reel = {
  raf: window.requestAnimationFrame.bind(window),
  maintenant: performance.now.bind(performance),
};

export const IMAGE = 1000 / 60;
const BASE_PERF = 5000;
// Un soir d'octobre, pour les échéances (Date.now) : jamais l'heure réelle.
const BASE_DATE = Date.UTC(2026, 9, 10, 20, 30, 0);

let V = 0;
let prochainId = 1;
interface Minuteur {
  a: number;
  fn: (...a: unknown[]) => void;
  args: unknown[];
  tous: number | null;
}
const minuteurs = new Map<number, Minuteur>();
let images = new Map<number, FrameRequestCallback>();

const w = window as unknown as Record<string, unknown>;
w.setTimeout = (fn: unknown, ms?: number, ...args: unknown[]) => {
  const id = prochainId++;
  if (typeof fn === 'function') minuteurs.set(id, { a: V + Math.max(0, Number(ms) || 0), fn: fn as Minuteur['fn'], args, tous: null });
  return id;
};
w.setInterval = (fn: unknown, ms?: number, ...args: unknown[]) => {
  const id = prochainId++;
  const tous = Math.max(1, Number(ms) || 0);
  if (typeof fn === 'function') minuteurs.set(id, { a: V + tous, fn: fn as Minuteur['fn'], args, tous });
  return id;
};
w.clearTimeout = w.clearInterval = (id: number) => {
  minuteurs.delete(id);
};
w.requestAnimationFrame = (fn: FrameRequestCallback) => {
  const id = prochainId++;
  images.set(id, fn);
  return id;
};
w.cancelAnimationFrame = (id: number) => {
  images.delete(id);
};
performance.now = () => BASE_PERF + V;
Date.now = () => BASE_DATE + V;
// Le téléphone fictif ne vibre pas (et Chrome se plaindrait du geste absent).
try {
  Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: () => true });
} catch {
  /* tant pis */
}
// La tuile ne « se cache » jamais pour la salle : un onglet caché lui ferait
// sauter sa mise en scène (cf. modele.planifier) ; l'horloge, elle, s'arrête.
try {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
} catch {
  /* tant pis */
}

// LE MOUVEMENT RÉDUIT est l'affaire de la tuile, pas de la salle : la tuile
// montre alors une image fixe (l'affiche), qu'elle compose avec la salle en
// mouvement normal. La salle ne voit donc jamais la préférence.
const vraiMatchMedia = window.matchMedia.bind(window);
export const mouvementReduit = vraiMatchMedia('(prefers-reduced-motion: reduce)').matches;
window.matchMedia = (q: string) => vraiMatchMedia(/prefers-reduced-motion:\s*reduce/.test(q) ? 'not all' : q);

// ── Le hasard, semé : la même partie à chaque tour.
let graine = 1;
export function semer(g: number): void {
  graine = g >>> 0;
}
Math.random = () => {
  graine = (graine + 0x6d2b79f5) >>> 0;
  let t = graine;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const temps = () => V;
(window as unknown as { __cyV: () => number }).__cyV = temps;

// ── Les animations du navigateur, recalées sur l'heure virtuelle.
const nees = new WeakMap<Animation, number>();
const finies = new WeakSet<Animation>();
function recalerAnimations(): void {
  for (const a of document.getAnimations()) {
    if (finies.has(a)) continue;
    let t0 = nees.get(a);
    if (t0 === undefined) {
      t0 = V;
      nees.set(a, t0);
      a.pause();
    }
    const fin = a.effect?.getComputedTiming().endTime;
    const ecoule = V - t0;
    if (typeof fin === 'number' && Number.isFinite(fin) && ecoule >= fin) {
      finies.add(a);
      a.finish();
    } else {
      a.currentTime = ecoule;
    }
  }
}

// Un tour de boucle d'événements : le temps pour React de rendre et de lancer
// ses effets entre deux images.
const canal = new MessageChannel();
const enAttente: (() => void)[] = [];
canal.port1.onmessage = () => enAttente.shift()?.();
const tache = () =>
  new Promise<void>((ok) => {
    enAttente.push(ok);
    canal.port2.postMessage(0);
  });
async function microtaches(): Promise<void> {
  for (let k = 0; k < 12; k++) await null;
}

/** Une image : les minuteurs échus (chacun à son heure), les rappels
    d'image, puis les animations. */
export async function avancer(dt = IMAGE): Promise<void> {
  const cible = V + dt;
  for (;;) {
    let id = -1;
    let m: Minuteur | null = null;
    for (const [k, x] of minuteurs) if (x.a <= cible && (!m || x.a < m.a)) [id, m] = [k, x];
    if (!m) break;
    V = Math.max(V, m.a);
    if (m.tous) m.a += m.tous;
    else minuteurs.delete(id);
    try {
      m.fn(...m.args);
    } catch (e) {
      console.error(e);
    }
    await microtaches();
  }
  V = cible;
  const rappels = images;
  images = new Map();
  for (const fn of rappels.values()) {
    try {
      fn(BASE_PERF + V);
    } catch (e) {
      console.error(e);
    }
  }
  await microtaches();
  await tache();
  await tache();
  recalerAnimations();
}

/** Repart de zéro : minuteurs et rappels oubliés, heure à 0. */
export function remettre(): void {
  minuteurs.clear();
  images.clear();
  V = 0;
}

/** Les vraies images de l'écran, pour cadencer la lecture. */
export const imageReelle = reel.raf;
export const heureReelle = reel.maintenant;
export const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
