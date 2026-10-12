// L'HORLOGE DE LA TUILE.
//
// En lecture (la boucle), rien n'est touché : minuteurs, animations et
// transitions sont ceux du navigateur.
//
// Figée (`?t=<s>`, et le mouvement réduit, figé à l'instant de l'affiche), la
// partie se rejoue sur une horloge VIRTUELLE, avancée à pas de 16 ms aussi vite
// que React suit : setTimeout/setInterval/requestAnimationFrame, Date.now et
// performance.now la lisent ; chaque animation (Web Animations des cartes et des
// jetons, transitions et animations CSS) est mise en pause dès sa naissance et
// placée à `maintenant − naissance`. À l'instant demandé, tout s'arrête : ce
// qui volait reste en plein vol, au bon endroit.
//
// Ce module est importé AVANT React : le planificateur de React retient les
// minuteurs qu'il trouve à son chargement.

const params = new URLSearchParams(location.search);
const brut = params.get('t');
export const REDUIT = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** L'instant demandé (s), ou null en lecture. */
export const DEMANDE: number | null = brut !== null && Number.isFinite(parseFloat(brut)) ? parseFloat(brut) : null;
export const FIGEE = DEMANDE !== null || REDUIT;

export const natif = {
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window),
  setInterval: window.setInterval.bind(window),
  clearInterval: window.clearInterval.bind(window),
  raf: window.requestAnimationFrame.bind(window),
};

type Minuteur = { at: number; fn: (...a: unknown[]) => void; args: unknown[]; tous?: number };
let v = 0;
let suivant = 1;
const minuteurs = new Map<number, Minuteur>();
const images = new Map<number, FrameRequestCallback>();
const suivies = new Map<Animation, number>();
const vues = new WeakSet<Animation>();

if (FIGEE) {
  const dateBase = Date.now();
  const perfBase = performance.now();
  const w = window as unknown as Record<string, unknown>;
  w.setTimeout = (fn: TimerHandler, ms = 0, ...args: unknown[]) => {
    const id = suivant++;
    if (typeof fn === 'function') minuteurs.set(id, { at: v + Math.max(0, Number(ms) || 0), fn: fn as Minuteur['fn'], args });
    return id;
  };
  w.setInterval = (fn: TimerHandler, ms = 0, ...args: unknown[]) => {
    const id = suivant++;
    const tous = Math.max(1, Number(ms) || 0);
    if (typeof fn === 'function') minuteurs.set(id, { at: v + tous, fn: fn as Minuteur['fn'], args, tous });
    return id;
  };
  w.clearTimeout = w.clearInterval = (id?: number) => { if (id !== undefined) minuteurs.delete(id); };
  w.requestAnimationFrame = (fn: FrameRequestCallback) => { const id = suivant++; images.set(id, fn); return id; };
  w.cancelAnimationFrame = (id: number) => { images.delete(id); };
  Date.now = () => Math.round(dateBase + v);
  performance.now = () => perfBase + v;

  // Les Web Animations suivent l'horloge virtuelle.
  const animer = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, k: Keyframe[] | PropertyIndexedKeyframes | null, o?: number | KeyframeAnimationOptions) {
    const a = animer.call(this, k, o);
    suivre(a);
    return a;
  };
}

function suivre(a: Animation) {
  if (vues.has(a)) return;
  vues.add(a);
  a.pause();
  a.currentTime = 0;
  suivies.set(a, v);
}

/** Place chaque animation à son temps virtuel ; termine celles qui sont au bout
 *  (leur promesse `finished` part, comme en vrai). */
function placer() {
  for (const a of document.getAnimations()) if (!vues.has(a)) suivre(a);
  for (const [a, t0] of suivies) {
    if (a.playState === 'idle') { suivies.delete(a); continue; }
    const fin = Number(a.effect?.getComputedTiming().endTime ?? 0);
    const t = v - t0;
    if (Number.isFinite(fin) && t >= fin) {
      suivies.delete(a);
      try { a.finish(); } catch { /* rien */ }
    } else {
      a.currentTime = t;
    }
  }
}

function avancer(jusqua: number) {
  for (;;) {
    let prochain: [number, Minuteur] | null = null;
    for (const e of minuteurs) if (e[1].at <= jusqua && (!prochain || e[1].at < prochain[1].at || (e[1].at === prochain[1].at && e[0] < prochain[0]))) prochain = e;
    if (!prochain) break;
    const [id, m] = prochain;
    v = Math.max(v, m.at);
    if (m.tous) m.at += m.tous; else minuteurs.delete(id);
    try { m.fn(...m.args); } catch (e) { console.error(e); }
  }
  v = jusqua;
  const f = [...images.values()];
  images.clear();
  for (const cb of f) { try { cb(performance.now()); } catch (e) { console.error(e); } }
}

const canal = new MessageChannel();
const enAttente: (() => void)[] = [];
canal.port1.onmessage = () => enAttente.shift()?.();
const ceder = () => new Promise<void>((ok) => { enAttente.push(ok); canal.port2.postMessage(0); });
const image = () => new Promise<void>((ok) => natif.raf(() => ok()));

/** Rejoue jusqu'à `ms` (virtuel), en laissant React suivre à chaque pas. */
export async function figerA(ms: number) {
  while (v < ms) {
    avancer(Math.min(ms, v + 16));
    await ceder();
    await ceder();
    placer();
    if (Math.round(v) % 160 === 0) await image();
  }
  // Les dernières mesures (dock, cadrage) et les dernières animations nées.
  for (let i = 0; i < 4; i++) { await image(); await ceder(); await ceder(); placer(); }
  // Le temps est arrêté : images et minuteurs natifs reviennent (les outils de
  // capture en attendent), sans rien faire avancer — l'horloge ne bouge plus et
  // ce qui était programmé reste suspendu.
  // Les demandes d'image en attente partent aux images natives (le temps figé,
  // elles ne changent rien) : un outil qui sonde la page à chaque image la
  // retrouve.
  for (const cb of images.values()) natif.raf(cb);
  images.clear();
  Object.assign(window, { requestAnimationFrame: natif.raf, setTimeout: natif.setTimeout, clearTimeout: natif.clearTimeout, setInterval: natif.setInterval, clearInterval: natif.clearInterval });
}

export const maintenantVirtuel = () => v;
