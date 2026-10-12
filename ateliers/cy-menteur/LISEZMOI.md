# cy-menteur — le Bar des menteurs (méthode compilée)

Sortie : `public/tuiles/cy-menteur.html` (autonome, ~320 ko). Polices : `cy-anton-400-latin`,
`cy-archivo-400-latin`, `cy-space-mono-400/700-latin` (.woff2, à côté) — le script copie depuis
`web/public/fonts` celles qui manquent ; toutes existaient déjà, identiques à celles de Cyrose.

## Reconstruire

```sh
node ateliers/cy-menteur/construire.mjs          # depuis la racine du portfolio
AFFICHE=7.6 node ateliers/cy-menteur/construire.mjs   # autre image fixe du mouvement réduit
CYROSE=../autre-worktree/web node ateliers/cy-menteur/construire.mjs
```

Exige `../cyrose_new/web` avec ses `node_modules` (react, react-dom, tailwindcss, postcss).
esbuild vient du portfolio.

## Sources (Cyrose)

Dépôt `../cyrose_new`, branche `feat/poker` (HEAD `4713e34`, 13/10/2026). La salle du menteur
est identique sur `main` (`8218dc7`) et sur toutes les branches récentes : dernier changement
des écrans `4a650c7` (1/10/2026, « la balle coûte quatre gorgées »), le tir automatique
(`origin/feat/tir-auto`) est déjà fusionné.

- `web/src/screens/menteur/salle/` — `MenteurSalle.tsx`, `Salle.ts`, `tir.ts` (le tir « B »
  du banc `public/menteur-tir-b-lab.js`), `lumiere.ts` (projecteur tramé, banc
  `public/menteur-projecteur-lab.html`), `mains.ts`, `geometrie.ts`, `modele.ts`, `salle.css`
  — compilés tels quels.
- `web/src/lib/menteur/` — `etatInitial`, `jouer`, `accuser`, `presser`, `compter`,
  `estMensonge` : les fonctions pures de l'endpoint, comme au banc `/labo-menteur`.
- `web/src/screens/RoomTopBar.tsx`, `shared/NavBar.tsx` ; `index.css` + `fonts.css` passés
  dans Tailwind (config Cyrose, contenu restreint aux fichiers compilés).
- Référence visuelle : le banc DEV `/labo-menteur` (= `/labo-bar/menteur`), capturé en 390×844.

## Fichiers de l'atelier

- `tuile.tsx` — la partie écrite d'avance, le faux serveur (même enchaînement que
  `screens/labo/MenteurLab.tsx`), le doigt, la boucle, `?t=`.
- `horloge.ts` — heure virtuelle : `performance.now`, `Date.now`, `setTimeout/Interval`,
  `requestAnimationFrame` et toutes les animations CSS/Web Animations sont pilotés image par
  image (1/60 s). Hasard semé. D'où une boucle identique à chaque tour et un `?t=` exact.
- `stubs/` — son muet, API jamais appelée, `Link` de react-router, invite d'installation.
- `cadre.css` — la mise à l'échelle 390×844 et le doigt (même dessin que cy-blackjack).

## Scénario (15 s, fondu d'entrée 0,32 s, de sortie 0,45 s)

Manche 3, la table annonce les Rois ; Léa, Marc et Inès ont déjà posé, les barillets ont
tourné. Hugo (joueur avant toi) pose une Dame et un As en annonçant deux Rois ; c'est à toi,
le doigt crie « Menteur ! » ; ta main frappe la table, la salle s'éteint, la pose se retourne
(Dame et As en rouge), « Hugo bluffait. », il prend son revolver, la chambre est pleine :
éclair, toute la table sursaute, ses cartes s'éparpillent, « Hugo boit quatre gorgées. Dehors. »

## `?t=` et mouvement réduit

`?t=<s>` rejoue la partie en avance rapide (pas de 50 ms, puis image par image sur la dernière
seconde ; le projecteur ne se dessine que sur cette dernière seconde), puis tout s'arrête.
Compter 0,6 à 1,5 s après le chargement ; `document.documentElement.dataset.pret === '1'`
signale l'image prête. Attention : les scripts Playwright ne doivent pas attendre avec
`waitForFunction` (il s'appuie sur le `requestAnimationFrame`/`setTimeout` de la page, figés) :
sonder par `evaluate`.

`prefers-reduced-motion: reduce` → la même image qu'à `?t=AFFICHE` (constante du build,
3 s par défaut : le doigt sur « Menteur ! »), sans doigt. La salle elle-même ne voit jamais la préférence (la tuile
compose l'image fixe avec la mise en scène normale).

## Limites

- La tuile est muette (le son de la salle est bouché).
- Le pied de la salle suit le vrai écran : la ligne du croupier « À toi : pose 1 à 3 cartes,
  ou crie au menteur. » passe sur deux lignes à 390 px et frôle les boutons, comme sur un
  vrai téléphone de cette largeur.
- Les requêtes média de largeur sont tranchées pour 390×844 et les `vw`/`vh` figés en px :
  la tuile ne réagit pas à la taille de l'iframe autrement que par l'échelle.
- Le pas d'avance rapide de `?t=` diffère de la lecture (50 ms puis 1/60 s) : une image
  figée et la même seconde en lecture peuvent différer de quelques pixels (tremblement,
  poussière du faisceau), pas de contenu.
