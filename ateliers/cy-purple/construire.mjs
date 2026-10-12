// Construit public/tuiles/cy-purple.html depuis les sources de Cyrose.
//   node ateliers/cy-purple/construire.mjs        (depuis la racine du portfolio)
//
// 1. compile la vraie table de Purple (esbuild) avec l'entrée `tuile.tsx` ;
// 2. compile la feuille de l'appli (Tailwind + index.css + purple.css) ;
// 3. joue la tuile brute dans Chrome (playwright-core) sur toute la boucle et
//    garde les seules règles qui touchent un élément, les @media évalués pour un
//    téléphone 390×844, les unités d'écran figées en px ;
// 4. écrit la tuile et copie les polices manquantes (cy-*.woff2).
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const RACINE = process.cwd();
const ATELIER = path.join(RACINE, 'ateliers/cy-purple');
const CY = path.resolve(RACINE, process.env.CYROSE ?? '../cyrose_new', 'web');
const SRC = path.join(CY, 'src');
const SORTIE = path.join(RACINE, 'public/tuiles/cy-purple.html');
const POLICES = path.join(RACINE, 'public/tuiles');
const W = 390;
const H = 844;
const DUREE = 13.1; // = DUREE de tuile.tsx

if (!existsSync(path.join(SRC, 'screens/purple/PurpleTable.tsx'))) {
  throw new Error(`Sources de Cyrose introuvables : ${SRC}`);
}
const git = (cmd) => execSync(`git -C "${CY}" ${cmd}`, { encoding: 'utf8' }).trim();
console.log(`Cyrose : ${git('rev-parse --abbrev-ref HEAD')} @ ${git('rev-parse --short HEAD')}`);

// ------------------------------------------------------------------ 1. JS
// Les cartes du scénario seulement : le paquet complet de @letele pèse 500 Ko.
const CARTES = ['B1', 'C3', 'Dj', 'S5', 'H9', 'Sk', 'H4', 'D7', 'Hq', 'H2', 'Cq', 'S10', 'C8', 'D6'];
const cyRequire = createRequire(path.join(CY, 'package.json'));
const paquet = path.join(CY, 'node_modules/@letele/playing-cards/dist/index.esm.js'); // pas de « main », seulement « module »

const branchements = {
  name: 'branchements',
  setup(b) {
    b.onResolve({ filter: /^@cy\// }, (a) =>
      b.resolve('./' + a.path.slice(4), { resolveDir: SRC, kind: a.kind }));
    b.onResolve({ filter: /\/lib\/supabase$/ }, () => ({ path: path.join(ATELIER, 'stubs/supabase.ts') }));
    b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: path.join(ATELIER, 'stubs/router.tsx') }));
    b.onResolve({ filter: /^@letele\/playing-cards$/ }, () => ({ path: 'cartes', namespace: 'cartes' }));
    b.onLoad({ filter: /.*/, namespace: 'cartes' }, () => ({
      contents: `export { ${CARTES.join(', ')} } from ${JSON.stringify(paquet)};`,
      resolveDir: CY,
    }));
  },
};

const js = await esbuild.build({
  entryPoints: [path.join(ATELIER, 'tuile.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
  legalComments: 'none',
  target: 'es2020',
  jsx: 'automatic',
  nodePaths: [path.join(CY, 'node_modules')],
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
  },
  plugins: [branchements],
  logLevel: 'warning',
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// ------------------------------------------------------------------ 2. CSS
const postcss = cyRequire('postcss');
const tailwind = cyRequire('tailwindcss');
const autoprefixer = cyRequire('autoprefixer');
const config = (await import(pathToFileURL(path.join(CY, 'tailwind.config.js')).href)).default;
config.content = [path.join(CY, 'index.html'), path.join(SRC, '**/*.{ts,tsx}')];

const feuilles = ['fonts.css', 'index.css', 'screens/purple/purple.css'];
let css = '';
for (const f of feuilles) {
  const from = path.join(SRC, f);
  const r = await postcss([tailwind(config), autoprefixer()]).process(readFileSync(from, 'utf8'), { from });
  css += r.css + '\n';
}

// La tuile elle-même : la scène, le doigt, l'appui rejoué.
const CSS_TUILE = `
html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; background: #4a0f8a; }
#cy-stage { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; overflow: hidden;
  background: #4a0f8a; font-family: 'Archivo', system-ui, sans-serif; color: var(--text); }
#cy-host { position: absolute; inset: 0; }
#cy-host, #cy-host * { pointer-events: none; }
/* L'appui du doigt : la règle :active de purple.css, rejouée par une classe. */
.pa-b.cy-press:not(:disabled) { filter: brightness(0.86); }
/* Le doigt fictif : un disque blanc translucide (le même que cy-blackjack). */
#cy-finger, #cy-ripple { position: absolute; left: 0; top: 0; z-index: 500; width: 46px; height: 46px; margin: -23px 0 0 -23px;
  border-radius: 50%; pointer-events: none; opacity: 0; will-change: transform, opacity; }
#cy-finger { background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.42), rgba(255,255,255,0.22) 70%);
  box-shadow: 0 0 0 1.5px rgba(255,255,255,0.45), 0 8px 22px -8px rgba(0,0,0,0.7); }
#cy-ripple { box-shadow: 0 0 0 1.5px rgba(255,255,255,0.6); }
@media (prefers-reduced-motion: reduce) { #cy-finger, #cy-ripple { display: none; } }
`;

const page = (feuille) => `<!DOCTYPE html>
<html lang="fr" data-theme="default" style="--magenta: 255 30 140;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cyrose · Purple</title>
<link rel="icon" href="data:,">
<link rel="preload" as="font" type="font/woff2" href="cy-anton-400-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="cy-space-mono-700-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="cy-space-mono-400-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="cy-archivo-400-latin.woff2" crossorigin>
<style id="cy-css">
${feuille}
</style>
<style>${CSS_TUILE}</style>
</head>
<body>
<div id="cy-stage" aria-hidden="true"><div id="cy-host"></div><div id="cy-ripple"></div><div id="cy-finger"></div></div>
<script>${code}</script>
</body>
</html>
`;

// ------------------------------------------------------------------ 3. élagage
const racine = postcss.parse(css);
const selecteurs = new Set();
// Le grain et les halos du site (body::before / ::after) passent SOUS #root
// dans l'appli (z-index 1) : la table de Purple, opaque, les cache. Dans la
// tuile, ils passeraient par-dessus la scène : on les écarte.
const EXCLUS = new Set(['body::before', 'body::after']);
racine.walkRules((r) => {
  if (r.parent?.type === 'atrule' && /keyframes$/i.test(r.parent.name)) return;
  for (const s of r.selectors) if (!EXCLUS.has(s)) selecteurs.add(s);
});
const medias = new Set();
racine.walkAtRules('media', (a) => medias.add(a.params));

const brut = path.join(mkdtempSync(path.join(tmpdir(), 'cy-purple-')), 'brut.html');
writeFileSync(brut, page(css));

const navigateur = await chromium.launch({ channel: 'chrome' });
const ctx = await navigateur.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'no-preference',
});
const onglet = await ctx.newPage();
const erreurs = [];
onglet.on('pageerror', (e) => erreurs.push(e.message));
await onglet.goto(pathToFileURL(brut).href + '?t=0');
await onglet.evaluate((liste) => {
  const DYN = /::?(before|after|placeholder|selection|backdrop|marker|file-selector-button|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?|:(hover|active|focus-visible|focus-within|focus|visited)/g;
  window.__releve = { reste: new Map(liste.map((s) => {
    let q = s.replace(DYN, '').trim();
    if (!q || /[>+~]$/.test(q)) q = (q + ' *').trim();
    return [s, q];
  })), vus: new Set(), fautifs: new Set() };
}, [...selecteurs]);
for (let t = 0; t <= DUREE; t += 0.05) {
  await onglet.evaluate((t) => {
    window.__cyAller(t);
    const { reste, vus, fautifs } = window.__releve;
    for (const [s, q] of reste) {
      try {
        if (document.querySelector(q)) { vus.add(s); reste.delete(s); }
      } catch { fautifs.add(s); reste.delete(s); }
    }
  }, t);
}
const { vus, fautifs } = await onglet.evaluate(() => ({ vus: [...window.__releve.vus], fautifs: [...window.__releve.fautifs] }));
const mediasVrais = await onglet.evaluate((l) => l.filter((m) => matchMedia(m).matches), [...medias]);
await navigateur.close();
if (erreurs.length) throw new Error('Erreurs JS pendant l’élagage :\n' + erreurs.join('\n'));
if (fautifs.length) console.log(`(${fautifs.length} sélecteurs non testables écartés)`);

const gardes = new Set(vus);
const vrais = new Set(mediasVrais);
racine.walkComments((c) => c.remove());
// Les @media sont tranchés pour un téléphone 390×844 (l'iframe, plus étroite,
// n'a pas à les réévaluer), SAUF le mouvement réduit : il reste, pour que
// l'état fixe montré à ces visiteurs soit celui de l'appli en mouvement réduit.
racine.walkAtRules('media', (a) => {
  if (/prefers-reduced-motion/.test(a.params)) return;
  if (vrais.has(a.params)) a.replaceWith(a.nodes ?? []);
  else a.remove();
});
racine.walkRules((r) => {
  if (r.parent?.type === 'atrule' && /keyframes$/i.test(r.parent.name)) return;
  const s = r.selectors.filter((x) => gardes.has(x));
  if (!s.length) r.remove();
  else r.selectors = s;
});
racine.walkAtRules((a) => {
  if (!/keyframes$/i.test(a.name) && a.nodes && a.nodes.length === 0) a.remove();
});

// Les unités d'écran, figées pour 390×844 (l'iframe fait 220 à 340 px de large).
const fige = (v) => v
  .replace(/env\(\s*safe-area-inset-[a-z]+\s*(?:,\s*[^()]*)?\)/g, '0px')
  .replace(/(-?\d*\.?\d+)(dvh|svh|lvh|vh)\b/g, (_, n) => `${+(n * H / 100).toFixed(3)}px`)
  .replace(/(-?\d*\.?\d+)(dvw|svw|lvw|vw)\b/g, (_, n) => `${+(n * W / 100).toFixed(3)}px`)
  .replace(/(-?\d*\.?\d+)vmin\b/g, (_, n) => `${+(n * W / 100).toFixed(3)}px`)
  .replace(/(-?\d*\.?\d+)vmax\b/g, (_, n) => `${+(n * H / 100).toFixed(3)}px`);
racine.walkDecls((d) => { d.value = fige(d.value); });

// Animations référencées et polices utilisées.
const animations = new Set();
const familles = new Set();
racine.walkDecls((d) => {
  if (d.parent?.type === 'atrule') return;
  if (/^(-webkit-)?animation(-name)?$/.test(d.prop)) {
    for (const mot of d.value.split(/[\s,]+/)) animations.add(mot);
  }
  if (d.prop === 'font-family' || d.prop === 'font') {
    for (const f of d.value.split(',')) familles.add(f.trim().replace(/^['"]|['"]$/g, ''));
  }
  if (d.prop.startsWith('--')) for (const f of d.value.split(',')) familles.add(f.trim().replace(/^['"]|['"]$/g, ''));
});
racine.walkAtRules(/keyframes$/i, (a) => { if (!animations.has(a.params)) a.remove(); });
const polices = new Set();
racine.walkAtRules('font-face', (a) => {
  let famille = '';
  let src = null;
  a.walkDecls((d) => {
    if (d.prop === 'font-family') famille = d.value.replace(/['"]/g, '');
    if (d.prop === 'src') src = d;
  });
  const m = src?.value.match(/url\('?\/fonts\/([^')]+-latin\.woff2)'?\)/);
  if (!familles.has(famille) || !m) { a.remove(); return; }
  polices.add(m[1]);
  src.value = src.value.replace(/url\([^)]*\)/, `url('cy-${m[1]}')`);
});

const feuille = racine.toString().replace(/\n{2,}/g, '\n');
writeFileSync(SORTIE, page(feuille));

// ------------------------------------------------------------------ 4. polices
for (const p of polices) {
  const cible = path.join(POLICES, `cy-${p}`);
  if (!existsSync(cible)) {
    copyFileSync(path.join(CY, 'public/fonts', p), cible);
    console.log(`police copiée : cy-${p}`);
  }
}
const ko = (n) => `${(n / 1024).toFixed(0)} Ko`;
console.log(`${path.relative(RACINE, SORTIE)} : ${ko(readFileSync(SORTIE).length)} (CSS ${ko(feuille.length)}, JS ${ko(code.length)}), ${gardes.size} sélecteurs gardés`);
