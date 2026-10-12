# Atelier `cy-salon` — le salon de Cyrose

Tuile **compilée** : les vrais écrans de Cyrose, compilés par esbuild, branchés
sur un faux serveur en mémoire et joués par un doigt fictif.

```
node ateliers/cy-salon/construire.mjs        # depuis la racine du portfolio
ANALYSE=1 node ateliers/cy-salon/construire.mjs   # + les 25 plus gros modules du JS
```

Sortie : `public/tuiles/cy-salon.html` (~490 Ko, autonome). Polices :
`cy-archivo-400-latin`, `cy-space-mono-400/700-latin`, `cy-syne-700-latin`
(déjà présentes, copiées depuis `web/public/fonts` si elles manquent).

## Sources

- `../cyrose_new/web` (worktree sur `feat/poker`, commit `4713e34`). Les fichiers
  compilés ici sont identiques sur `main` (`8218dc7`, qui a fusionné
  `feat/casino-table`) : entre les deux, rien ne diffère dans les écrans du salon ;
  la seule différence dans `index.css` est une règle du casino à ≥ 48rem,
  hors de propos à 390 px. `feat/salon-code-libre` (`ee117e2`) est déjà fusionnée
  dans `main` ; elle ne change que le salon introuvable (ouvrir un mot libre),
  absent de la scène.
- Écrans montés tels quels : `screens/Home.tsx`, `screens/NameEntry.tsx`
  (+ `shared/RoomPeek`), `screens/RoomHub.tsx` (+ `shared/RoomCodeCard`,
  `PlayerList`, `CaseSobre`, `GameScene`), `shared/GamePicker.tsx` →
  `screens/GameCatalogue.tsx`, `screens/Lobby.tsx` (+ `salon/SalonDeJeu`,
  `SalonJoueurs`, `SalonLancement`, `AjoutJoueur`, `shared/RoomGameLine`),
  `screens/Game.tsx` (+ `QuestionReveal`, `PlayersMenu`), `context/SalonContext`.
- CSS : `fonts.css`, `index.css`, `flyer.css`, `qreveal.css`, passés par Tailwind
  (config de `web/`, `content` = les seuls fichiers compilés), puis élagués et gelés
  pour 390×844 (cf. plus bas).
- Références visuelles : `/labo-salons?cas=cyrose-hote&nu=1`, `/jeux` et l'accueil
  `/` du serveur DEV. `/labo-bar/salon` et `/labo-bar/accueil` sont la DA
  d'alt.cyrose.fr (Bar des menteurs) : regardés, non retenus — la tuile montre
  cyrose.fr, comme celle du Blackjack.

## Ce qui est remplacé

- `entree.tsx` remplace `RoomScreen` (qui lit la base via `useRoom`) par le même
  aiguillage (pas assis → NameEntry ; `game === 'none'` → RoomHub ; Cyrose au
  salon → Lobby ; en partie → Game), branché sur `faux-serveur.ts`.
- `stubs/supabase.ts` : `createRoom` (560 ms) et `upsertPlayer` (420 ms) écrivent
  dans le faux serveur ; tout le reste est no-op (l'écran a déjà appliqué en local).
  `supabase.from/rpc` répondent vide : pas de jeu premium, pas d'abonné.
- `stubs/identity.ts` : la session est déjà là (`p-lea`).
- `stubs/roomUrls.ts` : le lien de partage et le QR pointent sur
  `https://cyrose.fr/licorne`, pas sur la page hôte.
- `questions_formatted.json` réduit à deux cartes réelles (un duel, un vote).
- `GamePicker.tsx` : son portail vise `#cy-portail` au lieu de `document.body`
  (remplacement textuel au chargement, vérifié par le script).
- `prelude.ts` : un `localStorage` en mémoire, pré-rempli comme chez quelqu'un
  qui revient (pseudo « Léa » mémorisé, déjà entré dans un salon → accueil sans
  le bloc d'explication).
- Tirage fixe (`graine(27)`) : invite « À quoi on joue ? », Léa en rose, la même
  carte à chaque boucle.

## Gel du CSS pour 390×844

`vh/dvh/svh/vw/vmin/vmax` → px ; requêtes `@media` jugées pour un téléphone
390×844 au doigt (largeur, hauteur, `hover: none`, `pointer: coarse`) ;
`prefers-reduced-motion` conservé. `body` → `#cy-stage`, `body::before/::after`
(grain et halos) → `.cy-bg::before/::after` ; `data-fond` posé sur `<body>` par
`useFond` est recopié sur la scène. `:active` → `.cy-press` (l'appui du doigt).
Règles élaguées si une de leurs classes n'apparaît pas dans le JS (ou n'y est pas
fabriquée par un gabarit `prefixe-${…}`), thèmes flyer/bar/halloween retirés,
`@keyframes` et `@font-face` inutilisés retirés, polices latin seules.

## Temps et `?t=`

`horloge.ts` : en lecture normale rien n'est touché. Avec `?t=<s>` ou en
mouvement réduit, `setTimeout/setInterval/requestAnimationFrame/performance.now/
Date.now` passent sur une horloge virtuelle avancée minuteur par minuteur jusqu'à
l'instant voulu (React rend entre deux) ; chaque animation CSS/transition est
suspendue et posée à `currentTime = instant − naissance`. Quand c'est prêt,
`<html data-pret>` est posé. La scène est ancrée sur un horaire absolu (`T` dans
`entree.tsx`) : lecture réelle et `?t=` donnent les mêmes images aux mêmes
instants (écart mesuré < 2 ms). `window.__cyMarques` liste les gestes d'une boucle.

## Limites

- Les arrivées de joueurs n'ont pas d'animation : c'est le cas dans l'appli
  (la ligne apparaît ; seule la cascade `rise` joue au montage du salon).
- Pas de clavier virtuel sur la feuille du pseudo (pseudo déjà mémorisé).
- Le compteur de la barre de jeu affiche 29 puis 28 (questions avant la pause
  stats), comme en vrai.
- Le grain animé du fond (`raveGrain`, SVG feTurbulence) coûte cher sans GPU :
  en Chrome headless sans `--use-angle=metal`, la page rame ; normal avec GPU
  (16,7 ms par image, aucune image > 50 ms sur deux boucles).
