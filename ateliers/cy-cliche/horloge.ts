// L'HORLOGE DE LA TUILE. Évaluée AVANT React et l'appli (premier import de
// tuile.tsx) : setTimeout, setInterval, requestAnimationFrame, performance.now
// et Date.now passent sur un temps virtuel.
//
// - En lecture, le temps virtuel suit le temps réel image par image (un écart
//   de plus de 50 ms — onglet caché, iframe hors écran — est absorbé : la
//   partie reprend là où elle en était au lieu de sauter).
// - Avec `?t=<s>` (et en mouvement réduit), on déroule la partie aussi vite
//   que possible jusqu'à l'instant voulu, puis on s'arrête : la tuile est figée
//   exactement là où la lecture l'aurait montrée. Pendant ce déroulé, les
//   transitions et animations CSS sont coupées (elles tournent en temps réel)
//   et l'image figée montre donc leur état d'arrivée.
type Fn = (...a: unknown[]) => void;
interface Minuterie { id: number; at: number; fn: Fn; args: unknown[]; every: number }

const vrai = {
  setTimeout: window.setTimeout.bind(window),
  setInterval: window.setInterval.bind(window),
  clearInterval: window.clearInterval.bind(window),
  raf: window.requestAnimationFrame.bind(window),
  perf: performance.now.bind(performance),
  date: Date.now,
};
// Les vraies horloges restent accessibles aux outils de l'atelier (élagage, vérification).
(window as unknown as Record<string, unknown>).__cyVrai = vrai;
const EPOQUE = Date.UTC(2026, 9, 10, 20, 30, 0); // un samedi soir
let maintenant = 0;
let seq = 1;
const minuteries = new Map<number, Minuterie>();
const images = new Map<number, FrameRequestCallback>();

function poser(fn: Fn, ms: unknown, args: unknown[], every: boolean): number {
  const id = seq++;
  // Comme un navigateur, jamais « tout de suite » : un délai nul vaut 1 ms
  // virtuelle (une boucle de setTimeout(0) avance donc le temps au lieu de
  // tourner sur place).
  const d = Math.max(1, Number(ms) || 0);
  minuteries.set(id, { id, at: maintenant + d, fn: typeof fn === 'function' ? fn : () => {}, args, every: every ? Math.max(4, d) : 0 });
  return id;
}
const w = window as unknown as Record<string, unknown>;
w.setTimeout = (fn: Fn, ms?: number, ...args: unknown[]) => poser(fn, ms, args, false);
w.setInterval = (fn: Fn, ms?: number, ...args: unknown[]) => poser(fn, ms, args, true);
w.clearTimeout = w.clearInterval = (id?: number) => { if (id != null) minuteries.delete(id); };
w.requestAnimationFrame = (fn: FrameRequestCallback) => { const id = seq++; images.set(id, fn); return id; };
w.cancelAnimationFrame = (id: number) => { images.delete(id); };
performance.now = () => maintenant;
Date.now = () => EPOQUE + maintenant;

/** Fait avancer le temps virtuel jusqu'à `cible`, minuterie par minuterie. */
function avancerJusqua(cible: number) {
  for (let garde = 0; garde < 20000; garde++) {
    let prochaine: Minuterie | null = null;
    for (const m of minuteries.values()) if (m.at <= cible && (!prochaine || m.at < prochaine.at || (m.at === prochaine.at && m.id < prochaine.id))) prochaine = m;
    if (!prochaine) break;
    maintenant = Math.max(maintenant, prochaine.at);
    if (prochaine.every) prochaine.at += prochaine.every;
    else minuteries.delete(prochaine.id);
    try { prochaine.fn(...prochaine.args); } catch (e) { console.error(e); }
  }
  maintenant = Math.max(maintenant, cible);
}
function image() {
  const lot = [...images.values()];
  images.clear();
  for (const f of lot) { try { f(maintenant); } catch (e) { console.error(e); } }
}

/** Lecture : le temps virtuel suit l'horloge réelle. */
export function lire() {
  let avant = vrai.perf();
  const pas = () => {
    const t = vrai.perf();
    const dt = Math.min(50, t - avant);
    avant = t;
    avancerJusqua(maintenant + dt);
    image();
    vrai.raf(pas);
  };
  vrai.raf(pas);
}

// Une vraie tâche : laisse React rendre et passer ses effets.
const canal = new MessageChannel();
const enAttente: (() => void)[] = [];
canal.port1.onmessage = () => enAttente.shift()?.();
const tache = () => new Promise<void>((ok) => { enAttente.push(ok); canal.port2.postMessage(0); });

/** Déroule jusqu'à `ms` virtuelles par pas de 16 ms, puis fige. */
export async function derouler(ms: number) {
  const coupe = document.createElement('style');
  coupe.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
  document.head.appendChild(coupe);
  while (maintenant < ms) {
    avancerJusqua(Math.min(ms, maintenant + 16));
    image();
    await tache();
    await tache();
  }
  await tache();
  await tache();
}

export const tempsVirtuel = () => maintenant;
export const vraiSetTimeout = vrai.setTimeout;
