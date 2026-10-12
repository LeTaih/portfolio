// LA TUILE CLICHÉ(S) : les vrais écrans du jeu (screens/cliche/Cliche → le
// classement, puis la révélation), montés sur un faux serveur en mémoire et
// joués par un script de gestes. Ce qui bouge — le glisser-déposer dnd-kit, le
// podium, le minuteur, la jauge, l'arrivée du meilleur cliché — est le code de
// l'appli. Les tirages sont des photos fabriquées (cf. photos.js).
import { derouler, lire, tempsVirtuel } from './horloge'; // EN PREMIER : avant React
import { useLayoutEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { store } from './store';
import Cliche from '@cy/screens/cliche/Cliche';
import { freshCliche } from '@cy/screens/cliche/clicheHelpers';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const W = 390, H = 844;
/** Durée d'une boucle (ms) et instant de l'affiche / du mouvement réduit. */
const BOUCLE = 12_900;
const AFFICHE = 5_450;

// ─── Le téléphone : un repère 390 × 844 mis à l'échelle de l'iframe ───
const stage = document.getElementById('cy-stage')!;
const host = document.getElementById('cy-host')!;
const doigt = document.getElementById('cy-finger')!;
let echelle = 1;
function cadrer() {
  echelle = (document.documentElement.clientWidth || W) / W;
  stage.style.transform = `scale(${echelle})`;
}
cadrer();
addEventListener('resize', cadrer);
// L'appli (et dnd-kit) lisent la fenêtre et les rectangles : ils doivent voir
// le téléphone, en pixels logiques, pas l'iframe.
Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => W });
Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => H });
const rectOrig = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const r = rectOrig.call(this);
  if (this === stage || !stage.contains(this)) return r;
  const s = rectOrig.call(stage);
  return new DOMRect((r.left - s.left) / echelle, (r.top - s.top) / echelle, r.width / echelle, r.height / echelle);
};
for (const m of ['setPointerCapture', 'releasePointerCapture'] as const) {
  const f = Element.prototype[m];
  Element.prototype[m] = function (this: Element, id: number) { try { f.call(this, id); } catch { /* doigt simulé */ } };
}

// ─── La tablée ───
const NOMS = ['Léa', 'Marc', 'Inès', 'Hugo', 'Sam'];
const COULEURS = ['#ff1e8c', '#34e0f0', '#e6ff3d', '#b388ff', '#ffb627'];
const MOI = 'p-lea';
const IDS = ['p-lea', 'p-marc', 'p-ines', 'p-hugo', 'p-sam'];
const joueurs = () => NOMS.map((name, i) => ({
  id: IDS[i], room_code: 'tuile', name, color: COULEURS[i], is_host: i === 0, can_control: i === 0,
  joined_at: '2026-10-10T20:00:00.000Z', is_fictional: false,
  cliche_ready: true, cliche_vote: null, cliche_score: 0, cliche_proposal: null,
}));
// Les sujets de la manche (un par joueur), pris dans le vrai pool de thèmes.
const SUJETS = ['un truc qui brille', 'une ombre', 'un reflet', 'des pieds', "l'ambiance"];
const OBJETS = SUJETS.map((text, i) => ({ id: `o${i + 1}`, text }));
const url = (n: string) => `cy-cliche/${n}.jpg`;
// Les tirages du 1er sujet, anonymes, dans l'ordre (mélangé) du serveur. Le
// mien (le cierge) n'y est pas : l'écran exclut ses propres photos.
const TIRAGES = { guirlande: 'f3a1', neon: 'c78e', sequins: '9b04', boule: '5d2c' } as const;
const tirage = (n: keyof typeof TIRAGES) => ({ photoId: TIRAGES[n], url: url(n) });
const REVELATION = [
  { photoId: TIRAGES.boule, url: url('boule'), photographerId: 'p-ines', photographerName: 'Inès', points: 11 },
  { photoId: '27e9', url: url('cierge'), photographerId: MOI, photographerName: 'Léa', points: 8 },
  { photoId: TIRAGES.guirlande, url: url('guirlande'), photographerId: 'p-hugo', photographerName: 'Hugo', points: 6 },
  { photoId: TIRAGES.sequins, url: url('sequins'), photographerId: 'p-marc', photographerName: 'Marc', points: 4 },
  { photoId: TIRAGES.neon, url: url('neon'), photographerId: 'p-sam', photographerName: 'Sam', points: 1 },
];

function etatInitial() {
  store.gen++;
  store.revelation = REVELATION;
  store.players = joueurs();
  store.room = {
    code: 'tuile', alias: null, host_id: MOI, current_question: null, state: 'playing', stats: null, sips_min: 1, sips_max: 6,
    game: 'cliche', uc: null, purple: null, ckk: null, pyra: null, blackjack: null, roulette: null, poker: null, navale: null, menteur: null,
    updated_at: '2026-10-10T20:30:00.000Z',
    cliche: {
      ...freshCliche(), phase: 'rank', round: 1, objects: OBJETS, objectIndex: 0,
      photos: [tirage('guirlande'), tirage('neon')], reveal: null,
      // 45 s par sujet : il en reste 34 quand l'écran s'allume
      deadline: Date.now() + 33_600,
    },
  };
}

function App() {
  const [, maj] = useReducer((x: number) => x + 1, 0);
  useLayoutEffect(() => store.sub(maj), []);
  const players = store.players;
  const me = players.find((p) => p.id === MOI);
  return <Cliche room={store.room} players={players} me={me} isHost applyRoom={store.applyRoom} refresh={async () => {}} />;
}

// ─── Les gestes ───
let racine: Root | null = null;
function monter() {
  racine?.unmount();
  host.scrollTop = 0;
  host.innerHTML = '<div id="root"><main></main></div>';
  racine = createRoot(host.querySelector('main')!);
  racine.render(<App />);
}
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const q = <T extends Element = HTMLElement>(s: string) => host.querySelector(s) as T | null;
async function attendre<T>(f: () => T | null | undefined | false, max = 6000): Promise<T> {
  const t0 = performance.now();
  for (;;) { const v = f(); if (v) return v as T; if (performance.now() - t0 > max) throw new Error('attente'); await dormir(16); }
}
const centre = (el: Element, fx = 0.5, fy = 0.5) => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width * fx, r.top + r.height * fy] as const;
};
const poserDoigt = (x: number, y: number) => { doigt.style.translate = `${x}px ${y}px`; };
function doigtSur(el: Element, fx = 0.5, fy = 0.5) { const [x, y] = centre(el, fx, fy); poserDoigt(x, y); }
async function taper(el: HTMLElement) {
  doigt.classList.add('is-down');
  doigt.classList.remove('is-tap'); void doigt.offsetWidth; doigt.classList.add('is-tap');
  await dormir(110);
  el.click();
  await dormir(60);
  doigt.classList.remove('is-down');
}
function pointeur(cible: EventTarget, type: string, x: number, y: number) {
  cible.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));
}
const doux = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Le doigt prend un tirage et le glisse sur la place `vers` du podium. */
async function glisser(de: number, vers: number, duree: number) {
  const tuiles = () => [...host.querySelectorAll<HTMLElement>('.cl-phototile')];
  const el = tuiles()[de], cible = tuiles()[vers];
  const [x0, y0] = centre(el, 0.5, 0.55);
  const [x1, y1] = centre(cible, 0.5, 0.55);
  doigt.classList.add('is-down');
  await dormir(140);
  pointeur(el, 'pointerdown', x0, y0);
  await dormir(90);
  // le doigt suit, sans la transition des déplacements « en l'air »
  doigt.style.transition = 'opacity 260ms var(--ease-out), scale 140ms var(--ease-out)';
  const pas = Math.round(duree / 16);
  for (let i = 1; i <= pas; i++) {
    const k = doux(i / pas);
    // une légère courbe, comme un vrai pouce
    const x = x0 + (x1 - x0) * k + Math.sin(k * Math.PI) * 14;
    const y = y0 + (y1 - y0) * k;
    poserDoigt(x, y);
    pointeur(document, 'pointermove', x, y);
    await dormir(16);
  }
  await dormir(120);
  pointeur(document, 'pointerup', x1, y1);
  doigt.classList.remove('is-down');
  await dormir(30);
  doigt.style.transition = '';
}
/** Le pouce fait défiler la page de `dy` pixels. */
async function defiler(dy: number, duree: number) {
  const [x, y0] = [250, 690];
  doigt.style.transition = 'none';
  poserDoigt(x, y0);
  void doigt.offsetWidth;
  doigt.style.transition = '';
  doigt.classList.add('is-on');
  await dormir(420);
  doigt.classList.add('is-down');
  await dormir(100);
  doigt.style.transition = 'opacity 260ms var(--ease-out), scale 140ms var(--ease-out)';
  const pas = Math.round(duree / 16), depart = host.scrollTop;
  for (let i = 1; i <= pas; i++) {
    const k = 1 - Math.pow(1 - i / pas, 3);
    poserDoigt(x, y0 - dy * Math.min(1, k * 1.08));
    host.scrollTop = depart + dy * k;
    await dormir(16);
  }
  doigt.classList.remove('is-down');
  doigt.classList.remove('is-on');
  await dormir(30);
  doigt.style.transition = '';
}
const voter = (id: string, podium: string[], latence = 120) => store.echo(id, { cliche_vote: { o1: podium } }, latence);

async function manche() {
  const t0 = performance.now();
  doigt.style.transition = 'none';
  doigt.classList.remove('is-on', 'is-down', 'is-tap');
  poserDoigt(330, 940);
  void doigt.offsetWidth;
  doigt.style.transition = '';
  etatInitial();
  monter();
  void host.offsetWidth;
  host.classList.remove('is-out');
  const a = (ms: number) => dormir(Math.max(0, t0 + ms - performance.now()));
  const plus = (n: keyof typeof TIRAGES) => store.setCliche({ photos: [...store.room.cliche.photos, tirage(n)] });

  // LES TIRAGES ARRIVENT (chargement tardif : l'écran réconcilie l'ordre), et
  // la table commence à voter.
  setTimeout(() => plus('sequins'), 650);
  setTimeout(() => plus('boule'), 1250);
  setTimeout(() => voter('p-marc', [TIRAGES.boule, TIRAGES.guirlande, TIRAGES.neon]), 1500);
  setTimeout(() => voter('p-hugo', [TIRAGES.boule, TIRAGES.sequins, TIRAGES.neon]), 2900);
  setTimeout(() => voter('p-sam', [TIRAGES.sequins, TIRAGES.boule, TIRAGES.guirlande]), 4400);

  // LE VOTE, AU DOIGT : la boule à facettes monte en tête, les sequins en 2e.
  await a(1800);
  await attendre(() => host.querySelectorAll('.cl-phototile').length === 4 && q('.cl-phototile'));
  doigtSur(host.querySelectorAll('.cl-phototile')[3], 0.5, 0.55);
  doigt.classList.add('is-on');
  await a(2250);
  await glisser(3, 0, 880);
  await a(3750);
  doigtSur(host.querySelectorAll('.cl-phototile')[3], 0.5, 0.55);
  await a(4200);
  await glisser(3, 1, 760);
  await a(5450);
  const valider = await attendre(() => [...host.querySelectorAll<HTMLButtonElement>('button.btn')].find((b) => b.textContent?.includes('Valider')));
  doigtSur(valider);
  await a(5950);
  await taper(valider);
  await dormir(260);
  doigt.classList.remove('is-on');
  // Inès vote la dernière : 05/05, l'hôte (ce téléphone) déclenche la révélation.
  setTimeout(() => voter('p-ines', [TIRAGES.sequins, TIRAGES.guirlande, TIRAGES.neon], 0), 900);

  // LE RÉSULTAT : le meilleur cliché, puis on descend voir les autres.
  await attendre(() => store.room.cliche.phase === 'reveal', 8000);
  await a(9500);
  await defiler(250, 760);
  await a(BOUCLE - 520);
  host.classList.add('is-out');
  await a(BOUCLE);
}

async function boucle() {
  for (;;) {
    try { await manche(); } catch (e) { console.error(e); await dormir(500); }
  }
}

// Les tirages sont chargés (et décodés) avant la première image.
const photos = ['guirlande', 'neon', 'sequins', 'boule', 'cierge'].map((n) => {
  const i = new Image();
  i.src = url(n);
  return i.decode().catch(() => {});
});
const params = new URLSearchParams(location.search);
const fige = params.get('t');
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
(window as Any).__cyStore = store;
(window as Any).__cyTemps = tempsVirtuel;
Promise.all([document.fonts?.ready, ...photos]).then(async () => {
  void boucle();
  if (fige !== null || reduit) {
    const t = fige !== null ? Math.max(0, parseFloat(fige) || 0) * 1000 : AFFICHE;
    await derouler(t);
    if (reduit) doigt.style.display = 'none';
    document.documentElement.dataset.fige = String(t);
  } else lire();
});
