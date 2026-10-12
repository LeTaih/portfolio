// ateliers/cy-menteur/tuile.tsx
// LA TUILE DU BAR DES MENTEURS : la vraie salle (screens/menteur/salle), jouée
// comme au banc /labo-menteur — un vrai `MenteurState`, les coups passés par
// les fonctions pures du serveur (jouer, accuser, presser) — mais sur une
// partie écrite d'avance et une horloge virtuelle (cf. horloge.ts).
//
// LA MANCHE (≈ 15 s). Manche 3, la table annonce les Rois. Léa, Marc et Inès
// ont déjà posé. Hugo pose deux cartes (« deux Rois » — une Dame et un As).
// C'est à toi : le doigt crie « Menteur ! ». La main frappe la table, la pose
// se retourne, Hugo bluffait ; il tourne le barillet, la chambre est pleine.
import { remettre, semer, avancer, temps, dormir, imageReelle, heureReelle, IMAGE, mouvementReduit } from './horloge';
import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Player } from '@cy/lib/types';
import type { MenteurCarte, MenteurSecret, MenteurState } from '@cy/lib/menteur/types';
import { etatInitial, jouer, accuser, presser } from '@cy/lib/menteur/partie';
import { compter, estMensonge } from '@cy/lib/menteur/donne';
import MenteurSalle, { type ApiSalle } from '@cy/screens/menteur/salle/MenteurSalle';
import { Lumiere } from '@cy/screens/menteur/salle/lumiere';

// En avance rapide (`?t=`), le projecteur calcule toujours sa course mais ne se
// dessine que sur la dernière seconde : le dessin est le seul coût, et l'image
// finale n'en dépend pas.
let dessinerLumiere = true;
{
  const proto = Lumiere.prototype as unknown as { dessiner: (...a: unknown[]) => void };
  const dessiner = proto.dessiner;
  proto.dessiner = function (this: unknown, ...a: unknown[]) {
    if (dessinerLumiere) dessiner.apply(this, a);
  };
}

/** La durée d'un tour de boucle, fondus compris (ms). */
const DUREE = 15000;
const FONDU_ENTREE = 320;
const FONDU_SORTIE = 450;
/** L'instant de l'affiche (s) : aussi l'état fixe du mouvement réduit. */
const AFFICHE = Number('__AFFICHE__');

const NOMS = ['Toi', 'Léa', 'Marc', 'Inès', 'Hugo'];
const COULEURS = ['#ff1e8c', '#34e0f0', '#e6ff3d', '#b388ff', '#ffb627'];
const TABLE = NOMS.map((name, i) => ({
  id: `p${i}`,
  room_code: 'LABO',
  name,
  is_host: i === 0,
  can_control: i === 0,
  color: COULEURS[i],
  is_fictional: false,
  joined_at: '2026-10-10T20:00:00.000Z',
})) as unknown as Player[];
const IDS = TABLE.map((p) => p.id);
const MOI = TABLE[0];

interface Partie {
  state: MenteurState;
  secret: MenteurSecret;
}

/** La donne, écrite d'avance. Hugo (p4) tient une Dame et un As en tête de main :
    ce sont elles qu'il pose en annonçant deux Rois. */
const MAINS: Record<string, MenteurCarte[]> = {
  p0: ['roi', 'dame', 'joker', 'as', 'roi'],
  p1: ['roi', 'roi', 'as', 'dame', 'dame'],
  p2: ['as', 'roi', 'dame', 'as', 'roi'],
  p3: ['roi', 'joker', 'dame', 'as', 'dame'],
  p4: ['dame', 'as', 'roi', 'as', 'dame'],
};

/** L'état au lever de rideau : manche 3, trois poses déjà au tapis, des
    barillets qui ont déjà tourné. Tout passe par les fonctions du serveur. */
function partieInitiale(): Partie {
  const t = Date.now();
  let state = etatInitial(IDS, 'roi', compter(MAINS), t);
  state = {
    ...state,
    manche: 3,
    joueurId: 'p1',
    barillets: { p0: 1, p1: 2, p2: 0, p3: 1, p4: 2 },
    fil: [{ t: 'donne', manche: 3, carteTable: 'roi' }],
  };
  const mains = { ...MAINS };
  const tapis: MenteurSecret['tapis'] = [];
  for (const [id, indices] of [['p1', [0, 2]], ['p2', [1]], ['p3', [0, 1, 2]]] as [string, number[]][]) {
    state = jouer(state, id, indices.length, t);
    tapis.push({ joueurId: id, cartes: indices.map((i) => mains[id][i]) });
    mains[id] = mains[id].filter((_, i) => !indices.includes(i));
  }
  // La chambre pleine d'Hugo : celle qu'il s'apprête à tourner.
  return { state, secret: { mains, tapis, balles: { p0: 4, p1: 5, p2: 3, p3: 2, p4: 2 } } };
}

// ── Le faux serveur : le même enchaînement que le banc (labo/MenteurLab).
let partie = partieInitiale();
let majTable: (p: Partie) => void = () => {};
const maj = (f: (p: Partie) => Partie) => {
  partie = f(partie);
  majTable(partie);
  return Promise.resolve();
};
const jouerPour = (id: string, indices: number[]) =>
  maj((p) => {
    const main = p.secret.mains[id] ?? [];
    return {
      state: jouer(p.state, id, indices.length, Date.now()),
      secret: {
        ...p.secret,
        mains: { ...p.secret.mains, [id]: main.filter((_, i) => !indices.includes(i)) },
        tapis: [...p.secret.tapis, { joueurId: id, cartes: indices.map((i) => main[i]) }],
      },
    };
  });
const accuserPour = (id: string) =>
  maj((p) => {
    const cartes = p.secret.tapis[p.secret.tapis.length - 1].cartes;
    return { ...p, state: accuser(p.state, id, cartes, estMensonge(cartes, p.state.carteTable), Date.now()) };
  });
const api: ApiSalle = {
  jouer: (indices) => jouerPour('p0', indices),
  accuser: () => accuserPour('p0'),
  passer: () => Promise.resolve({ passe: false }),
  presser: () =>
    maj((p) => {
      if (!p.state.duel || p.state.duel.issue !== null) return p;
      return { ...p, state: presser(p.state, p.secret.balles[p.state.duel.perdantId], Date.now()) };
    }),
  continuer: () => Promise.resolve(),
  present: () => Promise.resolve(),
  rejouer: () => Promise.resolve(),
};

function Table() {
  const [p, setP] = useState(partie);
  useEffect(() => {
    majTable = setP;
    return () => {
      majTable = () => {};
    };
  }, []);
  return (
    <MenteurSalle
      roomCode="LABO"
      state={p.state}
      players={TABLE}
      me={MOI}
      main={p.secret.mains[MOI.id] ?? []}
      isHost={false}
      api={api}
    />
  );
}

// ── La scène de la tuile.
const scene = document.getElementById('cy-stage') as HTMLElement;
const hote = document.getElementById('cy-host') as HTMLElement;
const doigt = document.getElementById('cy-finger') as HTMLElement;
let echelle = 1;
function ajuster() {
  echelle = innerWidth / 390;
  scene.style.transform = `scale(${echelle})`;
}
ajuster();
addEventListener('resize', ajuster);

let racine: Root | null = null;
function monter() {
  racine?.unmount();
  hote.innerHTML = '';
  const div = document.createElement('div');
  hote.append(div);
  racine = createRoot(div);
  racine.render(<Table />);
}

// ── Le doigt.
const sel = (s: string) => hote.querySelector(s) as HTMLElement | null;
function viser(el: Element, fx = 0.5, fy = 0.5) {
  const r = el.getBoundingClientRect();
  const s = scene.getBoundingClientRect();
  doigt.style.translate = `${(r.left - s.left + r.width * fx) / echelle}px ${(r.top - s.top + r.height * fy) / echelle}px`;
}
async function jusqua(cond: () => unknown, max = 12000) {
  const t0 = temps();
  while (!cond()) {
    if (temps() - t0 > max) throw new Error('attente');
    await dormir(IMAGE);
  }
}
async function toucher(el: HTMLElement) {
  doigt.classList.add('is-down');
  doigt.classList.remove('is-tap');
  void doigt.offsetWidth;
  doigt.classList.add('is-tap');
  el.classList.add('cy-press');
  await dormir(110);
  el.click();
  await dormir(60);
  doigt.classList.remove('is-down');
  el.classList.remove('cy-press');
}

const reperes: Record<string, number> = {};
const noter = (n: string) => (reperes[n] = Math.round(temps()));

/** La manche, en gestes. Tout est en heure virtuelle. */
async function scenario() {
  // Hugo pose sa Dame et son As — « deux Rois ».
  await dormir(150);
  noter('hugo-pose');
  await jouerPour('p4', [0, 1]);
  // Le doigt n'attend pas son tour pour se placer.
  await dormir(1750);
  const menteur = () => sel('.salle .geste--menteur') as HTMLButtonElement | null;
  doigt.style.transition = 'none';
  doigt.style.translate = '300px 900px';
  void doigt.offsetWidth;
  doigt.style.transition = '';
  viser(menteur()!);
  doigt.classList.add('is-on');
  // À toi : ta main se lève, les gestes s'allument.
  await jusqua(() => !menteur()!.disabled && sel('.salle[data-mon-tour]'));
  noter('a-toi');
  await dormir(380);
  viser(menteur()!);
  await dormir(80);
  noter('menteur');
  await toucher(menteur()!);
  await dormir(200);
  doigt.style.translate = '250px 905px';
  doigt.classList.remove('is-on');
  // La salle joue le cri, la révélation, puis Hugo prend son revolver. Comme
  // au banc, la table attend la fin de la mise en scène (le duel ouvert, la
  // file vide) ; Hugo touche sa détente aussitôt (DETENTE_VITE_S).
  await jusqua(() => partie.state.phase === 'duel' && !sel('.salle[data-occupe]'), 14000);
  noter('pret');
  await dormir(250);
  noter('presse');
  await api.presser();
}

// ── La boucle.
function fondu() {
  const v = temps();
  const o = Math.min(1, v / FONDU_ENTREE, (DUREE - v) / FONDU_SORTIE);
  hote.style.opacity = String(Math.max(0, o));
}

function lancer() {
  remettre();
  semer(20261012);
  partie = partieInitiale();
  doigt.classList.remove('is-on', 'is-down', 'is-tap');
  doigt.style.transition = 'none';
  doigt.style.translate = '300px 900px';
  monter();
  fondu();
  scenario().catch((e) => console.error('tuile :', e));
}

const params = new URLSearchParams(location.search);
const fige = params.has('t') ? Math.max(0, Math.min(DUREE / 1000, Number(params.get('t')) || 0)) : null;
const reduit = mouvementReduit;

async function allerA(ms: number) {
  while (temps() < ms) {
    // Au pas de 50 ms tant qu'on est loin (la salle borne ses pas à 50 ms),
    // puis image par image sur la dernière seconde.
    const loin = ms - temps() > 1000;
    dessinerLumiere = !loin;
    await avancer(Math.min(loin ? 50 : IMAGE, ms - temps()));
    fondu();
  }
}

/** Lu par les vérifications : images réelles, pas virtuels, pire écart (ms). */
const stats = { images: 0, pas: 0, pireEcart: 0, ou: 0, tours: 0 };
(window as unknown as { __cyStats: unknown }).__cyStats = stats;

async function jouerEnBoucle() {
  for (;;) {
    lancer();
    let reserve = 0;
    let avant = heureReelle();
    while (temps() < DUREE) {
      await new Promise((ok) => imageReelle(ok));
      const ici = heureReelle();
      stats.images++;
      if (stats.images > 2 && ici - avant > stats.pireEcart) {
        stats.pireEcart = Math.round(ici - avant);
        stats.ou = Math.round(temps());
      }
      reserve += Math.min(ici - avant, 100);
      avant = ici;
      let n = 0;
      while (reserve >= IMAGE * 0.75 && n < 3 && temps() < DUREE) {
        await avancer();
        fondu();
        stats.pas++;
        reserve -= IMAGE;
        n++;
      }
      if (reserve > IMAGE * 3) reserve = 0;
    }
    stats.tours++;
    (window as unknown as { __cyReperes: unknown }).__cyReperes = { ...reperes };
  }
}

async function demarrer() {
  await (document.fonts?.ready ?? Promise.resolve());
  if (fige !== null || reduit) {
    const t0 = heureReelle();
    lancer();
    await allerA((fige ?? AFFICHE) * 1000);
    if (reduit) doigt.style.display = 'none';
    (window as unknown as { __cyPret: unknown }).__cyPret = { ms: Math.round(heureReelle() - t0), reperes };
    document.documentElement.dataset.pret = '1';
    return;
  }
  void jouerEnBoucle();
}
void demarrer();
