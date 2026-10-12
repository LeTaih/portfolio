// La tuile « Purple » : la VRAIE table de Purple (screens/purple/PurpleTable,
// lib/purple/reducer) montée sur un état en mémoire, jouée par un doigt fictif.
//
// TOUT EST PILOTÉ PAR UNE HORLOGE VIRTUELLE `V` (ms) :
//   - les minuteurs de la table (`window.setTimeout` : fin du retournement,
//     verrou de l'écran raté) sont reportés sur V ;
//   - chaque animation / transition CSS est mise en pause dès qu'elle naît et
//     son `currentTime` est recalculé depuis V à chaque image ;
//   - les gestes (clics réels sur les vrais boutons) sont des événements datés.
// Résultat : la lecture en temps réel et `?t=<s>` donnent exactement la même
// image au même instant, et un onglet caché fige la scène au lieu de la
// désynchroniser.
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import PurpleTable from '@cy/screens/purple/PurpleTable';
import { DEFAULT_CONFIG } from '@cy/lib/purple/reducer';
import { createDeck } from '@cy/lib/purple/deck';
import { shuffle } from '@cy/lib/shuffle';
import type { Card, PurpleState } from '@cy/lib/purple/types';
import type { Player, Room } from '@cy/lib/types';

// ------------------------------------------------------------------ horloge
let V = 0; // ms
const vraiSetTimeout = window.setTimeout.bind(window);
interface Minuteur { id: number; due: number; cb: (...a: unknown[]) => void; args: unknown[] }
let minuteurs: Minuteur[] = [];
let prochainId = 1;
// React (scheduler, react-dom) a déjà capturé le vrai setTimeout à son
// initialisation : seul le code de l'appli passe par celui-ci.
window.setTimeout = ((cb: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
  const id = prochainId++;
  minuteurs.push({ id, due: V + Math.max(0, Number(ms) || 0), cb, args });
  return id;
}) as typeof window.setTimeout;
window.clearTimeout = ((id?: number) => {
  minuteurs = minuteurs.filter((m) => m.id !== id);
}) as typeof window.clearTimeout;

const debuts = new WeakMap<Animation, number>();
function enregistrer() {
  for (const a of document.getAnimations()) {
    if (!debuts.has(a)) {
      debuts.set(a, V);
      a.pause();
    }
  }
}
function appliquer() {
  for (const a of document.getAnimations()) {
    if (!debuts.has(a)) {
      debuts.set(a, V);
      a.pause();
    }
    a.currentTime = V - (debuts.get(a) as number);
  }
}

// ------------------------------------------------------------------ la tablée
const DATE = '2026-10-11T20:00:00.000Z';
const NOMS = ['Léa', 'Marc', 'Inès', 'Hugo'];
const COULEURS = ['#ff1e8c', '#34e0f0', '#e6ff3d', '#b388ff'];
const JOUEURS = NOMS.map((name, i) => ({
  id: `p${i}`, room_code: 'tuile', name, is_host: i === 0, can_control: i === 0,
  color: COULEURS[i], joined_at: DATE, is_fictional: false, sobre: false,
})) as unknown as Player[];
const MOI = JOUEURS[0];

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });
// La main en cours : une carte héritée, deux gagnées (refilable dans 1 carte).
const PILE = [c(3, 'clubs'), c(11, 'diamonds'), c(5, 'spades')];
const DEFAUSSE = [c(2, 'hearts'), c(12, 'clubs'), c(10, 'spades'), c(8, 'clubs'), c(6, 'diamonds')];
// Le dessus du paquet, dans l'ordre des tirages du scénario :
// Haut + sur le 5♠ → 9♥ (gagné) ; Purple → R♠ + 4♥ (gagné) ;
// Noir → 7♦ (raté, bois 7) ; Rouge → D♥ (gagné, on repart à 1).
const TIRAGES = [c(9, 'hearts'), c(13, 'spades'), c(4, 'hearts'), c(7, 'diamonds'), c(12, 'hearts')];

function graine(s: number): () => number {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}
const meme = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit && !!a.joker === !!b.joker;

function etatInitial(): PurpleState {
  const pris = [...PILE, ...DEFAUSSE, ...TIRAGES];
  const reste = shuffle(createDeck(true).filter((x) => !pris.some((y) => meme(x, y))), graine(7));
  return {
    phase: 'playing',
    deck: [...TIRAGES, ...reste],
    pile: PILE,
    discard: DEFAUSSE,
    drawnSincePass: 2,
    // Tirage honnête (rigWin 0) : la carte tirée est exactement le dessus du
    // paquet, donc le scénario est le même à chaque boucle.
    config: { ...DEFAULT_CONFIG, rigWin: 0 },
    controllerId: MOI.id,
    lastResult: null,
    pendingClear: false,
    awaitingPickup: false,
  };
}

const SALON = {
  code: 'tuile', alias: null, host_id: MOI.id, current_question: null, state: 'playing',
  stats: null, sips_min: 1, sips_max: 6, game: 'purple', uc: null, purple: null, cliche: null,
  ckk: null, pyra: null, roulette: null, poker: null, navale: null, menteur: null,
  blackjack: null, casino: null, updated_at: DATE,
} as unknown as Room;

let etat = etatInitial();
let rendre: () => void = () => {};

function Table() {
  return (
    <PurpleTable
      room={{ ...SALON, purple: etat }}
      purple={etat}
      players={JOUEURS}
      me={MOI}
      isHost
      applyRoom={() => {}}
      ecrire={(next) => {
        etat = next;
        rendre();
      }}
    />
  );
}

// ------------------------------------------------------------------ la scène
const scene = document.getElementById('cy-stage') as HTMLElement;
const hote = document.getElementById('cy-host') as HTMLElement;
const doigt = document.getElementById('cy-finger') as HTMLElement;
const onde = document.getElementById('cy-ripple') as HTMLElement;
let racine: Root | null = null;

function monter() {
  racine?.unmount();
  minuteurs = [];
  etat = etatInitial();
  hote.innerHTML = '<div id="root"><main></main></div>';
  const r = createRoot(hote.querySelector('main') as HTMLElement);
  racine = r;
  rendre = () => flushSync(() => r.render(<Table />));
  rendre();
  enregistrer();
}

function ajuster() {
  const s = (document.documentElement.clientWidth || 390) / 390;
  scene.style.transform = `scale(${s})`;
  document.body.style.height = `${Math.round(844 * s)}px`;
}
ajuster();
addEventListener('resize', ajuster);

// ------------------------------------------------------------------ scénario
// Les gestes : le doigt se pose sur une cible, appuie, relâche (le clic part au
// relâché, comme un vrai tap). Temps en secondes. `nouveau` : le doigt se lève
// avant ce geste (il disparaît après le précédent et réapparaît sur la cible) ;
// sinon il glisse de la cible précédente à celle-ci.
interface Geste { cible: () => Element | null; appui: number; nouveau?: boolean; dx?: number; dy?: number }
const bouton = (texte: string) => () =>
  [...hote.querySelectorAll('.pa-b')].find((b) => b.textContent?.trim() === texte) ?? null;
const GESTES: Geste[] = [
  { cible: bouton('Haut +'), appui: 1.05, nouveau: true },
  { cible: bouton('Purple'), appui: 3.35 },
  { cible: bouton('Noir'), appui: 6.3 },
  // « Touche pour continuer » : un tap sur l'écran raté, une fois armé.
  { cible: () => hote.querySelector('.pa-carte'), appui: 8.75, nouveau: true, dx: 0.1, dy: -0.05 },
  { cible: bouton('Rouge'), appui: 10.25 },
];
const APPUI = 0.12; // durée du doigt posé avant le clic
const ARRIVEE = 0.5; // durée du trajet d'une cible à l'autre
const FONDU_SORTIE = 12.55;
const DUREE = 13.1;

interface Evenement { t: number; faire: () => void }
// Le clic part au relâché, sur le vrai bouton. Le tap de l'écran raté vise le
// calque plein écran `.pa-rate-touche` (désarmé pendant DRINK_LOCK_MS).
const EVENEMENTS: Evenement[] = GESTES.map((g, i) => ({
  t: (g.appui + APPUI) * 1000,
  faire: () => {
    const el = (i === 3 ? hote.querySelector('.pa-rate-touche') : g.cible()) as HTMLButtonElement | null;
    if (el && !el.disabled) flushSync(() => el.click());
  },
}));
let prochainEvt = 0;

// Positions des cibles, relevées dans la scène (390×844), une fois montées.
const positions = new Map<number, [number, number]>();
function position(i: number): [number, number] {
  const deja = positions.get(i);
  if (deja) return deja;
  const g = GESTES[i];
  const el = g.cible();
  if (!el) return [195, 600];
  const r = el.getBoundingClientRect();
  const s = scene.getBoundingClientRect();
  const k = s.width / 390;
  const p: [number, number] = [
    (r.left - s.left) / k + (r.width / k) * (0.5 + (g.dx ?? 0)),
    (r.top - s.top) / k + (r.height / k) * (0.5 + (g.dy ?? 0)),
  ];
  positions.set(i, p);
  return p;
}

const enDouceur = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const sortie = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const seg = (t: number, a: number, b: number, f = sortie) => (t <= a ? 0 : t >= b ? 1 : f((t - a) / (b - a)));

// Le doigt se lève après le geste k si le suivant est `nouveau` (ou s'il n'y en a plus).
const seLeve = (k: number) => k === GESTES.length - 1 || !!GESTES[k + 1].nouveau;
const finDe = (k: number) => GESTES[k].appui + APPUI + (seLeve(k) ? 0.6 : 0.35);

function dessinerDoigt(t: number) {
  // Le geste en cours ou le prochain.
  let i = GESTES.findIndex((_, k) => t < finDe(k));
  if (i < 0) i = GESTES.length - 1;
  const g = GESTES[i];
  const [x1, y1] = position(i);
  let x = x1;
  let y = y1;
  if (i > 0 && !g.nouveau) {
    const [x0, y0] = position(i - 1);
    const depart = g.appui - 0.3 - ARRIVEE;
    const p = seg(t, depart, depart + ARRIVEE, enDouceur);
    x = x0 + (x1 - x0) * p;
    y = y0 + (y1 - y0) * p;
  }
  const entree = g.nouveau ? seg(t, g.appui - 0.55, g.appui - 0.25) : 1;
  const leve = seLeve(i) ? seg(t, g.appui + APPUI + 0.3, g.appui + APPUI + 0.56) : 0;
  const visible = (g.nouveau ? seg(t, g.appui - 0.55, g.appui - 0.29) : 1) * (1 - leve);
  const pose = t >= g.appui && t < g.appui + APPUI + 0.06 ? 1 : 0;
  const echelle = (1.25 - 0.25 * entree) * (pose ? 0.8 : 1) * (1 + 0.15 * leve);
  doigt.style.opacity = visible.toFixed(3);
  doigt.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${echelle.toFixed(3)})`;
  // L'onde du tap, au relâché.
  const r = (t - (g.appui + APPUI)) / 0.52;
  if (r >= 0 && r <= 1) {
    onde.style.opacity = (0.9 * (1 - sortie(r)) * visible).toFixed(3);
    onde.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(0.9 + sortie(r)).toFixed(3)})`;
  } else onde.style.opacity = '0';
  // L'appui sur le vrai bouton (:active, rejoué par une classe).
  for (const b of hote.querySelectorAll('.cy-press')) b.classList.remove('cy-press');
  if (pose) g.cible()?.classList.add('cy-press');
}

function dessinerFondu(t: number) {
  const o = seg(t, 0, 0.45) * (1 - seg(t, FONDU_SORTIE, DUREE - 0.05));
  hote.style.opacity = o.toFixed(3);
}

// Avance l'horloge jusqu'à `cible` (ms) : minuteurs et gestes dans l'ordre.
function avancer(cible: number) {
  for (;;) {
    const m = minuteurs.reduce<Minuteur | null>((a, b) => (a && a.due <= b.due ? a : b), null);
    const e = EVENEMENTS[prochainEvt];
    const tm = m && m.due <= cible ? m.due : Infinity;
    const te = e && e.t <= cible ? e.t : Infinity;
    if (tm === Infinity && te === Infinity) break;
    if (te <= tm) {
      V = Math.max(V, te);
      prochainEvt++;
      e.faire();
    } else if (m) {
      V = Math.max(V, tm);
      minuteurs = minuteurs.filter((x) => x !== m);
      flushSync(() => m.cb(...m.args));
    }
    enregistrer();
  }
  V = cible;
  appliquer();
  const t = V / 1000;
  dessinerDoigt(t);
  dessinerFondu(t);
}

function aller(s: number) {
  const cible = Math.max(0, s) * 1000;
  if (cible < V || !racine) {
    V = 0;
    prochainEvt = 0;
    monter();
  }
  avancer(cible);
}
(window as unknown as { __cyAller: (s: number) => void }).__cyAller = aller;

// ------------------------------------------------------------------ lecture
const params = new URLSearchParams(location.search);
const fige = params.get('t');
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
// L'état fixe du mouvement réduit : le 9♥ gagné, le sticker « Refiler les 4 ».
const AFFICHE_FIXE = 3.0;

if (fige !== null) {
  aller(Math.min(DUREE - 0.001, parseFloat(fige) || 0));
} else if (reduit) {
  aller(AFFICHE_FIXE);
  doigt.style.display = 'none';
  onde.style.display = 'none';
} else {
  aller(0);
  const pret = document.fonts?.ready ?? Promise.resolve();
  Promise.race([pret, new Promise((ok) => vraiSetTimeout(ok, 2500))]).then(() => {
    let avant: number | null = null;
    const image = (maintenant: number) => {
      // Pas plus de 64 ms par image : un onglet caché fige la scène.
      const dt = avant === null ? 0 : Math.min(64, maintenant - avant);
      avant = maintenant;
      let cible = V + dt;
      if (cible >= DUREE * 1000) {
        V = 0;
        prochainEvt = 0;
        monter();
        cible = 0;
      }
      avancer(cible);
      requestAnimationFrame(image);
    };
    requestAnimationFrame(image);
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => {
    if (e.matches) location.reload();
  });
}
