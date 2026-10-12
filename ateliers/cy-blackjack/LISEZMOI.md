# Atelier cy-blackjack

Tuile compilée : `public/tuiles/cy-blackjack.html`, avec ses polices à côté
(`public/tuiles/cy-*.woff2`). C'est la **vraie table du Blackjack** de Cyrose,
version « le jeu se joue sur la table ». Le composant est compilé tel quel, branché
sur un faux serveur en mémoire, et une main est jouée par un script de gestes.

## Commande

Depuis la racine du portfolio :

```
node ateliers/cy-blackjack/construire.mjs
```

La construction prend environ 40 s. Elle utilise l'esbuild et le playwright-core du
portfolio, plus Chrome (`channel: 'chrome'`). Elle lance puis coupe le serveur dev de
Cyrose sur le **port 5199**. Ses fichiers temporaires vont dans `/tmp/tuiles/cy-blackjack/`.

## Sources

- Dépôt : le worktree voisin `../cyrose-casino-table`, branche `feat/casino-table`,
  commit **7770d26** (« fix(casino): deuxième passe des retours du téléphone »).
  Le commit utilisé est inscrit en commentaire en tête de la tuile.
- Spécification : `docs/superpowers/specs/2026-10-11-casino-table-design.md` du même dépôt.
- Composants compilés (dans `web/src/`) :
  - Blackjack : `screens/blackjack/table/` (`BjTable`, `BjDock`, `useBjMises`, `useBjJeu`, `cleDock`).
  - Table commune : `screens/casino/table/` (`CasinoTable`, `TableCard`, `CartesSurTable`,
    `usePiles`, `JetonVolant`, `TableSeat`, `TableDock`, `useCommun`, `useEchelle`,
    `useEtapeResultat`…), `screens/casino/CasinoTopBar` et `casinoHelpers`.
  - Moteur : `lib/blackjack/` (`scene`, `engine`, `game`, `types`) et `lib/casino/`
    (`table/*`, `round`, `bankroll`, `session`).
- CSS : la feuille réellement servie par le serveur dev (`index.css` + Tailwind,
  `fonts.css`, `casino.css`, `table.css`), lue sur le banc `/labo-salons?cas=blackjack-invite`.
- Polices : `web/public/fonts/*-latin.woff2`.

## Ce que fait le pipeline

1. **`construire.mjs`** enchaîne toutes les étapes.
   - Il lit le CSS sur le serveur dev. `outils/banc.js` fait passer la table du banc
     aux mises, pour que sa feuille se charge.
   - Il compile `src/harness.tsx` avec esbuild. Il substitue `lib/supabase`,
     `lib/sound` et `react-router-dom` par les bouchons de `src/stubs/`, et force un
     seul React, celui de l'appli.
   - Il fige le CSS pour un écran de 390×844 : unités vh/vw/vmax remplacées, media
     queries de largeur résolues, polices en `cy-*`. Le fond du site (`body::before`
     et `::after`) passe dans `.cy-bg`, et `:active` est doublé d'une classe
     `.cy-press` pour l'appui du doigt.
   - Il élague ce CSS aux règles réellement touchées pendant une boucle et dans
     l'état fixe (`outils/collecte.js`), de 142 Ko à 22 Ko.
2. **`src/harness.tsx`** contient le téléphone mis à l'échelle, la tablée, le sabot
   préparé, le script de la main, le doigt fictif et l'état fixe du mouvement réduit.
   - **Léa est l'hôte.** C'est donc le vrai `useBjMises` qui distribue et le vrai
     `useBjJeu` qui fait jouer la banque et règle la manche.
   - L'appli doit croire qu'elle tourne sur un écran de 390×844. La tuile lui présente
     donc cette taille de fenêtre, et des mesures d'éléments non mises à l'échelle
     (`getBoundingClientRect`).
3. **`src/store.ts`** est le faux serveur. Les écritures des écrans y arrivent et
   reviennent comme un écho temps réel, avec une latence. À la donne, les trois échos
   reviennent l'un après l'autre : Marc, Inès, puis Léa.
4. **`src/horloge.ts`** gère `?t=<secondes>`. Une horloge virtuelle remplace
   `setTimeout`, `setInterval`, `requestAnimationFrame`, `performance.now` et
   `Date.now`. Elle avance d'un coup jusqu'à t. Chaque animation du document (WAAPI,
   transitions et animations CSS) est mise en pause à l'âge qu'elle a à cet instant.
   Une fois figée, la page porte `data-fige` sur `<html>`.

## Le scénario (boucle d'environ 13,9 s)

- **0 à 2,7 s — Mises.** Marc a déjà misé. Le doigt reste appuyé sur le cercle : 5
  jetons y volent depuis le dock. Pendant ce temps, Inès mise et Hugo passe. Puis
  « Confirmer la mise ».
- **2,7 à 3,3 s — Donne.** Les deux cartes de la banque sortent du sabot, la seconde
  face cachée. Puis viennent les mains de Marc, d'Inès et de Léa.
- **3,3 à 6,3 s — Tour de Léa.** La table passe au premier plan et l'anneau du chrono
  tourne. « Tirer » : 7♥, le total passe de 12 à 19. Puis « Rester ».
- **6,3 à 9,1 s — Les autres.** Tour de Marc, qui reste à 16, puis tour d'Inès, qui
  reste à 20.
- **9,1 à 10,7 s — La banque joue.** Elle retourne sa carte (13), tire un 5♦ et fait 18.
- **10,7 à 13,4 s — Résultat.** Verdicts +5, −3, +2. La mise perdue part à la
  banque, les gains sont payés puis rejoignent les piles. Le dock affiche
  « Tu gagnes 5 / Tu distribues 6 gorgées » et « Manche suivante ».
- **13,4 à 13,9 s — Fondu**, puis la boucle reprend.

**Mouvement réduit :** un état fixe, la table réglée au résultat, sans doigt.

**Affiche : 11.4** (`?t=11.4`) : la main est finie, les verdicts sont sur la table, le
bilan est dans le dock, et rien n'est en vol.

## Vérification faite (13/10/2026)

- **Reconstruction comparée à l'ancienne tuile, aux mêmes instants virtuels.**
  L'ancienne tuile n'avait pas `?t` : je lui ai injecté la même horloge.
  - 0 % de pixels différents à t = 8,9 et 11,5.
  - 0,14 à 0,33 % à t = 1,3, 3,3 et 6,1. Ce sont des bords de cartes en vol et
    d'objets à leur première image.
  - L'état fixe (mouvement réduit) est identique. Une capture sur deux montre
    0,13 % d'écart de lissage sur les cartes inclinées, sans rapport avec la
    reconstruction.
- **CSS :** les règles sont identiques à l'ancienne tuile, 138 de chaque côté.
- **Comparaison au vrai écran :** à l'état réglé, la tuile diffère du banc DEV de
  0,13 % des pixels, uniquement en sous-pixels sur les cartes inclinées.
- **Lecture en temps réel :** deux boucles de 13,9 s sans erreur JS.
- **`?t` :** figé en 0,3 à 2 s selon t. L'image ne bouge plus ensuite : deux
  captures prises à 1,5 s d'écart sont identiques.

## Limites connues

- **Ordre de la donne :** la banque est servie avant les joueurs. Sur le téléphone de
  l'hôte, l'état de table s'applique tout de suite, alors que les mains des joueurs
  arrivent par écho.
- **Poids :** environ 290 Ko de JavaScript, dont environ 190 Ko pour React.
- **Magenta figé :** l'accent est fixé sur « Magenta néon » (255 30 140). L'appli le
  tire au sort à chaque chargement.
- **Vue de l'hôte :** la barre affiche « Salon » et le menu des joueurs, et le dock de
  fin affiche « Manche suivante ».
- **Superpositions :** une main de 3 cartes recouvre en partie les totaux d'Inès et de
  Marc. Le vrai écran fait pareil à 390×844.
- **Vérifier `?t` avec Playwright :** une fois la tuile figée, `requestAnimationFrame`
  et `setTimeout` de la page sont virtuels. `page.waitForFunction` (qui scrute par
  défaut avec rAF) ne rend alors jamais la main : il faut interroger
  `document.documentElement.dataset.fige` avec des `page.evaluate`.
- **Serveur dev à froid :** au premier lancement, Vite peut réoptimiser ses
  dépendances et recharger la page du banc. Le script réessaie jusqu'à 4 fois.
