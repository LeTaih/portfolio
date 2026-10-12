# wt-amis — l'activité des amis et une recommandation (reconstituée)

Sortie : `public/tuiles/wt-amis.html` (+ `public/tuiles/wt-amis/bande-annonce.jpg`, polices
`wt-inter-*.woff2`).

## Sources

Dépôt `../watchtracker`, branche `main`, commit `dfbf3f3`.

- `src/app/amis/page.tsx` : « On te conseille », « Mes amis », « Ces 30 jours » (ligne « Toi »
  en verre fort), « Ces derniers jours » et ses quatre réactions.
- `src/lib/social/labels.ts` (`formatFeedLine`, `relativeDay`), `src/lib/texte.ts`
  (`formatDuration`).
- `src/app/film/[tmdbId]/page.tsx`, `fiche-entete.tsx`, `actions-film.tsx`, `plateformes.tsx`,
  `bande-annonce.tsx`, `ajouter-a-liste.tsx`, `recommander-bouton.tsx`, `distribution.tsx`
  (`MotsCles`, `Distribution`), `bottom-nav.tsx` (onglet Amis actif, aucun sur une fiche).
- `visionnages-recents.tsx` a été lu ; c'est le flux de `/amis` qui porte « ce que tes amis ont
  vu », c'est lui qui est montré.

Prénoms fictifs : Inès, Léa, Malik. Données TMDB réelles (fr-FR) : The Pitt, Une Bataille après
l'autre (1054867 : logo `fr`, Canal+ et location, réalisateur, mots-clés et distribution tels
que TMDB les rend), Slow Horses, Les Carnets de l'apothicaire, The Bear, Pluribus, Silo.
Bande-annonce YouTube `p_WrWdfbFxg` (vignette copiée localement). Journée : 12 octobre 2026.

## Scénario (12,4 s)

0–1,2 l'écran Amis · 1,2–2,6 défilement jusqu'au flux · 3,0 🔥 sur « Léa a vu Slow Horses
S6E1–E4 » (blanchit au retour de l'action, 3,45) · 4,1 appui sur « a vu Une Bataille après
l'autre » · 4,45 fiche du film · 5,5–7,0 défilement · 7,25 « Conseiller à un ami » → panneau ·
8,0 « Malik » blanchit, « Envoyer » s'allume · 8,75 Envoyer → « … » → 9,3 « Envoyé ! » ·
11,0–12,4 fondu de reprise.

`?t=<s>` fige ; `prefers-reduced-motion` → t = 3,6 sans doigt. Affiche conseillée : 3,6
(ou 8,4 pour le panneau de recommandation).

## Limites

- Aucun message n'est saisi (le champ est facultatif ; pas de clavier simulé).
- Les transitions de navigation sont adoucies d'un fondu de 160 ms.
