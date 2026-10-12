# Tuile cy-purple — Purple, le pari de comptoir de Cyrose

Méthode **compilée** : la vraie table (`PurpleTable`) et le vrai reducer
(`placeBet`), compilés par esbuild, montés sur un état en mémoire et joués par
de vrais clics sur les vrais boutons.

## Reconstruire

    node ateliers/cy-purple/construire.mjs      # depuis la racine du portfolio

Il faut `../cyrose_new/web` avec ses `node_modules` (Tailwind, postcss,
autoprefixer, react, @letele/playing-cards) et Chrome pour playwright-core.
`CYROSE=<chemin>` remplace `../cyrose_new`. Le script écrit
`public/tuiles/cy-purple.html` et copie les polices `cy-*.woff2` manquantes.

## Sources (Cyrose)

Branche `feat/poker` @ `4713e34`. Les fichiers de Purple y sont identiques à
`main` (`8218dc7`, la version la plus récente). Dernière refonte : « l'affiche »,
commits du 2/10/2026 (`4607941`, `1f17865`, `7f885e7`).

- `web/src/screens/purple/` : PurpleTable, PurpleTopBar, Card, Compteur, Pave, Fleches,
  Bande, Rate, Sticker, affiche.ts, purple.css
- `web/src/lib/purple/` : reducer, bet, deck, card, types
- `web/src/screens/shared/NavBar.tsx`, `PlayersMenu.tsx`
- `web/src/fonts.css`, `web/src/index.css` (Tailwind)
- Référence visuelle : le banc `/labo-purple?scene=…&nu=1` (scènes `sticker`,
  `rate`, `tirage-purple`), capturé à 390×844

## Fichiers

- `tuile.tsx` : l'entrée. Elle contient la tablée (Léa, Marc, Inès, Hugo), l'état de
  départ, le paquet arrangé, l'horloge virtuelle et le doigt.
- `stubs/supabase.ts` : faux serveur, aucune écriture. `stubs/router.tsx` : `<Link>` → `<a>`.
- `@letele/playing-cards` est réduit aux 14 cartes du scénario (liste `CARTES` dans
  `construire.mjs`). **Si tu changes une carte du scénario, mets la liste à jour.**

## Horloge virtuelle

Les `window.setTimeout` de la table (fin du retournement, verrou de l'écran
raté) suivent l'horloge V. Chaque animation ou transition CSS est mise en pause
à sa naissance, et son `currentTime` est recalculé depuis V. Les gestes sont des
événements datés, rendus en `flushSync`. Résultat : `?t=` et la lecture en
temps réel donnent la même image au même instant, et un onglet caché fige la
scène au lieu de la désynchroniser. `window.__cyAller(s)` sert à l'élagage.

## Élagage de la CSS

Tout le parcours de la boucle est joué dans Chrome, toutes les 50 ms. On ne
garde que les règles qui touchent un élément à un moment ou un autre (après
retrait des pseudo-éléments et de :hover, :active, :focus).

- Les `@media` sont évalués pour un téléphone 390×844, sauf
  `prefers-reduced-motion`, qui est gardé.
- `vw`, `dvh` et `env(safe-area-*)` sont figés en px (safe-area à 0, comme cy-blackjack).
- `body::before` et `body::after` (grain et halos du site, cachés sous #root
  dans l'appli) sont écartés.

## Limites

- `rigWin: 0` (tirage honnête) : la triche invisible de Purple (20 % par défaut)
  est coupée pour que la boucle soit identique à chaque tour. Elle ne se voit pas à l'écran.
- `--magenta` est fixé à 255 30 140 : l'appli le tire au sort, mais il ne
  touche pas l'aplat de Purple.
- L'appui `:active` est rejoué par la classe `.cy-press`, avec la même règle
  (`brightness(0.86)`).
- La JS fait 392 Ko : React, plus les SVG des figures (R♠, D♥, D♣, V♦).
