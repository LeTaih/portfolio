# Atelier cy-undercover — Undercover (Cyrose)

Méthode **compilée** : le vrai écran de jeu de cyrose.fr, `web/src/screens/uc/Undercover.tsx`
et ses phases (`UcWords`, `UcReveal`, `UcDescribe`, `UcVote`, `UcResult`, `UcEnded`, la NavBar),
compilé par esbuild, branché sur un faux serveur en mémoire et joué par un script horodaté.

## Reconstruire

```sh
node ateliers/cy-undercover/construire.mjs   # depuis la racine du portfolio
```

Écrit `public/tuiles/cy-undercover.html` (polices `cy-*.woff2` partagées, copiées si absentes).
Il faut `../cyrose_new/web/node_modules` (React, Tailwind, PostCSS, canvas-confetti) et Chrome
(Playwright, pour l'élagage de la feuille). Aucun serveur de dev n'est nécessaire.

## Sources

- Dépôt `../cyrose_new`, branche `feat/poker`, commit `4713e34` ; les écrans `screens/uc/` sont
  identiques sur `main` (dernier changement : `14eb858`, 2026-10-10). Direction artistique
  **Rave Acid** (cyrose.fr), comme la tuile du Blackjack. La mise en scène « Bar des menteurs »
  (`src/alt/jeux/undercover`, bancs `/labo-bar/undercover?etat=…`) est celle d'alt.cyrose.fr :
  écartée pour rester sur le site vers lequel pointe le mur.
- Feuille : `web/src/fonts.css` + `web/src/index.css` passées par la config Tailwind de l'appli,
  figées pour 390×844, puis élaguées aux règles touchées pendant une boucle.
- Référence visuelle : le vrai `Undercover` monté dans la page du banc `/labo-salons?cas=undercover-invite`
  (serveur de dev, `/api/uc` intercepté) à chaque phase ; captures comparées une à une.

## Fichiers

- `harnais.tsx` — téléphone 390×844, horloge virtuelle (`Date.now` suit la tuile : minuteur du vote),
  tablée, script des actions et des gestes, doigt calculé en fonction du temps, `?t=`, mouvement réduit.
- `magasin.ts` — le salon et les joueurs en mémoire (temps réel simulé).
- `stubs/` — `lib/supabase`, `lib/ucApi` (`myword` rend le mot, puis toute la table en phase `ended`,
  comme le vrai serveur), `lib/sound` (muet), `lib/identity`, `react-router-dom`, `canvas-confetti`
  (la vraie, tirée dans une toile posée dans le téléphone), `UcLobby` (jamais monté).
- `gabarit.html` — le cadre (scène, fond, doigt). `elaguer-page.js` — le collecteur de règles.

## Scénario (15 s, boucle)

Léa tient le téléphone (invitée), Marc est l'hôte et donne le mot, Inès est l'undercover.
0 attente du mot de Marc · 1,25 « Ton mot secret : Whisky » · 2,6 le doigt tape « J'ai vu mon mot — Prêt »
· prêts 1→5/5 · 3,9 « Décrivez votre mot » (indices à l'oral) · 5,8 vote, minuteur 100 s · 6,95 le doigt
vote Inès · 7,85 « Je suis prêt » · 9,2 « Inès a été éliminé » · 12,0 fin : « Gagné ! », Civils Whisky /
Undercover Rhum, tableau des rôles (💀 Inès — Undercover — Rhum), confettis · 14,5 fondu.

## Limites

- Le jeu ne révèle pas le rôle à l'élimination (choix de l'appli : les rôles ne tombent qu'en fin de
  partie) ; la révélation vient donc de l'écran de fin, 2,8 s après (`END_REVEAL_MS`).
- Il n'y a pas de geste pour découvrir le mot : en multi-téléphones il s'affiche d'emblée ; le geste
  est « J'ai vu mon mot — Prêt ».
- La ligne de débogage « 🎲 Autres mots possibles » (candidats de l'IA) n'est pas reproduite
  (cas d'une paire sans candidats).
- Confettis absents en `?t=` et en mouvement réduit (pas d'instant fixe).
- `?t=` rejoue le script jusqu'à t : l'écran est prêt quand `<html data-pret="1">` (~0,5 s).
- La teinte d'accent est figée à 255 30 140 (l'appli la tire au sort au chargement).
