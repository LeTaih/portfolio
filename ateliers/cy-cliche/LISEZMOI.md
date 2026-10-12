# Atelier cy-cliche — Cliché(s)

Tuile **compilée** : les vrais écrans de Cliché (Cyrose) montés sur un faux serveur
en mémoire, joués par un script de gestes.

## Reconstruire

```sh
node ateliers/cy-cliche/construire.mjs              # depuis la racine du portfolio
SANS_ELAGAGE=1 node ateliers/cy-cliche/construire.mjs   # itération rapide, CSS non élagué
```

Écrit `public/tuiles/cy-cliche.html`, `public/tuiles/cy-cliche/*.jpg` (les tirages) et,
s'il manque, `public/tuiles/cy-anton-400-latin.woff2`. Il faut Chrome installé
(playwright-core, `channel: 'chrome'`) et `../cyrose_new/web/node_modules`.

## Sources

- Dépôt `../cyrose_new`, branche `feat/poker`, commit `4713e34` (les écrans de
  Cliché sont identiques sur `main` 8218dc7 ; dernier changement :
  `beda0b0 refactor(salon): Clichés passe sur les briques du salon`).
- Compilés tels quels : `web/src/screens/cliche/Cliche.tsx` (racine + NavBar),
  `ClicheRank.tsx` (vote dnd-kit), `ClicheReveal.tsx`, `ui.tsx`, `useCountdown`,
  `useHostAdvance`, `useHostPoll`, `myPhotos`, `serverClock`, `clicheHelpers`,
  `screens/shared/NavBar.tsx`, `@dnd-kit/*`, React 19.
- CSS : `web/src/index.css` passé par le Tailwind/autoprefixer du dépôt (contenu
  restreint aux fichiers ci-dessus), figé pour 390×844 (`@media` de taille tranchées,
  `dvh/vw` en px, `body::before/after` → `.cy-bg`), puis élagué d'après le DOM d'une
  boucle jouée (lecture + mouvement réduit).
- Thème : Rave Acid par défaut, `--magenta: 255 30 140` (comme cy-blackjack), sans
  saison Halloween. Les scènes « Bar des menteurs » (`labo/bar/scenes/cliche`,
  alt.cyrose.fr) n'ont pas été retenues : c'est cyrose.fr qui est montré.

## Fichiers

- `tuile.tsx` : cadre 390×844, tablée, scénario, `?t=`, mouvement réduit.
- `horloge.ts` : temps virtuel (setTimeout/setInterval/rAF/performance.now/Date.now).
  En lecture il suit le temps réel ; avec `?t=` (ou en mouvement réduit) il déroule la
  partie en accéléré jusqu'à l'instant voulu puis fige (~0,2 s). Les vraies horloges
  restent sur `window.__cyVrai` (élagage, vérifications).
- `store.ts` : faux serveur (salle, joueurs, écho temps réel avec latence,
  `reveal` côté serveur).
- `stubs/` : `lib/supabase`, `lib/clicheApi`, `react-router-dom`, `lib/sound`,
  `useUploadQueue` (IndexedDB) remplacés ; les phases jamais montées (salon, brief,
  prise de vue, scores) remplacées par `absent.tsx` pour ne pas embarquer le salon.
- `photos.js` : les cinq tirages « un truc qui brille », peints au canvas (boule à
  facettes, guirlande, cœur au cierge magique, sequins, néon de bar) avec grain, halo,
  vignettage et main un peu penchée. Aucune photo de personne.
- `modele.html`, `collecte.js` (élagage CSS).

## Scénario (12,9 s)

Manche 1, classement 1/5 « UN TRUC QUI BRILLE », Léa (ce téléphone, hôte) avec
Marc, Inès, Hugo, Sam. Les tirages arrivent (2, puis 3, puis 4), la table vote,
le doigt glisse la boule à facettes en 1re place puis les sequins en 2e, valide ; Inès
vote la dernière, l'hôte déclenche la révélation : meilleur cliché Inès +11, le pouce
fait défiler jusqu'aux autres tirages. Fondu, reprise.

Affiche conseillée : `affiche: 5.45` (podium posé, doigt sur « Valider mon podium »).
Mouvement réduit : même instant, sans doigt.

## Limites

- Le minuteur s'affiche en carré (conique décalé) : la classe `cl-timer-ring` de
  `screens/cliche/ui.tsx` n'a aucune règle CSS dans Cyrose. C'est le rendu réel de
  cyrose.fr, reproduit tel quel.
- Les tirages arrivent un par un dans l'état (cas « chargement tardif » que l'écran
  gère) ; le vrai serveur les fournit d'un coup au début du classement.
- Avec `?t=`, transitions et animations CSS sont coupées : l'image figée montre leur
  état d'arrivée (au lieu d'un état intermédiaire).
- Le banc DEV n'expose que le salon de Cliché ; la référence visuelle a été faite en
  montant `Cliche.tsx` dans l'appli en dev (`/labo-salons?cas=cliche-hote&nu=1`, CSS
  réelle) avec les mêmes tirages.
