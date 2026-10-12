# Le mur vivant — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** leteh.fr — un mur plein écran de tuiles animées (écrans réels de Cyrose et Watchtracker qui se jouent seuls), colonnes à défilement continu et indépendant, bandeaux avec lien.

**Architecture:** Site statique Vite + TypeScript sans framework. Les tuiles sont des fichiers HTML autonomes figés dans `public/tuiles/`, chargés en iframe uniquement près de l'écran (affiche `.jpg` sinon). Chaque tuile compilée a un atelier reproductible dans `ateliers/<id>/`.

**Tech Stack:** Vite 8, TypeScript, Vitest, playwright-core (Chrome installé, `channel: 'chrome'`), esbuild (ateliers).

**Spec:** `docs/superpowers/specs/2026-10-12-mur-vivant-design.md`

## Global Constraints

- Desktop ≥ 768 px : Cyrose 3/4 (3 colonnes), Watchtracker 1/4 (1 colonne). Mobile < 768 px : bascule « Cyrose | Watchtracker », 2 colonnes.
- Le survol n'arrête jamais le défilement ; seul un geste manuel en cours le suspend (≤ 800 ms après le dernier geste).
- Tuile : `public/tuiles/<id>.html`, 390×844 logiques, `scale(innerWidth/390)`, boucle 8–15 s, `?t=<s>` fige, `prefers-reduced-motion` → état fixe, aucune écriture réseau, aucun secret.
- Affiche : `public/tuiles/<id>.jpg` (390×844 @2x, qualité 85).
- Texte du site en français, tutoiement, liens externes `target="_blank" rel="noopener"`.
- Mention sous Cyrose : « 18+ · L'abus d'alcool est dangereux pour la santé ».
- Ne jamais modifier `../cyrose_new`, `../cyrose-casino-table`, `../watchtracker`.

## Review Focus

1. Colonne dont une copie est plus courte que la vue (Watchtracker mobile, 2 tuiles) → la boucle doit rester sans trou : on duplique autant que nécessaire (`copiesNecessaires`, Task 1).
2. Défilement au doigt pendant que l'auto-défilement écrit `scrollTop` → pas de lutte : pause tant que le geste dure (`doitAvancer`, Task 1 ; vérifié Task 4).
3. Redimensionnement / rotation qui franchit 768 px → colonnes reconstruites, aucune iframe orpheline (Task 3, vérifié Task 4).
4. Tuile introuvable (404) ou lente → l'affiche reste, fond sombre si l'affiche manque aussi (Task 3).
5. Mouvement réduit activé en cours de route → arrêt du défilement et retrait des iframes sans recharger (Task 3).

---

## File Structure

```
index.html                 texte, zones, bandeaux, pastille
mentions-legales.html
src/boucle.ts              logique pure du défilement
src/boucle.test.ts
src/tuiles.ts              manifeste + répartition en colonnes
src/tuiles.test.ts
src/chargement.ts          iframe ↔ affiche selon la proximité
src/mur.ts                 colonnes, animation, gestes, bascule
src/main.ts                point d'entrée
src/style.css
public/tuiles/*.html|*.jpg|*.woff2
public/og.jpg
ateliers/<id>/             fabrication des tuiles compilées
scripts/affiches.mjs       génère les .jpg
scripts/verifier-mur.mjs   vérification Playwright du site
tsconfig.json, vite.config.ts, vercel.json
```

### Task 1: La logique du défilement

**Files:** Create `src/boucle.ts`, `src/boucle.test.ts`, `tsconfig.json`

**Interfaces — Produces:**
- `avancer(pos: number, vitesse: number, dt: number, periode: number): number` — position dans `[0, periode)`.
- `copiesNecessaires(hauteurCopie: number, hauteurVue: number): number` — ≥ 2.
- `doitAvancer(maintenant: number, gesteJusqua: number): boolean`
- `GESTE_MS = 800`

- [ ] **Step 1: tests**

```ts
// src/boucle.test.ts
import { describe, expect, it } from 'vitest'
import { avancer, copiesNecessaires, doitAvancer } from './boucle'

describe('avancer', () => {
  it('avance proportionnellement au temps', () => expect(avancer(10, 20, 0.5, 1000)).toBe(20))
  it('replie au-delà de la période', () => expect(avancer(990, 20, 1, 1000)).toBe(10))
  it('replie en marche arrière', () => expect(avancer(5, -20, 1, 1000)).toBe(985))
  it('encaisse un grand saut de temps', () => expect(avancer(0, 30, 100, 1000)).toBe(0))
  it('ne bouge pas sans période', () => expect(avancer(42, 20, 1, 0)).toBe(42))
})
describe('copiesNecessaires', () => {
  it('au moins deux copies', () => expect(copiesNecessaires(3000, 900)).toBe(2))
  it('assez de copies pour couvrir la vue plus une', () => expect(copiesNecessaires(400, 900)).toBe(4))
  it('copie vide : deux', () => expect(copiesNecessaires(0, 900)).toBe(2))
})
describe('doitAvancer', () => {
  it('suspend pendant un geste', () => expect(doitAvancer(1000, 1500)).toBe(false))
  it('reprend après le geste', () => expect(doitAvancer(1600, 1500)).toBe(true))
})
```

- [ ] **Step 2:** `npx vitest run src/boucle.test.ts` → FAIL (module absent).

- [ ] **Step 3: implémentation**

```ts
// src/boucle.ts
/** Fenêtre pendant laquelle un geste manuel suspend l'auto-défilement. */
export const GESTE_MS = 800

/** Avance une position de défilement et la replie sur une copie du contenu. */
export function avancer(pos: number, vitesse: number, dt: number, periode: number): number {
  if (periode <= 0) return pos
  const p = (pos + vitesse * dt) % periode
  return p < 0 ? p + periode : p
}

/** Copies du contenu pour qu'une vue entière tienne après n'importe quel repli. */
export function copiesNecessaires(hauteurCopie: number, hauteurVue: number): number {
  if (hauteurCopie <= 0) return 2
  return Math.max(2, Math.ceil(hauteurVue / hauteurCopie) + 1)
}

export function doitAvancer(maintenant: number, gesteJusqua: number): boolean {
  return maintenant >= gesteJusqua
}
```

`tsconfig.json` : `{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"bundler","strict":true,"lib":["ES2022","DOM","DOM.Iterable"],"noEmit":true,"types":["vite/client"]},"include":["src"]}`

- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** `git add src/boucle.ts src/boucle.test.ts tsconfig.json package.json package-lock.json .gitignore && git commit -m "feat(mur): logique pure du défilement en boucle"`

### Task 2: Le manifeste des tuiles

**Files:** Create `src/tuiles.ts`, `src/tuiles.test.ts`

**Interfaces — Produces:**
- `type Appli = 'cyrose' | 'watchtracker'`
- `interface Tuile { id: string; appli: Appli; titre: string; affiche: number }` (`affiche` = secondes passées à `?t=`)
- `TUILES: Tuile[]` — uniquement les tuiles présentes dans `public/tuiles/`.
- `repartir<T>(items: T[], n: number): T[][]` — round-robin, `n` colonnes non vides si possible.

- [ ] **Step 1: tests**

```ts
import { describe, expect, it } from 'vitest'
import { repartir, TUILES } from './tuiles'

describe('repartir', () => {
  it('distribue en tourniquet', () => expect(repartir([1, 2, 3, 4, 5], 2)).toEqual([[1, 3, 5], [2, 4]]))
  it('remplit toutes les colonnes en recyclant si trop peu d’éléments', () =>
    expect(repartir(['a'], 3)).toEqual([['a'], ['a'], ['a']]))
  it('liste vide : colonnes vides', () => expect(repartir([], 2)).toEqual([[], []]))
})
describe('TUILES', () => {
  it('ids uniques', () => expect(new Set(TUILES.map(t => t.id)).size).toBe(TUILES.length))
})
```

- [ ] **Step 2:** FAIL. **Step 3:**

```ts
export type Appli = 'cyrose' | 'watchtracker'
export interface Tuile { id: string; appli: Appli; titre: string; affiche: number }

export const TUILES: Tuile[] = [
  { id: 'cy-blackjack', appli: 'cyrose', titre: 'Blackjack', affiche: 6 },
  { id: 'wt-pile', appli: 'watchtracker', titre: 'La Pile', affiche: 2.6 },
]

export function repartir<T>(items: T[], n: number): T[][] {
  const cols: T[][] = Array.from({ length: n }, () => [])
  if (!items.length) return cols
  const total = Math.max(items.length, n)
  for (let i = 0; i < total; i++) cols[i % n].push(items[i % items.length])
  return cols
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat(mur): manifeste et répartition des tuiles`.

### Task 3: La page, le mur et le chargement

**Files:** Create `index.html`, `mentions-legales.html`, `src/main.ts`, `src/mur.ts`, `src/chargement.ts`, `src/style.css`, `vite.config.ts`, `vercel.json`; move `public/tuiles/` (cy-blackjack + polices, wt-pile) from the brainstorm prototypes.

**Interfaces:**
- Consumes: Task 1 (`avancer`, `copiesNecessaires`, `doitAvancer`, `GESTE_MS`), Task 2 (`TUILES`, `repartir`).
- Produces: `observer(colonne: HTMLElement): () => void` (chargement.ts) ; `monterMur(): void` (mur.ts).

Comportement (code complet à écrire dans les fichiers) :
- `index.html` : `<header>` « leteh » ; `<nav class="bascule">` deux boutons `aria-pressed` ; `<main class="mur">` avec `<section class="zone" data-appli="cyrose">` et `…watchtracker`, chacune `<div class="colonnes" aria-hidden="true">` + `<div class="bandeau">` (h2, p, a). Pied discret : lien mentions légales. Meta description, OG (`/og.jpg`), `lang="fr"`.
- Tuile DOM : `<figure class="tuile" data-id><img src="/tuiles/<id>.jpg" alt="" loading="lazy"></figure>` ; fond `#0b0b0d` si l'image manque (`img.onerror` → retire l'img).
- `chargement.ts` : un `IntersectionObserver` par colonne (`root` = colonne, `rootMargin: '100% 0px'`). Entrée → ajoute `<iframe src="/tuiles/<id>.html" tabindex="-1" title="">` en opacité 0, passe à 1 sur `load`. Sortie → retire l'iframe. Aucun ajout si `matchMedia('(prefers-reduced-motion: reduce)').matches`. Retourne une fonction de nettoyage (disconnect + retrait des iframes).
- `mur.ts` : `monterMur()` construit les colonnes selon `matchMedia('(min-width: 768px)')` (3/1 ou 2/2), `repartir`, duplique la copie `copiesNecessaires(hauteurCopie, hauteurVue)` fois (mesure après insertion), vitesses px/s `[24, -19, 28]` Cyrose et `[-21]`/`[21,-17]` Watchtracker. Boucle rAF : `dt = min(0.05, …)`, si `doitAvancer` → `pos = avancer(pos, v, dt, hauteurCopie)` ; `scrollTop = pos`. Écoute `wheel`, `touchstart`, `touchmove`, `pointerdown` → `gesteJusqua = now + GESTE_MS` ; `scroll` → si écart > 2 px avec `pos`, `pos = scrollTop` replié par `avancer(scrollTop, 0, 0, periode)`. Changement de breakpoint ou de mouvement réduit → nettoyage complet puis reconstruction. Mouvement réduit → pas de rAF.
- Bascule mobile : `document.body.dataset.appli` = `cyrose` | `watchtracker` ; CSS < 768 px masque l'autre zone ; la zone redevenue visible se reconstruit (mesures).
- `vercel.json` : `{"cleanUrls": true}`.

- [ ] **Step 1:** écrire les fichiers ; `npm run build` → OK, `npx vitest run` → PASS.
- [ ] **Step 2:** `npm run dev`, contrôle visuel via Playwright (captures 1440×900, 390×844).
- [ ] **Step 3:** commit `feat(mur): page, colonnes vivantes et chargement paresseux des tuiles`.

### Task 4: Vérification automatisée et affiches

**Files:** Create `scripts/verifier-mur.mjs`, `scripts/affiches.mjs`, `public/og.jpg`

- `affiches.mjs` : démarre Vite (`createServer`, port 4310), pour chaque entrée de `src/tuiles.ts` (lu par import dynamique via `vite.ssrLoadModule`) ouvre `/tuiles/<id>.html?t=<affiche>` en 390×844 DPR 2, attend 1,5 s, capture `public/tuiles/<id>.jpg` (jpeg 85). Génère aussi `public/og.jpg` (1200×630) en capturant `/` à 1200×630.
- `verifier-mur.mjs` : démarre Vite (port 4311) ; en 1440×900 : aucune `pageerror`, 4 colonnes, chaque `scrollTop` change en 1 s, molette sur la colonne 2 → seules ses valeurs sautent, pas de barre de défilement de page ; en 390×844 : 2 colonnes visibles, clic « Watchtracker » → zone Watchtracker visible ; geste `touchmove` simulé → la colonne ne bouge pas par l'auto-défilement pendant 500 ms ; redimensionnement 1440 → 600 → nombre d'iframes ≤ tuiles visibles + marge ; `reducedMotion: 'reduce'` → `scrollTop` immobile, 0 iframe. Captures dans `/tmp/leteh-verif/`. Sortie non nulle à la première violation.
- [ ] **Step 1:** écrire, `npm run affiches`, `npm run verifier` → tout vert.
- [ ] **Step 2:** commit `test(mur): vérification Playwright et affiches des tuiles`.

### Task 5: Atelier Blackjack reproductible

**Files:** Create `ateliers/cy-blackjack/**` (à partir du pipeline de prototype `/tmp/pwcheck/cyb`, `cy2-*.cjs`).
- `node ateliers/cy-blackjack/construire.mjs` régénère `public/tuiles/cy-blackjack.html` depuis `../cyrose-casino-table` ; chemins relatifs à l'atelier ; `LISEZMOI.md` (sources, commande, limites).
- [ ] Reconstruire, diff visuel avec la tuile actuelle ≈ 0, commit `chore(ateliers): atelier reproductible du Blackjack`.

### Tasks 6–14: Les tuiles restantes (parallélisables)

Une tâche par tuile, même contrat (spec § « Contrat d'une tuile »), même méthode de vérification (captures à plusieurs instants en 390×844 et 300×650 @2x, comparaison au vrai écran quand il est atteignable, aucune erreur JS). Chaque tâche écrit **uniquement** `public/tuiles/<id>.html`, `public/tuiles/<id>/`, polices `public/tuiles/<appli>-*.woff2`, `ateliers/<id>/`. Le manifeste (`src/tuiles.ts`) est mis à jour par le coordinateur.

| Task | id | Source | Scénario |
|---|---|---|---|
| 6 | cy-navale | cyrose_new `/labo-navale`, `lib/navale` | placement → tir qui touche → « coulé », toute la table |
| 7 | cy-undercover | cyrose_new `/labo-salons?cas=undercover-*`, `/labo-bar` | mot secret révélé → indices → vote → élimination |
| 8 | cy-poker | version la plus récente (`feat/casino-table` si la table y est, sinon `feat/poker`) | une main de Hold'em jusqu'à l'abattage |
| 9 | cy-roulette | cyrose-casino-table | mises sur le tapis → la bille → règlement en quatre temps |
| 10 | cy-menteur | cyrose_new `/labo-menteur`, `/labo-bar` | annonce → « Menteur ! » → révélation |
| 11 | cy-cliche | cyrose_new | consigne → photos → vote |
| 12 | cy-purple | cyrose_new | rouge/noir, plus haut/plus bas → carte retournée |
| 13 | cy-salon | cyrose_new `/labo-salons`, `/labo-bar/salon` | création du salon, code, les joueurs arrivent, choix du jeu |
| 14 | wt-fiche, wt-avenir, wt-amis | watchtracker | fiche : « J'en suis là » + note ; À venir : notification + dates ; Amis : activité de la semaine |

- [ ] Pour chaque tuile : construire, vérifier, puis le coordinateur ajoute l'entrée à `TUILES`, lance `npm run affiches` et `npm run verifier`, commit `feat(tuiles): <id>`.

### Task 15: Revue finale

- [ ] Revue de toute la branche, `npm run build && npm test && npm run verifier`, captures pour l'utilisateur.
