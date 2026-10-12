# Fabriquer une tuile

Une tuile est un écran de téléphone d'une de nos applis qui **se joue tout seul en
boucle**, affiché dans une iframe du mur de leteh.fr. Spec complète :
`docs/superpowers/specs/2026-10-12-mur-vivant-design.md`.

## Contrat

- Sortie : `public/tuiles/<id>.html`, document complet (`<!DOCTYPE html>`), autonome.
  Ressources éventuelles dans `public/tuiles/<id>/`. Polices à côté, préfixées par
  l'appli (`public/tuiles/cy-*.woff2`, `public/tuiles/wt-*.woff2`), référencées en
  chemins relatifs. Seule dépendance externe tolérée : les images `image.tmdb.org`.
- Écran logique **390×844**, fond plein, tout dans un conteneur 390×844 mis à l'échelle
  par `transform: scale(innerWidth / 390)` (origine haut-gauche), recalculé au
  `resize`. Aucune barre de défilement. L'iframe fait 220 à 340 px de large.
- Boucle infinie de 8 à 15 s, avec fondu de reprise. Un **doigt fictif** (disque blanc
  translucide, discret) fait les gestes.
- `?t=<secondes>` fige la tuile à cet instant (affiches, vérifications).
- `prefers-reduced-motion: reduce` → un état fixe représentatif, sans doigt.
- Aucune écriture réseau (pas de Supabase, pas d'API), aucun secret dans le fichier.
- Pas de texte hors de l'écran : seulement l'écran de l'appli.

## Méthode

1. **Compilée** (préférée quand l'écran est piloté par des composants React) : compiler le
   vrai composant avec esbuild (`node_modules/.bin/esbuild` du portfolio) depuis le dépôt
   source, brancher un faux serveur en mémoire (stubs de `lib/supabase`, etc.), jouer la
   partie par un script de gestes, CSS de l'appli élagué aux règles utilisées et figé
   pour 390×844. Exemple abouti : `public/tuiles/cy-blackjack.html`.
2. **Reconstituée** : HTML/CSS/JS écrit à la main d'après les composants réels (classes,
   tokens, seuils, durées). Exemple : `public/tuiles/wt-pile.html`.

L'atelier `ateliers/<id>/` contient tout ce qu'il faut pour **reconstruire** la tuile
(`construire.mjs` lancé depuis la racine du portfolio, chemins relatifs à l'atelier) et
un `LISEZMOI.md` : sources utilisées (fichiers, branche, commit), commande, limites.
Pour une tuile reconstituée, le `LISEZMOI.md` suffit.

## Sources de vérité

- Cyrose : **la version la plus récente de chaque écran**. Le casino « sur la table »
  vit dans le worktree `../cyrose-casino-table` (branche `feat/casino-table`) ; le reste
  dans `../cyrose_new` (branche `feat/poker`, vérifier aussi `main` et les branches
  récentes avec `git log --all`). Les bancs DEV (`/labo-salons?cas=…`, `/labo-bar/…`,
  `/labo-navale`, `/labo-menteur`… cf. `web/src/App.tsx`) affichent de vrais écrans sans
  base : ce sont les références visuelles. `npm run dev -- --port <ton port> --strictPort`
  depuis `web/` ; si `node_modules` manque dans un worktree, lien symbolique vers
  `../cyrose_new/web/node_modules`. Coupe ton serveur à la fin.
- Watchtracker : `../watchtracker`. Vraies affiches TMDB : la clé `TMDB_API_KEY` de
  `../watchtracker/.env.local` sert **uniquement** en local à trouver des `poster_path` ;
  seules les URLs `https://image.tmdb.org/t/p/...` vont dans la tuile.

**Interdit** : modifier quoi que ce soit dans `../cyrose_new`, `../cyrose-casino-table`,
`../watchtracker` ; modifier `package.json`, `src/`, `index.html` du portfolio ou les
tuiles d'un autre atelier ; faire des commits.

## Vérification (obligatoire)

- `npx vite --port <ton port> --strictPort` depuis la racine du portfolio sert
  `public/` : la tuile est à `http://localhost:<port>/tuiles/<id>.html`.
- Playwright : `import { chromium } from 'playwright-core'` puis
  `chromium.launch({ channel: 'chrome' })`. Scripts jetables dans `/tmp/tuiles/<id>/`.
- Captures à plusieurs instants (`?t=`) en 390×844 et 300×650 (deviceScaleFactor 2),
  **regardées une à une**, comparées au vrai écran capturé sur le banc DEV. Lecture en
  temps réel sur deux boucles sans erreur JS, images fluides.
- Rapport final : fichier produit, scénario seconde par seconde, sources, instant
  conseillé pour l'affiche (`affiche: <s>`), limites connues.
