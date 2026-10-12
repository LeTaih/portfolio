// LA TUILE « LE SALON » — le harnais.
//
// Les écrans sont les VRAIS composants de Cyrose (Home, NameEntry, RoomHub,
// GamePicker/GameCatalogue, Lobby, Game), compilés depuis ../cyrose_new/web.
// Ce fichier ne fait que trois choses :
//   1. remplacer RoomScreen, qui lit la base (useRoom), par un aiguillage
//      identique branché sur le faux serveur (faux-serveur.ts) ;
//   2. mettre l'écran de 390×844 à l'échelle de l'iframe ;
//   3. jouer la scène : un doigt fictif touche les vrais boutons (click()).
import './prelude';
import { attendre, avancerJusqua, FIGE, interpoler, REDUIT, VIRTUEL } from './horloge';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Home from '@cy/screens/Home';
import NameEntry from '@cy/screens/NameEntry';
import RoomHub from '@cy/screens/RoomHub';
import Lobby from '@cy/screens/Lobby';
import Game from '@cy/screens/Game';
import Centered from '@cy/components/Centered';
import { SalonProvider } from '@cy/context/SalonContext';
import { visiblePlayers } from '@cy/lib/players';
import { MOI, serveur, useServeur } from './faux-serveur';
import { remettreStockage } from './prelude';

/** Durée d'une boucle (s), fondu de reprise compris. */
const DUREE = 13.8;
/** L'instant montré en mouvement réduit : le salon, la tablée au complet. */
const INSTANT_REDUIT = 6.0;

// ---------------------------------------------------------------- le cadre
const L = 390;
const H = 844;
const scene = document.getElementById('cy-stage') as HTMLElement;
const hote = document.getElementById('cy-host') as HTMLElement;
const doigt = document.getElementById('cy-finger') as HTMLElement;
let echelle = 1;
function ajuster() {
  echelle = (document.documentElement.clientWidth || L) / L;
  scene.style.transform = `scale(${echelle})`;
  document.body.style.height = `${Math.round(H * echelle)}px`;
}
ajuster();
addEventListener('resize', ajuster);
// L'appli se croit sur un téléphone de 390×844 : c'est ce que voient ses calculs.
Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => L });
Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => H });
// Pas de clavier virtuel à suivre (NameEntry s'en passe si visualViewport manque).
Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => null });
// useFond pose data-fond sur <body> ; le fond de la tuile vit sur la scène.
new MutationObserver(() => {
  const f = document.body.dataset.fond;
  if (f) scene.dataset.fond = f;
  else delete scene.dataset.fond;
}).observe(document.body, { attributes: true, attributeFilter: ['data-fond'] });

// ---------------------------------------------------------------- RoomScreen, sans la base
// Même aiguillage que screens/RoomScreen.tsx (Room) : pas assis → NameEntry ;
// salon sans jeu → RoomHub ; Cyrose au salon → Lobby ; en partie → Game.
function Salon() {
  const { room, players: tous } = useServeur();
  if (!room) return <Centered>Chargement…</Centered>;
  const players = visiblePlayers(tous, room.game, room.uc?.config?.solo === true);
  const me = players.find((p) => p.id === MOI);
  if (!me)
    return (
      <NameEntry
        room={room}
        players={players}
        allPlayers={tous}
        playerId={MOI}
        isHost={room.host_id === MOI}
        refreshPlayers={async () => {}}
      />
    );
  const isHost = room.host_id === MOI;
  const canControl = isHost || me.can_control;
  const applyRoom = serveur.poserRoom;
  let content;
  if (room.game === 'none') content = <RoomHub room={room} players={players} isHost={isHost} applyRoom={applyRoom} />;
  else if (room.state === 'lobby')
    content = <Lobby room={room} players={players} isHost={isHost} canControl={canControl} applyRoom={applyRoom} />;
  else content = <Game room={room} players={players} canControl={canControl} applyRoom={applyRoom} />;
  return (
    <SalonProvider room={room} players={tous} isHost={isHost} applyRoom={applyRoom}>
      {content}
    </SalonProvider>
  );
}

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:code" element={<Salon />} />
      </Routes>
    </MemoryRouter>
  );
}

let racine: Root | null = null;
function monter() {
  racine?.unmount();
  hote.scrollTop = 0;
  hote.innerHTML = '<div id="root"></div><div id="cy-portail"></div>';
  delete document.body.dataset.fond;
  racine = createRoot(hote.querySelector('#root') as HTMLElement);
  racine.render(<App />);
}

// ---------------------------------------------------------------- le doigt
// Un tirage pseudo-aléatoire fixe : même invite, même question, mêmes couleurs
// à chaque boucle.
function graine(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function trouver<T extends Element = HTMLElement>(sel: string, ms = 6000): Promise<T> {
  const t0 = performance.now();
  for (;;) {
    const el = hote.querySelector<T>(sel);
    if (el) return el;
    if (performance.now() - t0 > ms) throw new Error(`attente : ${sel}`);
    await attendre(30);
  }
}
function centre(el: Element, ax = 0.5, ay = 0.5) {
  const r = el.getBoundingClientRect();
  const s = scene.getBoundingClientRect();
  return { x: (r.left - s.left + r.width * ax) / echelle, y: (r.top - s.top + r.height * ay) / echelle };
}
function poserDoigt(x: number, y: number, glisse = true) {
  if (!glisse) doigt.style.transition = 'none';
  doigt.style.translate = `${x}px ${y}px`;
  if (!glisse) {
    void doigt.offsetWidth;
    doigt.style.transition = '';
  }
}
function viser(el: Element, ax = 0.5, ay = 0.5) {
  const { x, y } = centre(el, ax, ay);
  poserDoigt(x, y);
}
async function toucher(el: HTMLElement, ax = 0.5, ay = 0.5) {
  doigt.classList.add('is-down');
  doigt.classList.remove('is-tap');
  void doigt.offsetWidth;
  doigt.classList.add('is-tap');
  el.classList.add('cy-press');
  await attendre(120);
  // Un vrai clic, à l'endroit du doigt : Game lit clientX (le quart gauche recule).
  const r = el.getBoundingClientRect();
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + r.width * ax, clientY: r.top + r.height * ay })
  );
  await attendre(60);
  doigt.classList.remove('is-down');
  el.classList.remove('cy-press');
}
const doux = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

// ---------------------------------------------------------------- la scène
const ARRIVEES = [
  { id: 'p-marc', name: 'Marc', color: '#34e0f0' },
  { id: 'p-ines', name: 'Inès', color: '#e6ff3d' },
  { id: 'p-hugo', name: 'Hugo', color: '#b388ff' },
];

// Les repères de la boucle (vérification) : window.__cyMarques = [[nom, s], …].
const marques: Array<[string, number]> = [];
(window as unknown as { __cyMarques: typeof marques }).__cyMarques = marques;

// L'horaire de la boucle (s). Chaque geste est ANCRÉ sur cet horaire, pas
// enchaîné au précédent : la lecture réelle et `?t=` montrent la même image au
// même instant, même si un rendu a pris du retard.
const T = {
  visOuvre: 0.55, tapOuvre: 1.1,
  visParti: 2.15, tapParti: 2.72, lacheParti: 3.1,
  arrivees: [3.85, 4.5, 5.15],
  visPick: 5.7, tapPick: 6.26,
  visCarte: 6.86, tapCarte: 7.4,
  visGlisse: 8.0, appuiGlisse: 8.44, glisse: 8.52, dureeGlisse: 0.62,
  visLancer: 9.26, tapLancer: 9.78, lacheLancer: 10.2,
  visSuite: 11.4, tapSuite: 11.95, lacheSuite: 12.4,
  fondu: DUREE - 0.46,
};

async function jouer() {
  const t0 = performance.now();
  marques.length = 0;
  (window as unknown as { __cyT0: number }).__cyT0 = t0;
  const marquer = (nom: string) => marques.push([nom, Math.round(performance.now() - t0) / 1000]);
  const jusqua = (s: number) => attendre(Math.max(0, t0 + s * 1000 - performance.now()));
  Math.random = graine(27);
  remettreStockage();
  serveur.vider();
  doigt.classList.remove('is-on', 'is-down', 'is-tap');
  poserDoigt(330, 940, false);
  marquer('debut');
  monter();
  hote.classList.remove('is-out');

  // 1. L'accueil. Le doigt tape « J'ouvre » : le salon se crée (aller-retour).
  const ouvre = await trouver('.home-act--create');
  await jusqua(T.visOuvre);
  viser(ouvre, 0.42, 0.55);
  doigt.classList.add('is-on');
  await jusqua(T.tapOuvre);
  marquer('ouvre');
  await toucher(ouvre);

  // 2. Le pseudo : la feuille monte sur l'aperçu du salon, « Léa » est déjà là.
  const parti = await trouver<HTMLElement>('.name-sheet .btn');
  await jusqua(T.visParti);
  viser(parti);
  await jusqua(T.tapParti);
  marquer('parti');
  await toucher(parti);
  await jusqua(T.lacheParti);
  doigt.classList.remove('is-on');

  // 3. Le salon : le code, et la tablée qui arrive un à un.
  await trouver('.hub-pick');
  for (const [i, j] of ARRIVEES.entries()) {
    await jusqua(T.arrivees[i]);
    serveur.ajouterJoueur(j);
  }

  // 4. « À quoi on joue ? » → le catalogue → Cyrose.
  await jusqua(T.visPick);
  const pick = await trouver<HTMLElement>('.hub-pick');
  viser(pick, 0.5, 0.5);
  doigt.classList.add('is-on');
  await jusqua(T.tapPick);
  marquer('pick');
  await toucher(pick);
  const carte = await trouver<HTMLElement>('.gcat-hit');
  await jusqua(T.visCarte);
  viser(carte, 0.62, 0.42);
  await jusqua(T.tapCarte);
  marquer('carte');
  await toucher(carte);

  // 5. Le salon de Cyrose : on descend jusqu'à « Lancer ».
  const lancer = await trouver<HTMLElement>('.salon-stack > button.btn');
  const course = Math.max(0, hote.scrollHeight - H);
  const x0 = 300;
  const y0 = 690;
  await jusqua(T.visGlisse);
  poserDoigt(x0, y0);
  await jusqua(T.appuiGlisse);
  doigt.classList.add('is-down');
  await jusqua(T.glisse);
  doigt.style.transition = 'opacity 260ms var(--ease-out), scale 140ms var(--ease-out)';
  await interpoler(T.dureeGlisse * 1000, (p) => {
    const d = course * doux(p);
    hote.scrollTop = d;
    doigt.style.translate = `${x0}px ${y0 - d}px`;
  });
  doigt.classList.remove('is-down');
  await attendre(120);
  doigt.style.transition = '';
  await jusqua(T.visLancer);
  viser(lancer);
  await jusqua(T.tapLancer);
  marquer('lancer');
  await toucher(lancer);
  await jusqua(T.lacheLancer);
  doigt.classList.remove('is-on');

  // 6. La partie est lancée : la première carte tombe, le doigt tape la suivante.
  const partie = await trouver<HTMLElement>('.qreveal');
  const ecran = partie.closest('.screen') as HTMLElement;
  await jusqua(T.visSuite);
  viser(ecran, 0.7, 0.62);
  doigt.classList.add('is-on');
  await jusqua(T.tapSuite);
  marquer('suivante');
  await toucher(ecran, 0.7, 0.62);
  await jusqua(T.lacheSuite);
  doigt.classList.remove('is-on');

  // 7. Le fondu de reprise.
  await jusqua(T.fondu);
  marquer('fondu');
  hote.classList.add('is-out');
  await jusqua(DUREE);
}

async function boucler() {
  for (;;) {
    try {
      await jouer();
    } catch (e) {
      console.error(e);
      await attendre(400);
    }
  }
}

const polices = document.fonts?.ready ?? Promise.resolve();
void polices.then(async () => {
  if (!VIRTUEL) return boucler();
  if (REDUIT) doigt.style.display = 'none';
  void boucler();
  const t = FIGE !== null ? FIGE % DUREE : INSTANT_REDUIT;
  await avancerJusqua(t * 1000);
  document.documentElement.dataset.pret = '';
});
