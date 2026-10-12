// LA TUILE : la vraie table de la Roulette (screens/roulette/table/RlTable),
// montée sur un faux serveur en mémoire, et une manche jouée par un script.
// Ce qui bouge à l'écran — jetons, tapis, roue, bille, premier plan, dock,
// règlement en quatre temps — est le code de l'appli.
import '@wt/fonts.css';
import '@wt/index.css';
import '@wt/screens/casino/casino.css';
import { useLayoutEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { store } from './store';
import RlTable from '@wt/screens/roulette/table/RlTable';
import '@wt/screens/roulette/roulette.css';
import { ROULETTE } from '@wt/lib/roulette/game';
import { freshSession, sessionOf } from '@wt/lib/casino/session';
import { settleRound } from '@wt/lib/casino/round';
import { playTable, nextSeatState } from '@wt/lib/roulette/round';
import { CLES_CASES } from '@wt/lib/casino/table/roulette';
import { RL_SPIN_MS } from '@wt/lib/roulette/types';

type Any = any;
const W = 390, H = 844;

// ─── Le téléphone : un repère 390 × 844 mis à l'échelle de l'iframe ───
const stage = document.getElementById('cy-stage')!;
const host = document.getElementById('cy-host')!;
const finger = document.getElementById('cy-finger')!;
let scale = 1;
function fit() {
  const w = document.documentElement.clientWidth || W;
  scale = w / W;
  stage.style.transform = `scale(${scale})`;
  document.body.style.height = `${Math.round(H * scale)}px`;
}
fit();
// L'appli lit la fenêtre (cadrage de la table) : elle doit voir le téléphone.
Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => W });
Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => H });
const rectOrig = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const r = rectOrig.call(this);
  if (this === stage || !stage.contains(this)) return r;
  const s = rectOrig.call(stage);
  return new DOMRect((r.left - s.left) / scale, (r.top - s.top) / scale, r.width / scale, r.height / scale);
};
for (const m of ['setPointerCapture', 'releasePointerCapture'] as const) {
  const f = Element.prototype[m];
  Element.prototype[m] = function (this: Element, id: number) { try { f.call(this, id); } catch { /* doigt simulé */ } };
}
addEventListener('resize', () => { fit(); });

(window as Any).__cyStore = store;
const horloge = (window as Any).__cyHorloge as { fige: number | null; avancer(ms: number): Promise<void> } | undefined;
const fige = horloge?.fige ?? null;
const reduit = fige === null && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── La tablée (couleurs du salon) ───
const JOUEURS = [
  { id: 'p-lea', name: 'Léa', color: '#ff1e8c' },
  { id: 'p-marc', name: 'Marc', color: '#34e0f0' },
  { id: 'p-ines', name: 'Inès', color: '#e6ff3d' },
  { id: 'p-hugo', name: 'Hugo', color: '#b388ff' },
];
const MOI = 'p-lea';
/** Le numéro de cette manche : la bille y tombe à chaque boucle. */
const GAGNANT = 23;
const HISTORIQUE = [32, 15, 0, 26, 3];
const MANCHE = 4;
const joueur = (j: Any, patch: Any) => ({
  room_code: 'tuile', is_host: j.id === MOI, can_control: j.id === MOI, joined_at: '2026-10-11T20:00:00.000Z',
  is_fictional: false, sobre: false, ...j, ...patch,
});
// Les mises de chacun : Marc a déjà confirmé ; Inès et Hugo confirment pendant
// que Léa compose son tapis (deux jetons sur la 2e douzaine, un sur le rouge).
// Le 23 : Marc touche son plein, Léa sa douzaine et le rouge ; Inès (noir) et
// Hugo (1re colonne) perdent.
const MISES: Record<string, Record<string, number>> = {
  'p-marc': { 'n:23': 1, red: 2 },
  'p-ines': { black: 3 },
  'p-hugo': { 'c:1': 2 },
  'p-lea': { 'd:2': 2, red: 1 },
};
const SOLDES: Record<string, number> = { 'p-lea': 13, 'p-marc': 9, 'p-ines': 9, 'p-hugo': 10 };
const confirme = (id: string, dernieres?: Record<string, number>) => ({ bets: MISES[id], ready: true, lastBets: dernieres ?? MISES[id] });

function etatInitial() {
  store.gen++;
  const session = { ...freshSession(), opened: true, roundsPlayed: MANCHE - 1 };
  store.room = {
    code: 'tuile', alias: null, host_id: MOI, current_question: null, state: 'playing', stats: null, sips_min: 1, sips_max: 6,
    game: 'roulette', uc: null, purple: null, cliche: null, ckk: null, pyra: null, blackjack: null, poker: null, navale: null, menteur: null,
    updated_at: '2026-10-11T20:00:00.000Z',
    casino: session,
    roulette: { ...ROULETTE.fresh(MOI), phase: 'betting', roundNumber: MANCHE, history: HISTORIQUE },
  };
  store.players = [
    joueur(JOUEURS[0], { bj_chips: SOLDES['p-lea'], rl_state: { bets: {}, ready: false, lastBets: { 'n:32': 1, black: 2 } } }),
    joueur(JOUEURS[1], { bj_chips: SOLDES['p-marc'] - 3, rl_state: confirme('p-marc') }),
    joueur(JOUEURS[2], { bj_chips: SOLDES['p-ines'], rl_state: { bets: {}, ready: false } }),
    joueur(JOUEURS[3], { bj_chips: SOLDES['p-hugo'], rl_state: { bets: {}, ready: false } }),
  ];
}

// Mouvement réduit : la table au résultat, réglée, sans rien qui bouge.
function etatStatique() {
  etatInitial();
  const session = store.room.casino;
  const seats = store.players.map((p) => ({ id: p.id, name: p.name, color: p.color, chips: SOLDES[p.id], state: { bets: MISES[p.id], ready: true } }));
  // Les soldes avant règlement : mises débitées.
  for (const s of seats) s.chips = SOLDES[s.id] - Object.values(MISES[s.id]).reduce((a, b) => a + b, 0);
  const r = settleRound(seats, playTable(seats as Any, GAGNANT), ROULETTE.minBet, session);
  store.room = {
    ...store.room, casino: r.session,
    roulette: { ...store.room.roulette, phase: 'resolved', winning: GAGNANT, spinAt: Date.now() - RL_SPIN_MS - 2000, results: r.results, history: [GAGNANT, ...HISTORIQUE] },
  };
  store.players = store.players.map((p) => ({ ...p, bj_chips: r.balances[p.id] ?? p.bj_chips, rl_state: nextSeatState(seats.find((s) => s.id === p.id) as Any) }));
}

// L'hôte (Léa) tire le numéro au lancement (useRlMises.launch) : la tuile le
// fixe, pour que la bille tombe toujours au même endroit.
function applyRoom(r: Any) {
  const rl = r.roulette;
  if (rl?.phase === 'spinning' && rl.winning !== GAGNANT) r = { ...r, roulette: { ...rl, winning: GAGNANT } };
  store.applyRoom(r);
}

function App() {
  const [, maj] = useReducer((x: number) => x + 1, 0);
  useLayoutEffect(() => store.sub(maj), []);
  const room = store.room, players = store.players;
  const me = players.find((p) => p.id === MOI);
  const rl = room.roulette;
  const session = sessionOf(room);
  return <RlTable room={room} players={players} me={me} isHost applyRoom={applyRoom} refresh={() => {}} table={rl} rl={rl} session={session} />;
}

// ─── Le script ───
let reactRoot: Root | null = null;
function monter() {
  reactRoot?.unmount();
  host.innerHTML = '<div id="root"><div><main></main></div></div>';
  reactRoot = createRoot(host.querySelector('main')!);
  reactRoot.render(<App />);
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function attendre<T>(f: () => T | null | undefined | false, max = 6000): Promise<T> {
  const t0 = performance.now();
  for (;;) { const v = f(); if (v) return v as T; if (performance.now() - t0 > max) throw new Error('attente'); await sleep(30); }
}
const kase = (k: string) => host.querySelectorAll<HTMLButtonElement>('.rcase')[CLES_CASES.indexOf(k)] ?? null;
const jeton = (v: number) => host.querySelector<HTMLButtonElement>(`.rjetons button[aria-label="Jetons de ${v}"]`);
const bouton = (txt: string) => [...host.querySelectorAll<HTMLButtonElement>('.tdock button')].find((b) => b.textContent?.trim() === txt && !b.disabled) ?? null;
function doigtSur(el: Element, fx = 0.5, fy = 0.5) {
  const r = el.getBoundingClientRect();
  finger.style.translate = `${r.left + r.width * fx}px ${r.top + r.height * fy}px`;
}
async function taper(el: HTMLElement) {
  finger.classList.add('is-down');
  finger.classList.remove('is-tap'); void finger.offsetWidth; finger.classList.add('is-tap');
  el.classList.add('cy-press');
  await sleep(110);
  el.click();
  await sleep(50);
  finger.classList.remove('is-down');
  el.classList.remove('cy-press');
}
const rl = () => store.room.roulette;

async function manche() {
  const t0 = performance.now();
  (window as Any).__cyT0 = t0;
  /** Le script est calé sur l'horloge de la manche, pas sur la somme des pauses. */
  const a = (ms: number) => sleep(Math.max(0, t0 + ms - performance.now()));
  finger.style.transition = 'none';
  finger.style.translate = '330px 940px';
  void finger.offsetWidth;
  finger.style.transition = '';
  finger.classList.remove('is-on', 'is-down', 'is-tap');
  etatInitial();
  monter();
  host.classList.remove('is-out');

  // FAITES VOS JEUX. Marc a déjà misé ; Inès puis Hugo confirment depuis leur
  // téléphone pendant que Léa pose ses jetons (jetons de 1, la valeur par défaut).
  setTimeout(() => store.echo('p-ines', { bj_chips: SOLDES['p-ines'] - 3, rl_state: confirme('p-ines') }, 0), 640);
  setTimeout(() => store.echo('p-hugo', { bj_chips: SOLDES['p-hugo'] - 2, rl_state: confirme('p-hugo') }, 0), 1180);
  const douzaine = await attendre(() => kase('d:2'));
  await a(80);
  doigtSur(douzaine, 0.5, 0.42);
  finger.classList.add('is-on');
  await a(500);
  await taper(douzaine);
  await a(820);
  await taper(douzaine);
  await a(940);
  const rouge = await attendre(() => kase('red'));
  doigtSur(rouge);
  await a(1360);
  await taper(rouge);
  await a(1500);
  const rien = await attendre(() => bouton('Rien ne va plus'));
  doigtSur(rien);
  await a(1920);
  await taper(rien);
  await a(2200);
  finger.classList.remove('is-on');

  // LA BILLE. Tout le monde est prêt : l'hôte (Léa) lance, la roue vient au
  // premier plan, la bille tombe, puis l'hôte règle (useRlRotation).
  await attendre(() => rl().phase === 'spinning', 4000);
  await attendre(() => rl().phase === 'resolved', RL_SPIN_MS + 4000);
  // Le règlement en quatre temps (useEtapeResultat : 1,5 BEAT par temps), puis
  // le temps de voir les gains rentrer.
  await sleep(3700);
  host.classList.add('is-out');
  await sleep(450);
}

async function boucle() {
  for (;;) {
    try { await manche(); } catch (e) { console.error(e); await sleep(500); }
  }
}

const pret = document.fonts?.ready ?? Promise.resolve();
pret.then(() => {
  if (reduit) { etatStatique(); monter(); return; }
  void boucle();
  if (fige !== null) horloge!.avancer(fige).catch((e) => console.error('[horloge]', e));
});
