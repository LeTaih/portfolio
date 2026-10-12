# Atelier cy-navale — la Bataille navale de Cyrose

Tuile **compilée** : le vrai écran de tir de Cyrose (`RoomTopBar` + `NavaleTir`, avec
sa grille, ses explosions en canvas, la loupe, le résumé défilant, l'escalade et le mur
des plateaux), compilé par esbuild, nourri par les vraies règles (`etatInitial`,
`jouerTir`) et joué par un script.

```sh
node ateliers/cy-navale/construire.mjs     # depuis la racine du portfolio (~50 s)
```

Écrit `public/tuiles/cy-navale.html` (≈ 360 ko, autonome) et copie à côté les polices
`cy-*.woff2` qui manqueraient. Demande `../cyrose_new/web` avec ses `node_modules`
(esbuild y résout React, postcss/Tailwind y compilent `index.css`) et Chrome installé
(Playwright, `channel: 'chrome'`). Aucun serveur Cyrose n'est nécessaire.

## Sources (dépôt `../cyrose_new`)

- Branche `feat/poker`, commit `4713e34`. La navale y est **identique à `main`**
  (`8218dc7`) : les branches `feat/navale-escalade-x2` (escalade arrêtée à ×2, atteinte à
  mi-grille) et `feat/navale-esquive-touche` sont fusionnées dans les deux. Rien de plus
  récent ailleurs (`git log --all`).
- Composants : `web/src/screens/RoomTopBar.tsx`, `screens/navale/NavaleTir.tsx` et ce
  qu'il monte (`NavaleGrille`, `NavaleBateau`, `NavaleExplosion`, `NavaleLoupe`,
  `NavaleResume`, `NavaleResumeDefile`, `NavaleEscalade`, `NavaleMinuteur`,
  `NavaleJauge`, `NavaleMur`, `NavaleTuile`, `NavalePlateau`, `eclosion.ts`).
- Règles : `web/src/lib/navale/*` (`partie.ts`, `speciales.ts`, `feed.ts`, `mur.ts`…).
- CSS : `web/src/fonts.css`, `web/src/index.css` (Tailwind 3), `screens/navale/navale.css`.
- Référence visuelle : le banc `/navale-mecaniques-lab.html?jeu` (NavaleScenes.tsx), le
  même montage (`.screen.screen--haut` + RoomTopBar « Salon » + NavaleTir).

## Fichiers

- `tuile.tsx` — le monde (4 joueurs, grille 7×7, flottes posées à la main, 11 tirs
  d'historique joués par `jouerTir`), le cadre 390×844, le script et la lecture.
- `horloge.ts` — l'horloge virtuelle : `setTimeout`, `setInterval`, `rAF`,
  `performance.now`, `Date.now` et **toutes les animations** (CSS et Web Animations,
  mises en pause et pilotées par `currentTime`, terminées par `finish()`) suivent un
  seul temps. La lecture et `?t=` passent par le même chemin ; `Math.random` est graine
  fixe, rejouée à chaque boucle (gerbes identiques).
- `bouchons/navaleApi.ts` (aucune requête), `bouchons/router.tsx` (`Link`).
- `construire.mjs` — JS (esbuild), CSS (postcss + Tailwind de Cyrose ; médias résolus
  pour un téléphone 390×844 au doigt ; `vh/vw/env(safe-area)` figés ; `body::before/after`
  → `.cy-bg`), puis élagage : la tuile brute est jouée en temps virtuel dans Chrome et
  seules les règles dont un sélecteur a servi sont gardées (165 sur 1116).

## Scénario (13,4 s, boucle avec fondu)

| s | |
|---|---|
| 0 – 0,4 | fondu d'entrée ; « Au tour de Sam », 11 tirs sur la grille, fiche « E1 Tir de Léo » |
| 0,8 | Sam tire en C3 : gerbe d'eau, capsule « À l'eau » ; « À toi de tirer » en magenta, le plateau s'éveille (lueur arc-en-ciel) |
| 2,1 | la fiche glisse sur « C3 Tir de Sam — À l'eau » ; le doigt arrive sur D4 |
| 2,96 | tap : explosion, loupe « D4 Ton tir — Léo touché, Sam touché » ; « Au tour de Marie », jauges de Léo et Sam qui baissent, barre ×2 qui avance |
| 5,6 | la loupe rentre dans la case, la fiche passe sur D4 |
| 5,9 | Marie tire en B6 : grosse explosion, mon Remorqueur coule (coque sombre), loupe « Toi — Le Remorqueur coulé 3 gorgées / Sam touché » ; « Au tour de Léo » |
| 8,6 | la fiche passe sur B6 avec « Tu bois 3 » |
| 9,5 – 10,9 | le doigt tire la page vers le haut : le volet descend sur « Les plateaux », les tuiles des flottes se déplient (mon plateau, coque coulée comprise) |
| 12,7 – 13,3 | fondu de sortie, reprise |

`?t=<s>` rejoue la boucle en temps virtuel jusqu'à l'instant et fige (prêt en < 1,5 s,
attribut `data-pret` sur `<html>`). `prefers-reduced-motion` : la partie après les trois
coups, sans doigt ni animation (la liste des flottes redevient visible, comme dans l'app).
**Affiche conseillée : 9,2 s.**

## Limites

- Le défilement vers le mur est **joué** (transform + plages du morphe recopiées de
  `navale.css`), pas natif : la timeline `scroll(root)` ne peut pas tourner dans une
  iframe mise à l'échelle et sans défilement. `window.scrollY` est simulé pour que
  `NavaleMur` mesure juste.
- Le naufrage 3D plein écran (three.js, fin de partie seulement) n'est pas dans la tuile.
- Les explosions de touché/coulé sont en grande partie recouvertes par la loupe, comme
  dans l'app (elle s'ouvre sur la case au même instant).
- La loupe et le résumé utilisent la police système (`-apple-system`…) comme l'app :
  rendu SF sur Apple, Roboto sur Android.
