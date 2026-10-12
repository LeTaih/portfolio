// LE TEMPS DE LA TUILE.
//
// En lecture normale, rien n'est touché : la partie se joue au vrai temps du
// navigateur. Avec `?t=<s>` (affiche, vérification) ou en mouvement réduit, le
// temps devient VIRTUEL : setTimeout, setInterval, requestAnimationFrame,
// performance.now et Date.now lisent une horloge qu'on avance d'un coup jusqu'à
// l'instant voulu, minuteur par minuteur, en laissant React rendre entre deux.
// Les animations CSS (et les transitions, et le doigt) sont alors suspendues et
// posées à l'instant exact où elles en seraient.
//
// Ce module doit être évalué AVANT React : l'ordonnanceur de React capture
// setTimeout et performance.now à son chargement (cf. entree.tsx, premier import).

const params = new URLSearchParams(location.search);
const brut = params.get('t');
export const REDUIT = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FIGE: number | null = brut !== null ? Math.max(0, parseFloat(brut) || 0) : null;
export const VIRTUEL = FIGE !== null || REDUIT;

const vrai = {
  setTimeout: window.setTimeout.bind(window),
  now: performance.now.bind(performance),
};

type Minuteur = { id: number; a: number; ordre: number; fn: (...a: unknown[]) => void; args: unknown[]; periode: number | null };
let V = 0;
let suivant = 1;
let ordre = 0;
const minuteurs = new Map<number, Minuteur>();

if (VIRTUEL) {
  const DATE0 = Date.parse('2026-10-11T20:00:00.000Z');
  const poser = (fn: unknown, ms: unknown, args: unknown[], periode: boolean): number => {
    const id = suivant++;
    const d = Math.max(0, Number(ms) || 0);
    if (typeof fn === 'function')
      minuteurs.set(id, { id, a: V + d, ordre: ordre++, fn: fn as Minuteur['fn'], args, periode: periode ? Math.max(1, d) : null });
    return id;
  };
  const w = window as unknown as Record<string, unknown>;
  w.setTimeout = (fn: unknown, ms?: unknown, ...args: unknown[]) => poser(fn, ms, args, false);
  w.setInterval = (fn: unknown, ms?: unknown, ...args: unknown[]) => poser(fn, ms, args, true);
  w.clearTimeout = w.clearInterval = (id: number) => void minuteurs.delete(id);
  w.requestAnimationFrame = (fn: (t: number) => void) => poser(() => fn(V), 16, [], false);
  w.cancelAnimationFrame = (id: number) => void minuteurs.delete(id);
  performance.now = () => V;
  Date.now = () => DATE0 + V;
}

/** L'instant courant de l'horloge virtuelle, en ms. */
export const maintenant = () => V;

// Rendre la main au navigateur : React rend dans des tâches MessageChannel.
const canal = new MessageChannel();
const enAttente: Array<() => void> = [];
canal.port1.onmessage = () => enAttente.shift()?.();
const ceder = () =>
  new Promise<void>((r) => {
    enAttente.push(r);
    canal.port2.postMessage(0);
  });
async function laisserRendre() {
  for (let i = 0; i < 3; i++) await ceder();
}

// Le registre des animations : l'instant virtuel où chacune est née.
const nees = new WeakMap<Animation, number>();
function recenser() {
  for (const a of document.getAnimations()) {
    if (!nees.has(a)) {
      nees.set(a, V);
      a.pause();
    }
    a.currentTime = V - (nees.get(a) as number);
  }
}

/** Avance l'horloge virtuelle jusqu'à `cible` (ms), minuteur par minuteur. */
export async function avancerJusqua(cible: number) {
  await laisserRendre();
  recenser();
  for (;;) {
    let m: Minuteur | null = null;
    for (const x of minuteurs.values()) if (!m || x.a < m.a || (x.a === m.a && x.ordre < m.ordre)) m = x;
    if (!m || m.a > cible) break;
    V = m.a;
    if (m.periode !== null) {
      m.a += m.periode;
      m.ordre = ordre++;
    } else minuteurs.delete(m.id);
    try {
      m.fn(...m.args);
    } catch (e) {
      console.error(e);
    }
    await laisserRendre();
    recenser();
  }
  V = cible;
  await laisserRendre();
  recenser();
}

/** Attente qui suit l'horloge de la tuile (réelle ou virtuelle). */
export const attendre = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Une interpolation image par image sur `ms`, f(p) avec p de 0 à 1. */
export function interpoler(ms: number, f: (p: number) => void) {
  return new Promise<void>((r) => {
    const t0 = performance.now();
    const pas = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      f(p);
      if (p < 1) requestAnimationFrame(pas);
      else r();
    };
    pas();
  });
}

export { vrai };
