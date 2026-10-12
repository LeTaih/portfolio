# leteh.fr — le mur vivant

Date : 2026-10-12 · Statut : validé en séance, relecture complète prévue après implémentation.

## Intention

Une vitrine **grand public**, signée **leteh**, qui donne envie d'ouvrir les applis.
Pas de CV, pas d'argumentaire technique : on voit les applis *vivre*, on clique, on y va.

Projets : **Cyrose** (cyrose.fr, jeux de soirée multijoueur) et **Watchtracker**
(watchtracker.fr, suivi de séries et de films).

## La page

### Ordinateur (≥ 768 px)

- En-tête : « leteh » seul en haut à gauche, sur un fondu noir.
- Un **mur plein écran** (la page ne défile pas) partagé en deux zones :
  **Cyrose 3/4** (3 colonnes) et **Watchtracker 1/4** (1 colonne), chacune sur un fond
  teinté à la couleur de son appli.
- Chaque colonne **défile seule, en continu**, en boucle sans couture (contenu doublé,
  position repliée sur la moitié), à vitesses et sens alternés. Le survol ne l'arrête pas.
- Chaque colonne est **défilable indépendamment** (molette, doigt) ; le défilement
  automatique reprend depuis la position laissée par l'utilisateur, sans à-coup.
- Bandeau de verre en bas de chaque zone : nom, description, bouton vers le site
  (nouvel onglet). Sous Cyrose : « 18+ · L'abus d'alcool est dangereux pour la santé ».

### Téléphone (< 768 px)

- Une pastille **« Cyrose | Watchtracker »** en haut bascule entre deux murs, chacun en
  plein écran sur 2 colonnes, avec son bandeau.

### Accessibilité, référencement, légal

- Titre, descriptions et liens sont du **vrai texte** dans le HTML ; les tuiles sont
  décoratives (`aria-hidden`, iframes hors tabulation).
- `prefers-reduced-motion` : pas de défilement automatique, tuiles remplacées par leur
  affiche fixe.
- Meta en français + image Open Graph.
- Lien « Mentions légales » discret → `mentions-legales.html` (éditeur, hébergeur Vercel).

## Les tuiles

Une tuile = un **écran de téléphone qui se joue tout seul en boucle**, avec un doigt
fictif (disque blanc translucide). Pas d'interaction : c'est une vitrine.

| Cyrose (9) | Watchtracker (4) |
|---|---|
| Blackjack (table), Bataille navale, Undercover, Poker, Roulette, Bar des menteurs, Cliché, Purple, le salon | La Pile, la fiche d'une série, À venir, les amis |

### Contrat d'une tuile

- Fichier autonome `public/tuiles/<id>.html` ; ses ressources éventuelles dans
  `public/tuiles/<id>/` ; polices partagées à côté, préfixées par l'appli
  (`public/tuiles/cy-*.woff2`, `public/tuiles/wt-*.woff2`), en chemins relatifs.
  Seule dépendance externe autorisée : les images `image.tmdb.org` (Watchtracker).
- Écran logique **390×844**, mis à l'échelle sur `innerWidth` (`transform: scale`),
  recalculé au redimensionnement, aucune barre de défilement.
- Boucle infinie, 8 à 15 s, fondu de reprise.
- `prefers-reduced-motion` → un état fixe représentatif.
- `?t=<secondes>` fige la tuile à cet instant (sert aux affiches et aux vérifications).
- Aucune écriture réseau, aucun secret dans le fichier.
- Une **affiche** `public/tuiles/<id>.jpg` (image fixe) est générée par `npm run affiches`
  à l'instant déclaré dans le manifeste.

### Fabrication (approche A, retenue)

Chaque tuile a son **atelier** `ateliers/<id>/` : sources, faux serveur, script de
construction reproductible qui écrit dans `public/tuiles/`. Deux méthodes :

1. **Compilée** (préférée quand l'écran est piloté par des composants) : le vrai
   composant de l'appli, compilé par esbuild depuis le dépôt voisin, branché sur un faux
   serveur en mémoire et joué par un script de gestes. CSS de l'appli élagué aux règles
   utilisées. C'est le cas du Blackjack.
2. **Reconstituée** : HTML/CSS/JS écrit à la main à partir des composants réels (classes,
   tokens, seuils, durées). C'est le cas de la Pile. Le fichier de `public/tuiles/` est
   alors sa propre source ; l'atelier ne contient qu'un `LISEZMOI.md` (composants suivis).

Sources de vérité :
- Cyrose : la **version la plus récente** de chaque jeu. Le casino « sur la table »
  (Blackjack, Roulette, et ce qui y est passé) vient du worktree
  `../cyrose-casino-table` (branche `feat/casino-table`) ; le reste vient de
  `../cyrose_new`. Les bancs DEV (`/labo-salons`, `/labo-bar`, `/labo-navale`…) servent
  de référence visuelle.
- Watchtracker : `../watchtracker`. Affiches réelles TMDB (clé locale utilisée seulement
  pour trouver les `poster_path`, jamais écrite).

Les tuiles sont **figées et versionnées** : Vercel déploie le portfolio seul. Quand une
appli évolue, on relance l'atelier concerné.

## Architecture du site

Vite + TypeScript, sans framework.

- `index.html` — texte, bandeaux, structure des zones.
- `src/tuiles.ts` — manifeste : id, appli, titre, instant d'affiche.
- `src/boucle.ts` — logique pure du défilement (avance, repli sur une copie, nombre de
  copies nécessaires, reprise après geste) — testée.
- `src/mur.ts` — construit les colonnes, anime, gère le défilement manuel.
- `src/chargement.ts` — **une iframe n'existe que si sa tuile est proche de l'écran**
  (IntersectionObserver, marge ~1 écran) ; sinon l'affiche `.jpg` est montrée. Évite
  d'avoir 20+ iframes React actives.
- `src/bascule.ts` — pastille mobile.
- `mentions-legales.html`.

## Vérification

- Vitest sur `boucle.ts`.
- `npm run verifier` : Playwright (Chrome installé) charge le site en 1440×900 et
  390×844, vérifie l'absence d'erreur, que chaque colonne avance seule, qu'une molette
  ne bouge que sa colonne, la bascule mobile, le mouvement réduit ; capture des images.
- Chaque atelier vérifie sa tuile (captures à plusieurs instants, comparaison au vrai
  écran quand il est accessible).

## Hors périmètre

Contact, blog, autres projets, analytics, i18n.
