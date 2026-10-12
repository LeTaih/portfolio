# wt-fiche — la fiche d'une série (reconstituée)

Sortie : `public/tuiles/wt-fiche.html` (+ `public/tuiles/wt-fiche/bande-annonce.jpg`,
polices `public/tuiles/wt-inter-{400,500,600,700}.woff2`).

## Sources

Dépôt `../watchtracker`, branche `main`, commit `dfbf3f3`. Écrans recopiés classe par classe
(les utilitaires Tailwind employés sont réécrits en CSS dans la tuile, valeurs du `@theme`
de `src/app/globals.css`) :

- `src/app/serie/[tmdbId]/page.tsx` — ordre des blocs, lignes d'épisode, formulaire « J'en suis là »
- `src/components/fiche-entete.tsx`, `poster.tsx`, `back-link.tsx`, `bande-annonce.tsx`, `plateformes.tsx`
- `src/components/statut-suivi.tsx`, `season-tabs.tsx`, `coche-episode.tsx`, `marquage-bloc.tsx`
- `src/app/serie/[tmdbId]/[saison]/[episode]/page.tsx`, `episode-actions.tsx`, `corriger-date.tsx`
- `src/components/note-oeuvre.tsx` / `note-episode.tsx` (dix pastilles), `annulation.tsx`, `bottom-nav.tsx`

Données TMDB réelles (fr-FR) : Pluribus (225171), saison 1, logo `en` le mieux noté, offres FR
(Apple TV, Apple TV Amazon Channel), bande-annonce YouTube `Ni9xYSTaKlY` (vignette
`hqdefault.jpg` copiée localement : seule `image.tmdb.org` est tolérée en externe). La clé
`TMDB_API_KEY` n'a servi qu'en local à trouver les chemins.

## Scénario (12,7 s)

0–0,9 haut de la fiche · 1,1–2,6 défilement jusqu'aux épisodes · 3,0 coche S1E3 (pressée,
grisée le temps de l'action) · 3,5 « vu », bouton « − », compteur 3/9, bandeau « Vu S1E3 » ·
4,0–4,4 petit défilement · 4,8 « J'en suis là » (S1E6 choisi) · 5,4 E4–E6 « vu », 6/9, le menu
revient à S1E1 (React remet le formulaire à zéro) · 6,0 appui sur la ligne E6 · 6,3 fiche de
l'épisode · 7,3–8,8 défilement jusqu'à la note · 9,2 pastille 7 → 1 à 7 blanchissent
(300 ms), bloc à 50 % pendant `setRating` · 11,35–12,7 fondu de reprise.

`?t=<s>` fige ; `prefers-reduced-motion` → t = 5,6 sans doigt. Affiche conseillée : 5,6.

## Limites

- Le `<select>` natif est dessiné (pas de roue iOS) ; « S1E6 » y est déjà choisi.
- Les transitions de navigation sont adoucies d'un fondu de 160 ms (Next remplace l'écran sec).
- La note de l'appli se pose en pastilles 1–10, pas en étoiles : la tuile suit l'appli.
