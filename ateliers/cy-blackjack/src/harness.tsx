// LA TUILE : la vraie table du Blackjack (screens/blackjack/table/BjTable), montée
// sur un faux serveur en mémoire, et une main jouée par un script. Ce qui bouge à
// l'écran — cartes, jetons, anneau, dock, premier plan — est le code de l'appli.
import { avancerJusqua, instantFige } from './horloge';
import { useLayoutEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { store } from './store';
import BjTable from '@wt/screens/blackjack/table/BjTable';
import { BLACKJACK } from '@wt/lib/blackjack/game';
import { freshSession, sessionOf } from '@wt/lib/casino/session';
import { createShoe, resolvePlayer, stand } from '@wt/lib/blackjack/engine';
import { settleRound } from '@wt/lib/casino/round';

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
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── La tablée (couleurs du salon) ───
const C = (rank: number, suit: Any) => ({ rank, suit });
const JOUEURS = [
  { id: 'p-lea', name: 'Léa', color: '#ff1e8c' },
  { id: 'p-marc', name: 'Marc', color: '#34e0f0' },
  { id: 'p-ines', name: 'Inès', color: '#e6ff3d' },
  { id: 'p-hugo', name: 'Hugo', color: '#b388ff' },
];
const MOI = 'p-lea';
const joueur = (j: Any, patch: Any) => ({
  room_code: 'tuile', is_host: j.id === MOI, can_control: j.id === MOI, joined_at: '2026-10-11T20:00:00.000Z',
  is_fictional: false, sobre: false, ...j, ...patch,
});
const etat = (main: number, extra: Any = {}) => ({ hands: [], activeHandIndex: 0, insuranceBet: 0, ready: true, bets: { main, queenOfHearts: 0, twoPlusOne: 0 }, ...extra });

// Le sabot, dans l'ordre de initialDeal : Léa, Marc, Inès, banque, puis le second
// tour (la banque face cachée), puis les pioches privées (16 chacun), puis ce que
// la banque tire.
function sabot() {
  const reste = createShoe(1, () => 0.42);
  const pioche = (premiere?: Any) => [...(premiere ? [premiere] : []), ...reste.splice(0, premiere ? 15 : 16)];
  return [
    C(9, 'diamonds'), C(10, 'clubs'), C(13, 'diamonds'), C(7, 'clubs'),
    C(3, 'spades'), C(6, 'hearts'), C(12, 'spades'), C(6, 'spades'),
    ...pioche(C(7, 'hearts')), ...pioche(), ...pioche(),
    C(5, 'diamonds'), ...reste,
  ];
}

function etatInitial() {
  store.gen++;
  const session = { ...freshSession(), opened: true, roundsPlayed: 2 };
  store.room = {
    code: 'tuile', alias: null, host_id: MOI, current_question: null, state: 'playing', stats: null, sips_min: 1, sips_max: 6,
    game: 'blackjack', uc: null, purple: null, cliche: null, ckk: null, pyra: null, roulette: null, poker: null, navale: null, menteur: null,
    updated_at: '2026-10-11T20:00:00.000Z',
    casino: session,
    blackjack: { ...BLACKJACK.fresh(MOI), phase: 'betting', roundNumber: 3, deck: sabot() },
  };
  store.players = [
    joueur(JOUEURS[0], { bj_chips: 16, bj_state: null }),
    joueur(JOUEURS[1], { bj_chips: 0, bj_state: etat(3, { hands: [{ cards: [], bet: 3, doubled: false, split: false, status: 'playing' }] }) }),
    joueur(JOUEURS[2], { bj_chips: 8, bj_state: null }),
    joueur(JOUEURS[3], { bj_chips: 10, bj_state: null }),
  ];
}

// Mouvement réduit : la table au résultat, réglée, sans rien qui bouge.
function etatStatique() {
  etatInitial();
  const banque = [C(7, 'clubs'), C(6, 'spades'), C(5, 'diamonds')];
  const main = (cards: Any[], bet: number) => ({ hands: [{ cards, bet, doubled: false, split: false, status: 'stood' }], activeHandIndex: 0, insuranceBet: 0, bets: { main: bet, queenOfHearts: 0, twoPlusOne: 0 } });
  const mains: Record<string, Any> = {
    'p-lea': main([C(9, 'diamonds'), C(3, 'spades'), C(7, 'hearts')], 5),
    'p-marc': main([C(10, 'clubs'), C(6, 'hearts')], 3),
    'p-ines': main([C(13, 'diamonds'), C(12, 'spades')], 2),
  };
  const soldes: Record<string, number> = { 'p-lea': 11, 'p-marc': 0, 'p-ines': 6, 'p-hugo': 10 };
  const session = store.room.casino;
  const seats = store.players.map((p) => ({ id: p.id, name: p.name, color: p.color, chips: soldes[p.id] }));
  const played = Object.entries(mains).map(([id, ps]) => {
    const { detail, netChips, raw } = resolvePlayer(ps, ps.bets, banque, soldes[id]);
    return { id, raw, netChips, detail };
  });
  const r = settleRound(seats, played, BLACKJACK.minBet, session);
  store.room = {
    ...store.room, casino: r.session,
    blackjack: { ...store.room.blackjack, phase: 'resolved', dealerHand: banque, dealerRevealed: true, playerOrder: ['p-lea', 'p-marc', 'p-ines'], currentPlayerIndex: 2, results: r.results },
  };
  store.players = store.players.map((p) => ({ ...p, bj_chips: r.balances[p.id] ?? soldes[p.id], bj_state: null }));
}

function App() {
  const [, maj] = useReducer((x: number) => x + 1, 0);
  useLayoutEffect(() => store.sub(maj), []);
  const room = store.room, players = store.players;
  const me = players.find((p) => p.id === MOI);
  const bj = room.blackjack;
  const session = sessionOf(room);
  return <BjTable room={room} players={players} me={me} isHost applyRoom={store.applyRoom} refresh={() => {}} table={bj} bj={bj} session={session} />;
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
const q = <T extends Element = HTMLElement>(s: string) => host.querySelector(s) as T | null;
async function attendre<T>(f: () => T | null | undefined | false, max = 6000): Promise<T> {
  const t0 = performance.now();
  for (;;) { const v = f(); if (v) return v as T; if (performance.now() - t0 > max) throw new Error('attente'); await sleep(30); }
}
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
function pointer(el: Element, type: string) {
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
}
const autre = (id: string) => store.players.find((p) => p.id === id);
const bj = () => store.room.blackjack;

async function manche() {
  (window as Any).__cyT0 = performance.now();
  finger.style.transition = 'none';
  finger.style.translate = '330px 940px';
  void finger.offsetWidth;
  finger.style.transition = '';
  etatInitial();
  monter();
  host.classList.remove('is-out');

  // MISES. Marc a déjà misé ; Inès confirme, Hugo passe, pendant que Léa verse.
  setTimeout(() => store.echo('p-ines', { bj_chips: 6, bj_state: etat(2, { hands: [{ cards: [], bet: 2, doubled: false, split: false, status: 'playing' }] }) }, 0), 1050);
  setTimeout(() => store.echo('p-hugo', { bj_state: etat(0) }, 0), 1800);
  await sleep(380);
  const zone = await attendre(() => q('.tzone'));
  doigtSur(zone);
  finger.classList.add('is-on');
  await sleep(470);
  finger.classList.add('is-down');
  pointer(zone, 'pointerdown');          // le robinet : 200 ms, puis ×0,86
  await sleep(700);                      // → 5 jetons
  pointer(zone, 'pointerup');
  finger.classList.remove('is-down');
  await sleep(380);
  const confirmer = await attendre(() => bouton('Confirmer la mise'));
  doigtSur(confirmer, 0.5, 0.5);
  await sleep(480);
  await taper(confirmer);
  await sleep(200);
  finger.classList.remove('is-on');

  // LA DONNE (l'hôte, c'est Léa : le vrai useBjMises distribue) puis SON TOUR.
  const tirer = await attendre(() => bouton('Tirer'), 8000);
  await sleep(520);
  doigtSur(tirer);
  finger.classList.add('is-on');
  await sleep(480);
  await taper(tirer);
  await sleep(700);
  const rester = await attendre(() => bouton('Rester'));
  doigtSur(rester);
  await sleep(440);
  await taper(rester);
  await sleep(160);
  finger.classList.remove('is-on');

  // MARC, puis INÈS, restent (leurs téléphones écrivent leur ligne).
  for (const [i, id] of [[1, 'p-marc'], [2, 'p-ines']] as const) {
    await attendre(() => bj().phase === 'playing' && bj().currentPlayerIndex === i, 6000);
    await sleep(560);
    const s = autre(id).bj_state;
    store.echo(id, { bj_state: { ...stand(s), bets: s.bets, ready: false } }, 90);
  }

  // LA BANQUE joue, l'hôte règle : tout est dans useBjJeu.
  await attendre(() => bj().phase === 'resolved', 8000);
  await sleep(2700);
  host.classList.add('is-out');
  await sleep(450);
}

async function boucle() {
  for (;;) {
    try { await manche(); } catch (e) { console.error(e); await sleep(500); }
  }
}

const pret = document.fonts?.ready ?? Promise.resolve();
pret.then(async () => {
  if (reduit) { etatStatique(); monter(); }
  else if (instantFige !== null) {
    // ?t=<s> : la boucle tourne sur l'horloge virtuelle, qu'on pousse jusqu'à t.
    void boucle();
    await avancerJusqua(instantFige * 1000);
    document.documentElement.dataset.fige = String(instantFige);
  } else void boucle();
});
