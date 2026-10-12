# Tuile `cy-poker` — le Poker (Texas Hold'em) de Cyrose

Méthode **compilée** : la vraie table du Poker, compilée par esbuild, sur un faux serveur
en mémoire qui fait tourner la vraie machine de jeu.

```
node ateliers/cy-poker/construire.mjs        # depuis la racine du portfolio
CYROSE=../autre-checkout node ateliers/cy-poker/construire.mjs
```

Sortie : `public/tuiles/cy-poker.html` (~310 Ko, autonome). Polices : `cy-archivo-400`,
`cy-syne-700`, `cy-space-mono-400/700` (déjà présentes, copiées sinon depuis
`web/public/fonts`). La construction joue une boucle complète dans Chrome (Playwright,
`channel: 'chrome'`) pour élaguer la feuille : compter ~40 s.

## Sources

- Dépôt : `../cyrose-casino-table` (worktree), branche **`feat/casino-table`**, commit
  **`7770d26`** — identique en contenu à `main` (`8218dc7`, merge de cette branche).
- Pourquoi cette version : `feat/poker` (`4713e34`, 10/10) est un **ancêtre** de
  `feat/casino-table`. Le Poker y est passé « sur la table » le 11/10 (commits `26f9fb7`
  « le stade du Poker », `e364628`, `c6f720f`, `5e5b6bd` « la main se joue sur la
  table », `5edfcd7`, `17f5af4`), puis les passes casino `584c1d1` et `7770d26`. L'ancien
  écran de `feat/poker` (feuilles, PkActions seul) n'existe plus.
- Composant monté : `web/src/screens/poker/table/PkTable.tsx` (→ `PkTableVue`, `PkDock`,
  `PkActions`, `usePkMain`, `usePkPret`, `useCommun`, `CasinoTable`, `CasinoTopBar`),
  avec les props que lui passe `CasinoRoot` (`sessionOf(room)`).
- Machine pure, telle quelle : `lib/poker/partie.ts` (`nouvelleMain`, `agir`), donc
  `evaluer.ts` et `pots.ts` ; `lib/poker/serveur.ts` (`choisirJoueurs`, `lireAction`).
- Feuilles : `fonts.css`, `index.css` (passée par Tailwind avec `tailwind.config.js`),
  `screens/casino/casino.css`, `screens/casino/table/table.css`, `screens/poker/poker.css`.
- Référence visuelle : banc DEV `/labo-casino?jeu=pk&etape=0…6` (serveur Cyrose sur 5193).

## Ce qui est remplacé (`src/faux/`)

- `lib/appelApi.ts` → `faux/appelApi.ts` : pas de `fetch`, 140 ms d'aller-retour simulé,
  puis `faux/serveur.ts` — le faux `api/poker.ts` (`ma-main`, `agir`, `passer`) sur une
  `Donne` en mémoire ; `lib/pokerApi.ts` (le vrai) reste dans le graphe.
- `lib/supabase.ts` → `faux/supabase.ts` : aucune requête ; `updateCasinoPlayer` revient
  en écho dans le magasin (120 ms).
- `react-router-dom` → `faux/router.tsx` (`Link`, `useNavigate`).
- `src/magasin.ts` tient `rooms` et `players` comme le temps réel.

## Le scénario (14,1 s, `src/tuile.tsx`)

Cinq joueurs, Léa (toi, hôte) grosse blind, bouton chez Tom. Paquet arrangé : Léa D♥ D♠,
Hugo A♠ R♦ ; board D♦ 7♣ 2♠ · 9♥ · R♣.

| s | |
|---|---|
| 0–0,4 | fondu d'entrée, « La donne arrive… » |
| 0,4 | donne : blindes, deux cartes chacun (tes dames se retournent) |
| 1,9 / 2,35 / 2,8 / 3,3 | Marc suit, Inès et Tom se couchent, Hugo complète |
| 3,3–4,1 | à toi : premier plan, le doigt **checke** |
| 4,1 | le flop tombe, les mises partent au pot (« Brelan » au dock) |
| 5,2 | Hugo checke |
| 5,45–7,4 | à toi : le doigt touche **Relancer**, **+5**, **Relancer à 7** |
| 8,15 | Marc se couche |
| 8,75 | Hugo suit à tapis : la turn puis la rivière tombent d'elles-mêmes |
| 9,7 | abattage : mains montrées, Brelan contre Paire, cartes gagnantes allumées |
| 10,6 | le pot (18) part chez toi |
| 11,25 | l'hôte règle : « Tu gagnes 9 », nets aux sièges, « Tu distribues 10 gorgées » |
| 13,65–14,1 | fondu de reprise |

**Affiche : 12,5 s** (aussi l'état fixe du mouvement réduit).

## L'horloge (`src/horloge.ts`)

En lecture, rien n'est touché. Avec `?t=<s>` (et en mouvement réduit), la partie se
rejoue sur une horloge virtuelle (minuteurs, `Date.now`, `performance.now`, images,
Web Animations et animations/transitions CSS mises en pause et placées), puis s'arrête à
l'instant demandé : `<html data-fige="pret">` signale la fin (~0,5–2 s). Images et
minuteurs natifs reviennent ensuite, pour les outils de capture.

## Limites

- Le compte à rebours affiche « 31 s » au début d'un tour : c'est le vrai calcul de
  l'appli (horloge à 1 Hz face à une échéance à +30 s), sans décalage serveur.
- Les noms de combinaison sont ceux de `evaluer.ts` (« Brelan », « Paire »), plus
  courts que ceux, écrits à la main, du banc.
- Figée, une transition CSS qui démarre est datée à 16 ms près.
- L'élagage CSS ne garde que ce que cette boucle montre : changer le scénario, c'est
  reconstruire.
