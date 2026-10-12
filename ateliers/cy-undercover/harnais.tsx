// LA TUILE UNDERCOVER : le vrai écran de jeu de cyrose.fr (screens/uc/Undercover),
// monté sur un faux serveur en mémoire et joué par un script horodaté. Tout ce
// qu'on voit — barre, titres, boutons, minuteur, tableau des rôles, confettis —
// est le code de l'appli ; le script ne fait que poser l'état du salon à l'heure
// dite et taper sur les boutons, comme les cinq téléphones d'une vraie partie.
//
// L'état est une fonction du temps : `?t=<s>` rejoue le script jusqu'à t puis fige.
import { useLayoutEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Undercover from '@cy/screens/uc/Undercover';
import { magasin } from './magasin';
import { TABLE } from './stubs/ucApi';
import { viderConfettis } from './stubs/confetti';

type Any = any;
const W = 390;
const H = 844;
const DUREE = 15;

// ─── Le téléphone : un repère 390 × 844 mis à l'échelle de l'iframe ───
const scene = document.getElementById('cy-stage')!;
const hote = document.getElementById('cy-host')!;
const doigt = document.getElementById('cy-finger')!;
const onde = doigt.firstElementChild as HTMLElement;
let echelle = 1;
function ajuster() {
  const w = document.documentElement.clientWidth || W;
  echelle = w / W;
  scene.style.transform = `scale(${echelle})`;
  document.body.style.height = `${Math.round(H * echelle)}px`;
}
ajuster();
addEventListener('resize', ajuster);
// L'appli (et la toile des confettis) mesure ce qu'elle dessine : elle doit voir
// le téléphone, pas l'iframe.
Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => W });
Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => H });
const rectOrig = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const r = rectOrig.call(this);
  if (this === scene || !scene.contains(this)) return r;
  const s = rectOrig.call(scene);
  return new DOMRect((r.left - s.left) / echelle, (r.top - s.top) / echelle, r.width / echelle, r.height / echelle);
};

// ─── L'horloge : Date.now() suit le temps de la tuile (minuteur du vote) ───
const EPOQUE = Date.UTC(2026, 9, 11, 20, 0, 0);
let tv = 0; // secondes depuis le début de la boucle
Date.now = () => EPOQUE + Math.round(tv * 1000);

// ─── La tablée : Léa tient le téléphone, Marc est l'hôte et donne le mot ───
const MOI = 'p-lea';
const JOUEURS = [
  { id: 'p-lea', name: 'Léa', color: '#ff1e8c' },
  { id: 'p-marc', name: 'Marc', color: '#34e0f0' },
  { id: 'p-ines', name: 'Inès', color: '#e6ff3d' },
  { id: 'p-hugo', name: 'Hugo', color: '#b388ff' },
  { id: 'p-sam', name: 'Sam', color: '#ffb627' },
];
const PAIRE = { civil: 'Whisky', under: 'Rhum' };
TABLE.splice(0, TABLE.length, ...JOUEURS.map((j) => ({
  player_id: j.id,
  role: (j.id === 'p-ines' ? 'undercover' : 'civil') as 'civil' | 'undercover',
  word: j.id === 'p-ines' ? PAIRE.under : PAIRE.civil,
})));

function partieNeuve() {
  magasin.room = {
    code: 'tuile', alias: null, host_id: 'p-marc', current_question: null, state: 'playing', stats: null,
    game: 'undercover', updated_at: '2026-10-11T20:00:00.000Z',
    uc: {
      phase: 'words', round: 1, donneurId: 'p-marc', config: { undercoverCount: 1, mrWhite: false },
      lastEliminated: null, winner: null, pair: null,
    },
  };
  magasin.players = JOUEURS.map((j) => ({
    ...j, room_code: 'tuile', is_host: j.id === 'p-marc', can_control: j.id === 'p-marc',
    joined_at: '2026-10-11T20:00:00.000Z', is_fictional: false, sobre: false,
    uc_eliminated: false, uc_ready: false, uc_vote: null,
  }));
}

function Tuile() {
  const [, rafraichir] = useReducer((x: number) => x + 1, 0);
  useLayoutEffect(() => magasin.abonner(rafraichir), []);
  const room = magasin.room;
  const players = magasin.players;
  const me = players.find((p: Any) => p.id === MOI);
  return <Undercover room={room} players={players} me={me} isHost={room.host_id === MOI} applyRoom={magasin.applyRoom} />;
}

let racine: Root | null = null;
function monter() {
  racine?.unmount();
  viderConfettis();
  hote.innerHTML = '<div id="root"><main></main></div><canvas id="cy-confetti"></canvas>';
  partieNeuve();
  racine = createRoot(hote.querySelector('main')!);
  flushSync(() => racine!.render(<Tuile />));
}

// ─── Le script ───
const $ = (sel: string) => hote.querySelector(sel) as HTMLElement | null;
const boutonDuVote = (nom: string) =>
  ([...hote.querySelectorAll('.screen li button')] as HTMLElement[]).find((b) => b.textContent?.includes(nom)) ?? null;
const boutonPrincipal = () => $('.screen > button.btn');
const pret = (id: string) => () => magasin.joueur(id, { uc_ready: true });

const T = {
  mot: 1.25, // Marc a donné son mot : la distribution arrive
  indices: 3.9, // tout le monde est prêt, l'hôte passe aux indices
  vote: 5.8, // l'hôte ouvre le vote
  resultat: 9.2, // tout le monde est prêt : l'hôte résout
};
const FIN = T.resultat + 2.8; // END_REVEAL_MS de UcResult : l'hôte bascule seul sur la fin

// Les touches du doigt : arrivée sur la cible, appui (le clic part 0,1 s après), relâche.
interface Touche { cible: () => HTMLElement | null; arrive: number; appui: number; lache: number; pos?: [number, number] }
const GESTES: Touche[][] = [
  [{ cible: boutonPrincipal, arrive: 2.35, appui: 2.6, lache: 2.8 }],
  [
    { cible: () => boutonDuVote('Inès'), arrive: 6.75, appui: 6.95, lache: 7.15 },
    { cible: boutonPrincipal, arrive: 7.65, appui: 7.85, lache: 8.05 },
  ],
];

type Action = [number, () => void];
const ACTIONS: Action[] = [
  [T.mot, () => magasin.uc({ phase: 'reveal' })],
  [1.8, pret('p-marc')],
  [2.2, pret('p-hugo')],
  [2.85, pret(MOI)], // l'écho de « J'ai vu mon mot — Prêt »
  [3.2, pret('p-sam')],
  [3.55, pret('p-ines')],
  [T.indices, () => magasin.uc({ phase: 'describe' })],
  [T.vote, () => {
    // Chaque téléphone repart de « pas prêt » à l'entrée du vote (UcVote).
    magasin.players = magasin.players.map((p) => ({ ...p, uc_ready: false }));
    magasin.uc({ phase: 'vote', voteEndsAt: EPOQUE + (T.vote + 5 * 20) * 1000 });
  }],
  [6.3, pret('p-marc')],
  [8.1, pret(MOI)], // l'écho de « Je suis prêt »
  [8.4, pret('p-hugo')],
  [8.65, pret('p-sam')],
  [8.9, pret('p-ines')],
  [T.resultat, () => {
    magasin.players = magasin.players.map((p) => (p.id === 'p-ines' ? { ...p, uc_eliminated: true } : p));
    magasin.uc({ phase: 'result', lastEliminated: { id: 'p-ines', name: 'Inès' }, winner: 'civils', pair: PAIRE, voteSkipped: false, voteEndsAt: null });
  }],
  [FIN, () => magasin.uc({ phase: 'ended' })],
];
// Les clics du doigt, rangés parmi les actions.
for (const g of GESTES) for (const k of g) ACTIONS.push([k.appui + 0.1, () => { mesurer(k); k.cible()?.click(); }]);
ACTIONS.sort((a, b) => a[0] - b[0]);

// ─── Le doigt : une fonction du temps ───
function mesurer(k: Touche) {
  if (k.pos) return k.pos;
  const el = k.cible();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  k.pos = [r.left + r.width / 2, r.top + r.height * 0.55];
  return k.pos;
}
const lisse = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const sortie = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const seg = (t: number, a: number, b: number, f = sortie) => f((t - a) / (b - a));
let presse: HTMLElement | null = null;
function poserDoigt(t: number) {
  let op = 0, x = 0, y = 0, s = 1, rond = 0, rondOp = 0;
  let cible: HTMLElement | null = null;
  for (const g of GESTES) {
    const debut = g[0].arrive - 0.4;
    const fin = g[g.length - 1].lache + 0.4;
    if (t < debut || t > fin) continue;
    const p0 = mesurer(g[0]);
    if (!p0) continue;
    // Entrée : arrive d'en bas à droite et se pose.
    const e = seg(t, debut, g[0].arrive);
    x = p0[0] + 26 * (1 - e);
    y = p0[1] + 70 * (1 - e);
    op = e;
    s = 1.12 - 0.12 * e;
    for (let i = 0; i < g.length; i++) {
      const k = g[i];
      const p = mesurer(k) ?? p0;
      if (i > 0 && t > g[i - 1].lache) {
        const prec = mesurer(g[i - 1]) ?? p0;
        const m = seg(t, g[i - 1].lache + 0.05, k.arrive, lisse);
        x = prec[0] + (p[0] - prec[0]) * m;
        y = prec[1] + (p[1] - prec[1]) * m - 18 * Math.sin(Math.PI * m);
      }
      if (t >= k.appui && t < k.lache + 0.2) {
        const enfonce = seg(t, k.appui, k.appui + 0.08) * (1 - seg(t, k.lache, k.lache + 0.15));
        s = 1 - 0.18 * enfonce;
        if (t < k.lache) cible = k.cible();
      }
      const r = (t - k.appui) / 0.52;
      if (r >= 0 && r <= 1) { rond = 0.9 + sortie(r); rondOp = 0.9 * (1 - r); }
    }
    const last = g[g.length - 1];
    const sort = seg(t, last.lache + 0.05, fin);
    if (sort > 0) {
      const p = mesurer(last) ?? p0;
      x = p[0] + 10 * sort;
      y = p[1] + 26 * sort;
      op = 1 - sort;
    }
  }
  doigt.style.opacity = op.toFixed(3);
  doigt.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
  onde.style.opacity = rondOp.toFixed(3);
  onde.style.transform = `scale(${rond.toFixed(3)})`;
  // L'appui se voit sur le bouton : son :active (cf. .cy-press dans la feuille).
  if (presse !== cible) {
    presse?.classList.remove('cy-press');
    cible?.classList.add('cy-press');
    presse = cible;
  }
}

function fondu(t: number) {
  const o = Math.min(seg(t, 0, 0.45), 1 - seg(t, DUREE - 0.5, DUREE));
  hote.style.opacity = o.toFixed(3);
}

// ─── Lecture ───
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function figer(t: number, avecDoigt: boolean) {
  (window as Any).__cyFige = true;
  tv = 0;
  monter();
  for (const k of GESTES.flat()) k.pos = undefined;
  for (const [a, f] of ACTIONS) {
    if (a > t) break;
    tv = a;
    flushSync(f);
    await attendre(0);
    await attendre(0);
  }
  tv = t;
  await attendre(300); // le minuteur du vote relit l'horloge toutes les 250 ms
  if (avecDoigt) poserDoigt(t);
  else doigt.style.display = 'none';
  fondu(Math.min(Math.max(t, 0.45), DUREE - 0.5));
  document.documentElement.dataset.pret = '1';
}

function jouer() {
  let t0 = 0;
  let i = 0;
  const boucle = () => {
    tv = 0;
    monter();
    for (const k of GESTES.flat()) k.pos = undefined;
    i = 0;
    t0 = performance.now();
  };
  const image = (maintenant: number) => {
    let t = (maintenant - t0) / 1000;
    if (t >= DUREE) {
      boucle();
      t = 0;
    }
    tv = t;
    (window as Any).__cyTemps = t;
    while (i < ACTIONS.length && ACTIONS[i][0] <= t) ACTIONS[i++][1]();
    poserDoigt(t);
    fondu(t);
    requestAnimationFrame(image);
  };
  boucle();
  document.documentElement.dataset.pret = '1';
  requestAnimationFrame(image);
}

const fige = new URLSearchParams(location.search).get('t');
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
(window as Any).__cyT = T;
(document.fonts?.ready ?? Promise.resolve()).then(() => {
  if (fige !== null) void figer(parseFloat(fige) || 0, true);
  else if (reduit) void figer(2.3, false);
  else jouer();
});
