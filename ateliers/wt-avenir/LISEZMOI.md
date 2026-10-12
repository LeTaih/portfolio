# wt-avenir — la notification et la colonne « À venir » (reconstituée)

Sortie : `public/tuiles/wt-avenir.html` (+ `public/tuiles/wt-avenir/icone-192.png`, copie de
`watchtracker/public/icone-192.png`, polices `wt-inter-*.woff2`).

## Sources

Dépôt `../watchtracker`, branche `main`, commit `dfbf3f3`.

- `src/app/nouveautes/page.tsx` : redirige vers `/` — les nouveautés vivent dans l'accueil.
- `src/app/page.tsx` (sections, `TITRE_SECTION`, `mt-9`), `src/components/up-next-card.tsx`,
  `sortie-row.tsx` (`delai()` et dates `fr-FR` courtes), `volet-differe.tsx`.
- `src/lib/watch/accueil.ts` : une sortie par œuvre triée par date, le reste au volet ; seules les
  séries suivies de près (`suivieDePres`, 45 jours) sont annoncées ; ordre « À rattraper ».
- `src/lib/alerts/message.ts` (`buildMessage` : titre « Série SxEy », corps = titre de
  l'épisode) et `public/sw.js` (`showNotification`, icône `icone-192.png`).

Données TMDB réelles (fr-FR), journée fixée au mercredi 7 octobre 2026 (sortie de Slow Horses
S6E4 « Le chat et la souris ») : The Gentlemen S2, Silo S3/S4, Slow Horses S6, Les Carnets de
l'apothicaire, Tulsa King S4, Only Murders in the Building S6, Dune : Troisième partie (film,
15 déc.), Ahsoka S2, The Studio S2, Task. Volet : 20 autres sorties (Carnets E51–E60, Slow
Horses E6, Tulsa King E2–E10). Les titres « Épisode N » sont ceux que TMDB rend.

## Scénario (10,9 s)

0–0,7 la Pile · 0,7–1,4 la bannière iOS descend (ressort) · jusqu'à 3,55 lisible · 3,55–3,9
elle remonte · 4,3–4,85 le doigt pousse la page, lancée jusqu'à ~6,5 : « À venir » défile
jusqu'à « Voir 20 autres sorties » · 6,5–9,6 lecture des dates · 9,6–10,9 fondu de reprise.

`?t=<s>` fige ; `prefers-reduced-motion` → t = 7,5 sans doigt. Affiche conseillée : 7,5
(ou 1,6 pour la notification).

## Limites

- La bannière est le chrome d'iOS (pas l'appli) : matériau et métriques approchés, en Inter.
- La Pile ne se met pas à jour en direct : la carte Slow Horses S6E4 y est dès l'ouverture.
