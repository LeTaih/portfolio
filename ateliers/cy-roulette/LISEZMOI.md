# Atelier cy-roulette

Tuile compilée : `public/tuiles/cy-roulette.html`, avec les polices `public/tuiles/cy-*.woff2`
à côté (Archivo, Syne, Space Mono : déjà présentes, rien de nouveau à copier). C'est la
**vraie table de la Roulette** de Cyrose, version « sur la table » : la `RlTable` est compilée
telle quelle, branchée sur un faux serveur en mémoire, et une manche est jouée par un script
de gestes.

## Commande

Depuis la racine du portfolio :

```
node ateliers/cy-roulette/construire.mjs
```

Compter environ 25 s. Le script utilise l'esbuild et le playwright-core du portfolio, ainsi
que Chrome (`channel: 'chrome'`). Il charge le Vite de Cyrose **sans écouter de port** (mode
middleware), et un petit serveur statique sur un port libre le temps de l'élagage. Avec
`SANS_ELAGAGE=1`, il écrit la tuile avec tout le CSS et s'arrête là (utile pour déboguer).

## Sources

- Le worktree `../cyrose-casino-table`, branche `feat/casino-table`, commit **7770d26**. Ce
  commit vient après d91a06f (« la scène de la table, règlement en quatre temps ») et
  584c1d1 (« synchro de la roue »). La tuile note en tête la branche et le commit qui ont
  servi à la construire.
- La spec : `docs/superpowers/specs/2026-10-11-casino-table-design.md` dans `../cyrose_new`.
- Les fichiers compilés (sous `web/src/`) :
  - la Roulette : `screens/roulette/table/` (`RlTable`, `RlTableVue`, `RlCases`, `RlDock`,
    `useRlMises`, `useRlRotation`, `useEtatsGeles`) ;
  - la table commune : `screens/casino/table/` (`CasinoTable`, `RlTapis`, `RlRoue`,
    `ChipPile`, `usePiles`, `TableSeat`, `TableDock`, `RackJetons`, `useEtapeResultat`,
    `useCommun`…), plus `CasinoTopBar` et `casinoHelpers` ;
  - la logique : `lib/roulette/` (`scene`, `engine`, `wheel`, `roue`, `round`, `types`) et
    `lib/casino/` (`table/*`, `round`, `bankroll`, `session`).
- Le CSS : `fonts.css`, `index.css` (Tailwind compris), `casino.css`, `table.css` et
  `roulette.css`, tels que le serveur Vite de Cyrose les rend.
- La référence visuelle : le banc `/labo-salons?cas=roulette-hote&nu=1`, avec le même état
  injecté. À l'état réglé, la tuile et le banc ne diffèrent que de 0,2 % des pixels : la
  petite roue, dont l'angle dépend de l'heure du lancer.

## Les fichiers

- `harness.tsx` : le téléphone 390×844 mis à l'échelle, la tablée, le script de la manche
  et l'état fixe du mouvement réduit. **Léa est l'hôte**. Ce sont donc les vrais
  `useRlMises` et `useRlRotation` qui lancent la bille, puis règlent la manche.
  - Le numéro tiré au lancement est forcé à 23 dans `applyRoom`.
  - Le script est calé sur l'horloge de la manche, et non sur la somme de ses pauses.
- `store.ts` : le faux serveur. Les écritures reviennent en écho, avec une latence de
  téléphone. `stubs/` remplace `lib/supabase`, `lib/sound` et `react-router-dom`.
- `horloge.js` : il est injecté avant le bundle et n'agit qu'avec `?t=`. Il rend virtuels
  `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now`, `performance.now`, les
  animations Web et les transitions ou animations CSS. Il joue alors la manche d'un trait
  jusqu'à l'instant demandé (environ 150 ms), puis la fige et pose `data-fige` sur `<html>`.
  L'image obtenue est déterministe, et identique pixel pour pixel d'une construction à
  l'autre.
- `collecte.js` : l'élagage dans la page. Il garde toute règle qui a touché un élément
  pendant la boucle en direct, à plusieurs instants `?t=`, ou en mouvement réduit. Le CSS
  passe ainsi de 137 Ko à 23 Ko, sans différence de pixels avec la version non élaguée.
- `template.html` : le cadre de la tuile, avec le doigt fictif et le fondu de reprise.

## Limites

- Le règlement plafonne les soldes (rachat et surplus des gorgées). Le gain de Marc (+37)
  dépasse donc le plafond, et une partie de ses jetons repart à la banque au dernier
  temps. C'est le comportement réel de la table.
- La boucle dure environ 14,95 s, au ras de la limite de 15 s. La rotation (7 s), le
  battement après l'arrêt (1,6 s) et les quatre temps du règlement (3 × 930 ms) sont les
  durées réelles de l'appli, et il ne reste que ~2,2 s pour les mises.
- La géométrie du lancer est tirée de l'heure : en direct, la roue s'arrête à un angle
  différent à chaque boucle (la bille tombe toujours dans le 23). Avec `?t=`, l'heure est
  fixe.
- Le Vite de Cyrose doit pouvoir se charger depuis `../cyrose-casino-table/web`, avec ses
  `node_modules`.
