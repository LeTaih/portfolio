// LA TUILE « Poker » : la vraie table du Poker de Cyrose (PkTable, branche
// feat/casino-table), montée sur le magasin en mémoire et le faux api/poker.ts,
// jouée par un script de gestes. Cf. ../LISEZMOI.md.
import { DEMANDE, FIGEE, REDUIT, figerA } from './horloge';
import { useLayoutEffect, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import PkTable from '@cy/screens/poker/table/PkTable';
import { freshSession, sessionOf } from '@cy/lib/casino/session';
import { choisirJoueurs } from '@cy/lib/poker/serveur';
import type { PokerState } from '@cy/lib/poker/types';
import type { Card, Suit } from '@cy/lib/purple/types';
import type { Player, Room } from '@cy/lib/types';
import { magasin } from './magasin';
import { MOI, donner, jouerPour, oublier } from './faux/serveur';

// ── La scène : 390 × 844, à l'échelle de l'iframe ───────────────────────────
const L = 390, H = 844;
const scene = document.getElementById('cy-stage')!;
const hote = document.getElementById('cy-host')!;
const doigt = document.getElementById('cy-finger')!;
let echelle = 1;
function cadrer() {
  echelle = (document.documentElement.clientWidth || L) / L;
  scene.style.transform = `scale(${echelle})`;
}
cadrer();
addEventListener('resize', cadrer);
// L'appli se croit sur un téléphone de 390 × 844 : elle cadre sa table là-dessus.
Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => L });
Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => H });
// …et lit ses mesures dans le repère de ce téléphone, pas dans celui de l'iframe.
const rectNatif = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const r = rectNatif.call(this);
  if (this === scene || !scene.contains(this)) return r;
  const s = rectNatif.call(scene);
  return new DOMRect((r.left - s.left) / echelle, (r.top - s.top) / echelle, r.width / echelle, r.height / echelle);
};

// ── La table : cinq joueurs, Léa (toi) est l'hôte ───────────────────────────
const c = (rank: number, suit: Suit): Card => ({ rank, suit });
const JOUEURS = [
  { id: MOI, name: 'Léa', color: '#ff1e8c', chips: 16 },
  { id: 'p-marc', name: 'Marc', color: '#34e0f0', chips: 18 },
  { id: 'p-ines', name: 'Inès', color: '#e6ff3d', chips: 12 },
  { id: 'p-tom', name: 'Tom', color: '#ffb627', chips: 10 },
  { id: 'p-hugo', name: 'Hugo', color: '#b388ff', chips: 7 },
];
const MANCHE = 3;
/** Le bouton chez Tom : Hugo petite blind, toi grosse blind — tu parles en dernier. */
const BOUTON = 3;
/** Le paquet, dans l'ordre où la machine le sert : deux cartes par siège, puis le board. */
function paquet(): Card[] {
  const voulu = [
    c(12, 'hearts'), c(12, 'spades'), // Léa : paire de dames
    c(8, 'diamonds'), c(4, 'clubs'), // Marc
    c(11, 'spades'), c(3, 'hearts'), // Inès
    c(6, 'clubs'), c(2, 'diamonds'), // Tom
    c(1, 'spades'), c(13, 'diamonds'), // Hugo : as-roi
    c(12, 'diamonds'), c(7, 'clubs'), c(2, 'spades'), c(9, 'hearts'), c(13, 'clubs'), // flop, turn, river
  ];
  const reste: Card[] = [];
  for (const s of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[])
    for (let r = 1; r <= 13; r++) if (!voulu.some((k) => k.rank === r && k.suit === s)) reste.push(c(r, s));
  return [...voulu, ...reste];
}

function etatInitial() {
  magasin.gen++;
  oublier();
  const poker: PokerState = { phase: 'playing', controllerId: MOI, roundNumber: MANCHE } as PokerState;
  magasin.room = {
    code: 'tuile', alias: null, host_id: MOI, current_question: null, state: 'playing', stats: null, sips_min: 1, sips_max: 6,
    packs: ['default'], game: 'poker', uc: null, purple: null, cliche: null, ckk: null, pyra: null, blackjack: null, roulette: null,
    poker, poker_main: null, casino: { ...freshSession(), opened: true, roundsPlayed: MANCHE - 1 }, navale: null, menteur: null,
    created_at: '2026-10-11T20:00:00.000Z', updated_at: '2026-10-11T20:00:00.000Z',
  } as unknown as Room;
  magasin.players = JOUEURS.map((j) => ({
    id: j.id, room_code: 'tuile', name: j.name, color: j.color, is_host: j.id === MOI, can_control: j.id === MOI,
    joined_at: '2026-10-11T20:00:00.000Z', is_fictional: false, sobre: false,
    bj_chips: j.chips, bj_state: null, rl_state: null, pk_state: { ready: true, joue: true },
  }) as unknown as Player);
}

function Ecran() {
  const [, rendre] = useReducer((x: number) => x + 1, 0);
  useLayoutEffect(() => magasin.abonner(rendre), []);
  const room = magasin.room;
  const players = magasin.players;
  const me = players.find((p) => p.id === MOI)!;
  return (
    <PkTable room={room} table={room.poker!} session={sessionOf(room)} players={players} me={me} isHost
      applyRoom={magasin.applyRoom} refresh={() => {}} />
  );
}

let racine: Root | null = null;
function monter() {
  racine?.unmount();
  hote.innerHTML = '<div id="root"><div><main></main></div></div>';
  racine = createRoot(hote.querySelector('main')!);
  racine.render(<Ecran />);
}

// ── Le doigt ─────────────────────────────────────────────────────────────────
const pause = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
async function trouver<T>(f: () => T | null | undefined, max = 6000): Promise<T> {
  const t = performance.now();
  for (;;) {
    const x = f();
    if (x) return x;
    if (performance.now() - t > max) throw new Error('attente');
    await pause(30);
  }
}
const bouton = (texte: string) =>
  [...hote.querySelectorAll<HTMLButtonElement>('.tdock button')].find((b) => b.textContent?.trim() === texte && !b.disabled) ?? null;
function viser(el: Element, fx = 0.5, fy = 0.5) {
  const r = el.getBoundingClientRect();
  doigt.style.translate = `${r.left + r.width * fx}px ${r.top + r.height * fy}px`;
}
async function taper(el: HTMLElement) {
  doigt.classList.add('is-down');
  doigt.classList.remove('is-tap');
  void doigt.offsetWidth;
  doigt.classList.add('is-tap');
  el.classList.add('cy-press');
  await pause(110);
  el.click();
  await pause(60);
  doigt.classList.remove('is-down');
  el.classList.remove('cy-press');
}

// ── La main, seconde par seconde ─────────────────────────────────────────────
export const DUREE = 14100;
const FONDU = 450;
/** L'instant de l'affiche (et du mouvement réduit) : la main est réglée, « Tu gagnes 9 ». */
export const AFFICHE = 12500;

async function boucle() {
  const t0 = performance.now();
  const a = (ms: number) => pause(Math.max(0, t0 + ms - performance.now()));
  doigt.style.transition = 'none';
  doigt.style.translate = '330px 940px';
  doigt.classList.remove('is-on', 'is-down', 'is-tap');
  void doigt.offsetWidth;
  doigt.style.transition = '';
  etatInitial();
  monter();
  hote.classList.remove('is-out');

  // La donne : blindes, deux cartes chacun.
  await a(400);
  donner({ manche: MANCHE, joueurs: choisirJoueurs(magasin.players), bouton: BOUTON, paquet: paquet() });

  // Avant le flop : Marc suit, Inès et Tom se couchent, Hugo complète.
  await a(1900); jouerPour('p-marc', { type: 'suivre' });
  await a(2350); jouerPour('p-ines', { type: 'coucher' });
  await a(2800); jouerPour('p-tom', { type: 'coucher' });
  await a(3300); jouerPour('p-hugo', { type: 'suivre' });

  // À toi (grosse blind) : tu checkes. Le flop tombe.
  const checker = await trouver(() => bouton('Checker'));
  await a(3550); viser(checker); doigt.classList.add('is-on');
  await a(4050); await taper(checker);
  await a(4350); doigt.classList.remove('is-on');

  // Au flop : Hugo checke, tu relances à 7.
  await a(5200); jouerPour('p-hugo', { type: 'checker' });
  const relancer = await trouver(() => bouton('Relancer'));
  await a(5450); viser(relancer); doigt.classList.add('is-on');
  await a(5900); await taper(relancer);
  const plus5 = await trouver(() => hote.querySelector<HTMLButtonElement>('.tdock button[aria-label="Plus 5"]:not(:disabled)'));
  await a(6200); viser(plus5);
  await a(6650); await taper(plus5);
  const go = await trouver(() => bouton('Relancer à 7'));
  await a(7000); viser(go);
  await a(7400); await taper(go);
  await a(7750); doigt.classList.remove('is-on');

  // Marc se couche ; Hugo suit pour tout ce qu'il a : la turn et la rivière
  // tombent d'elles-mêmes, abattage, le pot part chez toi, l'hôte (toi) règle.
  await a(8150); jouerPour('p-marc', { type: 'coucher' });
  await a(8750); jouerPour('p-hugo', { type: 'suivre' });

  await a(DUREE - FONDU); hote.classList.add('is-out');
  await a(DUREE);
}

async function lire() {
  for (;;) {
    try { await boucle(); } catch (e) { console.error(e); await pause(500); }
  }
}

async function figer(ms: number) {
  void boucle().catch((e) => console.error(e));
  await figerA(ms);
  document.documentElement.dataset.fige = 'pret';
}

const polices = document.fonts?.ready ?? Promise.resolve();
void polices.then(() => {
  if (FIGEE) void figer(DEMANDE !== null ? ((DEMANDE * 1000) % DUREE + DUREE) % DUREE : AFFICHE);
  else void lire();
});
void REDUIT;
