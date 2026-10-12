// ?t=<secondes> : LA TUILE FIGÉE À CET INSTANT.
//
// La table est pilotée par le temps (minuteurs du script et de l'appli, animations
// WAAPI des vols de cartes et de jetons, transitions CSS). On remplace donc
// l'horloge par une horloge VIRTUELLE, qu'on fait avancer d'un coup jusqu'à t :
// chaque minuteur part à son heure virtuelle, et chaque animation du document est
// mise en pause à l'âge qu'elle aurait à cet instant. Entre deux minuteurs, on
// rend la main au navigateur (MessageChannel) pour que React rende et que les
// promesses se règlent. Arrivée à t, plus rien ne bouge.
//
// Ce module s'importe EN PREMIER (avant React et l'appli) : il doit être en place
// avant le premier rendu.
type Minuteur = { at: number; fn: (...a: unknown[]) => void; args: unknown[]; tous?: number; ordre: number };

const params = new URLSearchParams(location.search);
const brut = params.get('t');
export const instantFige: number | null = brut !== null && brut !== '' && Number.isFinite(Number(brut)) ? Math.max(0, Number(brut)) : null;

let vt = 0;
let suivant = 1;
const minuteurs = new Map<number, Minuteur>();
const vues = new WeakMap<Animation, number>();

const vraiPerfNow = performance.now.bind(performance);
const base = vraiPerfNow();
const baseDate = Date.now();
const canal = new MessageChannel();
const enAttente: (() => void)[] = [];
canal.port1.onmessage = () => enAttente.shift()?.();
const rendreLaMain = () => new Promise<void>((r) => { enAttente.push(r); canal.port2.postMessage(0); });
const vraiRaf = requestAnimationFrame.bind(window);
const vraiSetInterval = setInterval.bind(window);
const uneImage = () => new Promise<void>((r) => vraiRaf(() => r()));

if (instantFige !== null) {
  const w = window as unknown as Record<string, unknown>;
  const poser = (fn: (...a: unknown[]) => void, ms: unknown, args: unknown[], tous?: number) => {
    const id = suivant++;
    const d = Math.max(0, Number(ms) || 0);
    minuteurs.set(id, { at: vt + d, fn, args, tous: tous === undefined ? undefined : Math.max(1, d), ordre: id });
    return id;
  };
  w.setTimeout = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => poser(fn, ms, args);
  w.setInterval = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => poser(fn, ms, args, Number(ms) || 0);
  w.clearTimeout = w.clearInterval = (id: number) => { minuteurs.delete(id); };
  w.requestAnimationFrame = (fn: (t: number) => void) => poser(() => fn(base + vt), 16, []);
  w.cancelAnimationFrame = (id: number) => { minuteurs.delete(id); };
  performance.now = () => base + vt;
  Date.now = () => baseDate + vt;
}

(window as unknown as Record<string, unknown>).__cyHorloge = () => ({ vt, minuteurs: [...minuteurs.values()].map((m) => Math.round(m.at) + (m.tous ? '/' + m.tous : '')) });

/** Chaque animation du document (WAAPI, transitions et animations CSS) prend
 *  l'âge qu'elle a à l'heure virtuelle : en pause à ce point, ou finie. */
function caler() {
  for (const a of document.getAnimations()) {
    if (!vues.has(a)) vues.set(a, vt);
    const age = vt - (vues.get(a) ?? vt);
    const fin = Number(a.effect?.getComputedTiming().endTime ?? Infinity);
    try {
      if (Number.isFinite(fin) && age >= fin) a.finish();
      else { a.pause(); a.currentTime = age; }
    } catch { /* animation déjà retirée */ }
  }
}

/** Avance l'horloge virtuelle jusqu'à `ms`, minuteur par minuteur. */
export async function avancerJusqua(ms: number) {
  let derniereImage = 0;
  for (;;) {
    await rendreLaMain();
    await rendreLaMain();
    caler();
    // De temps en temps une vraie image : les ResizeObserver (hauteur du dock,
    // cadrage de la table) ne se déclenchent qu'au rendu.
    if (vt - derniereImage >= 100) { derniereImage = vt; await uneImage(); caler(); }
    let prochain: [number, Minuteur] | null = null;
    for (const e of minuteurs) {
      if (!prochain || e[1].at < prochain[1].at || (e[1].at === prochain[1].at && e[1].ordre < prochain[1].ordre)) prochain = e;
    }
    if (!prochain || prochain[1].at > ms) break;
    const [id, m] = prochain;
    vt = m.at;
    if (m.tous) { m.at += m.tous; m.ordre = suivant++; } else minuteurs.delete(id);
    try { m.fn(...m.args); } catch (e) { console.error(e); }
  }
  vt = ms;
  for (let i = 0; i < 3; i++) { await rendreLaMain(); await uneImage(); caler(); }
  // Le temps est arrêté : ce qui démarrerait encore (un ResizeObserver tardif)
  // reste à sa première image.
  vraiSetInterval(caler, 150);
}
