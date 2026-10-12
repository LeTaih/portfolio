// ateliers/cy-navale/tuile.tsx
// LA TUILE « BATAILLE NAVALE » : le vrai écran de tir de Cyrose (RoomTopBar +
// NavaleTir, avec sa grille, sa loupe, son résumé, ses explosions et le mur
// replié des flottes), compilé tel quel, nourri par les vraies règles
// (`etatInitial`, `jouerTir`) et joué par un script.
//
// La partie : quatre joueurs sur une grille 7×7, onze tirs déjà joués. Sam tire
// à l'eau, c'est mon tour (le plateau s'éveille), mon doigt touche deux flottes
// en D4, puis Marie coule mon Remorqueur en B6 — « Tu bois 3 ».
import { avancer, jouerImage, maintenant, attendre, imageNative } from './horloge';
import { useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import RoomTopBar from '@cy/screens/RoomTopBar';
import NavaleTir from '@cy/screens/navale/NavaleTir';
import { etatInitial, jouerTir, DUREE_TOUR_MS } from '@cy/lib/navale/partie';
import type { Flotte, NavaleSecrets, NavaleState } from '@cy/lib/navale/types';
import type { Player } from '@cy/lib/types';

/* ═══════════════════════════════ LE CADRE ═══════════════════════════════ */

const LARGEUR = 390;
const HAUTEUR = 844;
const scene = document.getElementById('cy-stage')!;
const hote = document.getElementById('cy-host')!;
const doigt = document.getElementById('cy-finger')!;
let echelle = 1;

function ajuster() {
  echelle = (document.documentElement.clientWidth || LARGEUR) / LARGEUR;
  scene.style.transform = `scale(${echelle})`;
  document.body.style.height = `${Math.round(HAUTEUR * echelle)}px`;
}
ajuster();
addEventListener('resize', ajuster);

// L'ÉCRAN EST UN TÉLÉPHONE DE 390×844, quelle que soit l'iframe. Les composants
// mesurent la fenêtre (NavaleMur pose la hauteur de l'écran de tir sur
// `clientHeight`) et des rectangles (la loupe, le doigt) : on leur répond en
// unités de l'écran logique, pas en pixels de l'iframe.
Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => LARGEUR });
Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => HAUTEUR });
const html = document.documentElement;
Object.defineProperty(html, 'clientWidth', { configurable: true, get: () => LARGEUR });
Object.defineProperty(html, 'clientHeight', { configurable: true, get: () => HAUTEUR });
Object.defineProperty(html, 'scrollHeight', {
  configurable: true,
  get: () => Math.max(HAUTEUR, document.getElementById('root')?.scrollHeight ?? HAUTEUR),
});
// LE DÉFILEMENT EST JOUÉ, PAS NATIF (cf. `volet`) : les pages montent par
// `transform`, et `scrollY` dit de combien — NavaleMur, qui mesure des
// rectangles plus `scrollY`, retrouve ainsi ses positions de mise en page.
let defil = 0;
Object.defineProperty(window, 'scrollY', { configurable: true, get: () => defil });
Object.defineProperty(window, 'pageYOffset', { configurable: true, get: () => defil });
const rectNatif = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function () {
  const r = rectNatif.call(this);
  if (this === scene || !scene.contains(this)) return r;
  const s = rectNatif.call(scene);
  return new DOMRect((r.left - s.left) / echelle, (r.top - s.top) / echelle, r.width / echelle, r.height / echelle);
};

/* ═══════════════════════════════ LE MONDE ═══════════════════════════════ */

const NOMS = ['Toi', 'Marie', 'Léo', 'Sam'];
const JOUEURS: Player[] = NOMS.map((name, i) => ({
  id: `p${i}`, room_code: 'TUILE', name, is_host: i === 0, can_control: i === 0,
  color: '#e5e7eb', is_fictional: false, joined_at: '2026-10-11T20:00:00.000Z',
})) as Player[];
const MOI = JOUEURS[0];
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Le hasard, rejoué à l'identique à chaque boucle (gerbes, esquives). */
let graine = 1;
function hasard() {
  graine |= 0; graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = hasard;

// Les flottes, posées à la main sur la grille 7×7 (case = ligne × 7 + colonne).
// Elles se recouvrent par endroits : c'est la règle — une case peut toucher
// plusieurs plateaux, et le chiffre de la grille le dit.
const b = (id: Flotte[number]['id'], ...cases: number[]) => ({ id, cases });
const FLOTTES: Record<string, Flotte> = {
  // Moi : la flotte d'origine (Pétrolier, deux Remorqueurs, Contrebandier).
  p0: [b('petrolier', 1, 8, 15), b('remorqueur-1', 5, 12), b('remorqueur-2', 31, 32), b('contrebandier', 6)],
  p1: [b('petrolier', 43, 44, 45), b('remorqueur-1', 21, 28), b('remorqueur-2', 18, 19), b('contrebandier', 36)],
  p2: [b('petrolier', 10, 17, 24), b('remorqueur-1', 37, 38), b('remorqueur-2', 39, 40), b('contrebandier', 0)],
  p3: [b('petrolier', 23, 24, 25), b('remorqueur-1', 28, 35), b('remorqueur-2', 12, 19), b('contrebandier', 48)],
};
/** Les onze tirs déjà joués, dans l'ordre de la table. */
const HISTORIQUE: [string, number][] = [
  ['p0', 44], ['p1', 2], ['p2', 5], ['p3', 38], ['p0', 26], ['p1', 37],
  ['p2', 22], ['p3', 15], ['p0', 40], ['p1', 33], ['p2', 28],
];
/** Ceux qu'on regarde : Sam à l'eau, moi en D4, Marie sur mon Remorqueur. */
const EAU: [string, number] = ['p3', 16];
const MA_CASE = 24;
const COULE: [string, number] = ['p1', 12];

interface Monde { state: NavaleState; flottes: Record<string, Flotte>; secrets: NavaleSecrets }
let monde: Monde;
const abonnes = new Set<() => void>();
const abonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f); }; };
const emettre = (m: Monde) => { monde = m; abonnes.forEach((f) => f()); };

/** Un coup, par la vraie règle. */
function coup(m: Monde, tireur: string, cellule: number): Monde {
  const r = jouerTir(m.state, tireur, cellule, m.flottes, m.secrets, Date.now(), hasard);
  return { state: r.state, flottes: r.flottes, secrets: r.secrets };
}

function mondeInitial(jusquau: [string, number][] = HISTORIQUE): Monde {
  const ids = JOUEURS.map((p) => p.id);
  const s0 = etatInitial({ mode: 'chacun', joueurs: ids }, hasard, { mecaniques: true });
  const state: NavaleState = {
    ...s0,
    themes: { p0: 'commerce', p1: 'antique', p2: 'peche', p3: 'militaire' },
    places: ids, phase: 'tir', tireurId: ids[0], deadline: Date.now() + DUREE_TOUR_MS,
  };
  // Les cases spéciales de la partie (deux civils, une esquive), là où personne
  // ne tire pendant la boucle : secrètes, elles ne se voient pas.
  const secrets: NavaleSecrets = {
    speciales: [{ camp: 0, case: 46, type: 'civil' }, { camp: 0, case: 13, type: 'civil' }, { camp: 0, case: 3, type: 'esquive' }],
    esquive: null, trouveePar: null,
  };
  let m: Monde = { state, flottes: structuredClone(FLOTTES), secrets };
  for (const [p, c] of jusquau) m = coup(m, p, c);
  return m;
}

async function envoyer(cellule: number) {
  emettre(coup(monde, MOI.id, cellule));
  return { esquive: false };
}

function Ecran() {
  const m = useSyncExternalStore(abonner, () => monde);
  return (
    <div className="screen screen--haut">
      <RoomTopBar retour={{ libelle: 'Salon', onClick: () => {} }} />
      <NavaleTir
        room={{ code: 'TUILE' }}
        state={m.state}
        me={MOI}
        flotte={m.flottes[MOI.id] ?? null}
        players={JOUEURS}
        envoyer={envoyer}
        passer={async () => {}}
        fuite={null}
        esquiveArmee={false}
      />
    </div>
  );
}

let racine: Root | null = null;
function monter() {
  racine?.unmount();
  hote.innerHTML = '<div id="root"><div><main></main></div></div>';
  racine = createRoot(hote.querySelector('main')!);
  racine.render(<Ecran />);
}

/* ═══════════════════════════════ LE SCRIPT ═══════════════════════════════ */

/** Durée d'une boucle et fondu de reprise. */
const DUREE = 13_400;
const FONDU_ENTREE = 380;
const FONDU_SORTIE = 12_700;
/** Le geste vers le mur des plateaux : appui, glissé, lâcher, accrochage. */
const GESTE = { apparait: 9_450, appui: 9_950, lache: 10_380, pose: 10_920, course: 240 };
const DOIGT_GESTE = { x: 252, y: 712 };
let origine = 0;

const a = (ms: number) => attendre(Math.max(0, origine + ms - maintenant()));
const bouton = (i: number) => hote.querySelectorAll<HTMLButtonElement>('.navale-grille > .navale-case')[i];

function viser(el: Element, dx = 0, dy = 0) {
  const r = el.getBoundingClientRect();
  doigt.style.translate = `${r.left + r.width / 2 + dx}px ${r.top + r.height / 2 + dy}px`;
}

async function appuyer() {
  doigt.classList.add('is-down');
  doigt.classList.remove('is-tap');
  void doigt.offsetWidth;
  doigt.classList.add('is-tap');
}

async function unePartie() {
  origine = maintenant();
  graine = 1;
  monde = mondeInitial();
  monter();
  doigt.className = '';
  doigt.style.transition = 'none';
  doigt.style.translate = '330px 940px';
  void doigt.offsetWidth;
  doigt.style.transition = '';

  // 1. Sam tire à l'eau, en C3. La main passe : « À toi de tirer ».
  await a(800);
  emettre(coup(monde, ...EAU));

  // 2. Mon doigt arrive sur D4 et tire.
  await a(2100);
  const cible = bouton(MA_CASE);
  viser(cible);
  doigt.classList.add('is-on');
  await a(2850);
  await appuyer();
  await a(2960);
  cible.click();
  await a(3070);
  doigt.classList.remove('is-down');
  await a(3450);
  doigt.classList.remove('is-on');
  viser(cible, 46, 120);

  // 3. Marie tire en B6 : mon Remorqueur coule.
  await a(5900);
  emettre(coup(monde, ...COULE));

  // 4. On descend sur le mur des plateaux (le volet de l'écran de tir).
  await a(GESTE.apparait - 460);
  doigt.style.transition = 'none';
  doigt.style.translate = `${DOIGT_GESTE.x + 40}px ${DOIGT_GESTE.y + 150}px`;
  void doigt.offsetWidth;
  doigt.style.transition = '';
  await a(GESTE.apparait);
  doigt.style.translate = `${DOIGT_GESTE.x}px ${DOIGT_GESTE.y}px`;
  doigt.classList.add('is-on');
  await a(GESTE.appui);
  doigt.classList.add('is-down');
  doigt.style.transition = 'opacity 260ms var(--ease-out), scale 140ms var(--ease-out)';
  await a(GESTE.lache);
  doigt.classList.remove('is-down', 'is-on');
  doigt.style.transition = '';
  doigt.style.translate = `${DOIGT_GESTE.x + 6}px ${DOIGT_GESTE.y - GESTE.course - 70}px`;

  await a(DUREE);
}

const borne = (v: number) => Math.min(1, Math.max(0, v));
const glisse = (p: number) => 1 - Math.pow(1 - p, 3);

/** Le défilement de la page à l'instant `t` de la boucle, en px logiques :
    le doigt tire la page (1 pour 1), puis l'accrochage la pose sur le mur. */
function defilement(t: number, course: number) {
  if (t < GESTE.appui) return 0;
  const tire = GESTE.course * glisse(borne((t - GESTE.appui) / (GESTE.lache - GESTE.appui)) ** 1.15);
  if (t < GESTE.lache) return tire;
  return tire + (course - tire) * glisse(borne((t - GESTE.lache) / (GESTE.pose - GESTE.lache)));
}

/** Ce que fait le défilement de la racine dans l'app (cf. NavaleMur et le
    morphe de navale.css) : les deux pages du volet montent, et les tuiles
    du mur quittent la ligne des flottes pour s'ouvrir sur leur plateau, aux
    mêmes plages que les `animation-range` de la feuille. */
function volet(t: number) {
  const ecran = hote.querySelector<HTMLElement>('.navale-ecran');
  const page = hote.querySelector<HTMLElement>('.navale-mur-page');
  if (!ecran || !page) return;
  const course = parseFloat(page.style.getPropertyValue('--nvm-course')) || 1;
  const y = Math.min(course, defilement(t, course));
  defil = y;
  const plage = (a0: number, b0: number) => borne((y - a0 * course) / ((b0 - a0) * course));
  const actif = y > 0;
  for (const el of [ecran, page]) el.style.transform = actif ? `translateY(${-y}px)` : '';
  if (t >= GESTE.appui && t < GESTE.lache) {
    doigt.style.translate = `${DOIGT_GESTE.x}px ${DOIGT_GESTE.y - y}px`;
  }
  const replie = parseFloat(page.style.getPropertyValue('--nvm-replie')) || 0;
  const pT = plage(0, 0.78), pP = plage(0.1, 0.65), pTi = plage(0.58, 0.82);
  page.querySelectorAll<HTMLElement>('.nvm-tuile').forEach((tu) => {
    const dy = parseFloat(tu.style.getPropertyValue('--nvm-dy')) || 0;
    tu.style.transform = actif ? `translateY(${dy * (1 - pT)}px)` : '';
    tu.style.clipPath = actif ? `inset(0 0 ${replie * (1 - pT)}% 0 round 0.55rem)` : '';
  });
  page.querySelectorAll<HTMLElement>('.nvm-plateau').forEach((pl) => {
    pl.style.opacity = actif ? String(pP) : '';
    pl.style.transform = actif ? `scale(${0.94 + 0.06 * pP})` : '';
  });
  const titre = page.querySelector<HTMLElement>('.navale-mur__titre');
  if (titre) {
    titre.style.opacity = actif ? String(pTi) : '';
    titre.style.transform = actif ? `translateY(${10 * (1 - pTi)}px)` : '';
  }
}

/** Chaque image : fondu de reprise et volet. */
function cadre() {
  const t = maintenant() - origine;
  const entree = borne(t / FONDU_ENTREE);
  const sortie = borne((t - FONDU_SORTIE) / (DUREE - 120 - FONDU_SORTIE));
  hote.style.opacity = String(entree * (1 - sortie));
  if (!reduit) volet(t);
}

async function boucle() {
  for (;;) {
    try { await unePartie(); } catch (e) { console.error(e); await a(DUREE); }
  }
}

/* ═══════════════════════════════ LA LECTURE ═══════════════════════════════ */

const PAS = 1000 / 60;
const params = new URLSearchParams(location.search);
const fige = params.get('t');
const pret = () => html.setAttribute('data-pret', '');

/** Quelques images natives, pour que les observateurs de taille (le mur des
    flottes) passent, puis les rAF rejoués à l'instant figé. */
async function stabiliser() {
  for (let k = 0; k < 3; k++) { await imageNative(); await jouerImage(); }
}

async function lire() {
  void boucle();
  let decalage: number | null = null;
  const image = async (t: number) => {
    // Le temps réel pilote l'horloge virtuelle ; un onglet resté caché ne la
    // fait pas sauter de plusieurs secondes d'un coup.
    if (decalage === null || t - decalage - maintenant() > 250) decalage = t - maintenant();
    await avancer(t - decalage);
    cadre();
    imageNative().then(image);
  };
  imageNative().then(image);
}

async function figer(s: number) {
  void boucle();
  const cible = Math.max(0, s) * 1000;
  for (let v = PAS; v < cible; v += PAS) await avancer(v);
  await avancer(cible);
  cadre();
  await stabiliser();
  pret();
}

async function immobile() {
  // Mouvement réduit : la partie après les trois coups, sans doigt ni fondu.
  monde = mondeInitial([...HISTORIQUE, EAU, [MOI.id, MA_CASE], COULE]);
  monter();
  for (let v = PAS; v < 400; v += PAS) await avancer(v);
  await stabiliser();
  pret();
}

/** Point d'entrée de la vérification à la construction : rejoue la boucle en
    temps virtuel et rend la main à chaque image. */
(window as unknown as { __cyParcours?: (pas: number, fin: number, rappel: () => void) => Promise<void> }).__cyParcours = async (pas, fin, rappel) => {
  void boucle();
  for (let v = pas; v <= fin; v += pas) { await avancer(v); cadre(); rappel(); }
};

(document.fonts?.ready ?? Promise.resolve()).then(() => {
  if (params.has('parcours')) return;
  if (reduit) void immobile();
  else if (fige !== null) void figer(parseFloat(fige) || 0);
  else void lire();
});
