// ateliers/cy-navale/horloge.ts
// L'HORLOGE VIRTUELLE de la tuile. Importée AVANT tout le reste (React compris) :
// elle remplace setTimeout, setInterval, requestAnimationFrame, performance.now
// et Date.now par un temps que la tuile fait avancer elle-même.
//
// POURQUOI. Une tuile doit pouvoir se figer à n'importe quel instant (`?t=`)
// et rejouer exactement la même partie à chaque boucle. Les vrais composants
// vivent de minuteries (la loupe tient 1,9 à 3,4 s), d'animations Web
// (`element.animate`), de transitions CSS et d'un canvas en rAF : en pilotant
// ces quatre horloges depuis une seule, la lecture en temps réel et l'avance
// rapide de `?t=` passent par le même chemin et donnent la même image.
//
// LES ANIMATIONS (CSS et Web Animations) sont mises en pause dès qu'elles
// naissent, puis leur `currentTime` suit le temps virtuel. Arrivées au bout,
// elles sont terminées par `finish()` : leurs promesses `finished` se
// résolvent comme d'habitude (la loupe, le résumé et l'éclosion en dépendent).

const natif = {
  setTimeout: window.setTimeout.bind(window),
  rAF: window.requestAnimationFrame.bind(window),
};

/** Le temps virtuel, en ms depuis le chargement. Ne recule jamais. */
let vnow = 0;
/** Un soir d'octobre, figé : `Date.now()` ne dépend plus de l'heure réelle. */
const EPOQUE = Date.UTC(2026, 9, 11, 20, 30, 0);

interface Minuterie { at: number; fn: (...a: unknown[]) => void; args: unknown[]; every: number | null; seq: number }
const minuteries = new Map<number, Minuterie>();
const images = new Map<number, FrameRequestCallback>();
let prochainId = 1;
let seq = 0;

function programmer(fn: unknown, d: unknown, args: unknown[], every: boolean): number {
  const id = prochainId++;
  if (typeof fn !== 'function') return id;
  const delai = Math.max(0, Number(d) || 0);
  minuteries.set(id, { at: vnow + delai, fn: fn as Minuterie['fn'], args, every: every ? Math.max(4, delai) : null, seq: seq++ });
  return id;
}

const w = window as unknown as Record<string, unknown>;
w.setTimeout = (fn: unknown, d?: unknown, ...args: unknown[]) => programmer(fn, d, args, false);
w.setInterval = (fn: unknown, d?: unknown, ...args: unknown[]) => programmer(fn, d, args, true);
w.clearTimeout = w.clearInterval = (id: number) => { minuteries.delete(id); };
w.requestAnimationFrame = (fn: FrameRequestCallback) => { const id = prochainId++; images.set(id, fn); return id; };
w.cancelAnimationFrame = (id: number) => { images.delete(id); };
performance.now = () => vnow;
Date.now = () => EPOQUE + vnow;

/** Une vraie tâche : les microtâches et le travail de React (MessageChannel)
    passent avant qu'on reprenne. */
const canal = new MessageChannel();
const enAttente: (() => void)[] = [];
canal.port1.onmessage = () => { enAttente.shift()?.(); };
export const tache = () => new Promise<void>((ok) => { enAttente.push(ok); canal.port2.postMessage(0); });
export const imageNative = () => new Promise<number>((ok) => natif.rAF(ok));
export const attenteNative = (ms: number) => new Promise<void>((ok) => natif.setTimeout(ok, ms));

// ── Les animations ─────────────────────────────────────────────────────────
const debuts = new WeakMap<Animation, number>();
const finies = new WeakSet<Animation>();

export function piloterAnimations() {
  for (const a of document.getAnimations()) {
    if (a.timeline !== document.timeline || finies.has(a)) continue;
    let debut = debuts.get(a);
    if (debut === undefined) {
      debut = vnow;
      debuts.set(a, debut);
      a.pause();
    }
    const t = (vnow - debut) * (a.playbackRate || 1);
    const fin = Number(a.effect?.getComputedTiming().endTime);
    if (Number.isFinite(fin) && t >= fin) {
      finies.add(a);
      try { a.finish(); } catch { a.currentTime = fin; }
    } else {
      a.currentTime = t;
    }
  }
}

/** Fait avancer le temps virtuel jusqu'à `cible`, minuterie par minuterie,
    puis joue une image (les rAF) à cet instant. */
export async function avancer(cible: number) {
  for (;;) {
    let m: [number, Minuterie] | null = null;
    for (const e of minuteries) {
      if (e[1].at > cible) continue;
      if (!m || e[1].at < m[1].at || (e[1].at === m[1].at && e[1].seq < m[1].seq)) m = e;
    }
    if (!m) break;
    const [id, t] = m;
    vnow = Math.max(vnow, t.at);
    if (t.every !== null) { t.at = vnow + t.every; t.seq = seq++; } else minuteries.delete(id);
    try { t.fn(...t.args); } catch (e) { console.error(e); }
    await tache();
    piloterAnimations();
  }
  vnow = Math.max(vnow, cible);
  await jouerImage();
}

/** Les rAF en attente, à l'instant présent (sans avancer le temps). */
export async function jouerImage() {
  const l = [...images.values()];
  images.clear();
  for (const f of l) { try { f(vnow); } catch (e) { console.error(e); } }
  await tache();
  piloterAnimations();
}

export const maintenant = () => vnow;

/** Une attente en temps virtuel, pour le script de la partie. */
export const attendre = (ms: number) => new Promise<void>((ok) => { programmer(ok, ms, [], false); });

/** Oublie toutes les minuteries et images en attente (fin de boucle). */
export function purger() {
  minuteries.clear();
  images.clear();
}
