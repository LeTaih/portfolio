// Construit public/tuiles/cy-poker.html — lancé depuis la racine du portfolio :
//
//   node ateliers/cy-poker/construire.mjs
//
// 1. compile la vraie table du Poker (PkTable) depuis le worktree Cyrose
//    (feat/casino-table) avec esbuild, en remplaçant lib/supabase, lib/appelApi
//    et react-router-dom par les faux de ./src/faux ;
// 2. passe la feuille de l'appli par Tailwind (sa config), la fige pour un écran
//    de 390 × 844 (unités d'écran en px, body:: → .cy-bg::, :active → .cy-press) ;
// 3. joue une boucle complète dans Chrome (Playwright) et ne garde que les règles
//    dont un sélecteur a touché un élément ;
// 4. copie les polices manquantes (cy-*.woff2) à côté.
//
// Source : CYROSE=<chemin du dépôt Cyrose> (défaut ../cyrose-casino-table).
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '../..');
const CYROSE = resolve(RACINE, process.env.CYROSE ?? '../cyrose-casino-table');
const WEB = join(CYROSE, 'web');
const SRC = join(WEB, 'src');
const SORTIE = join(RACINE, 'public/tuiles/cy-poker.html');
const POLICES = join(RACINE, 'public/tuiles');
const L = 390, H = 844;

const exiger = createRequire(join(WEB, 'package.json'));

// ── 1. Le JavaScript ────────────────────────────────────────────────────────
const FAUX = {
  [join(SRC, 'lib/supabase.ts')]: join(ICI, 'src/faux/supabase.ts'),
  [join(SRC, 'lib/appelApi.ts')]: join(ICI, 'src/faux/appelApi.ts'),
};
const substitutions = {
  name: 'substitutions',
  setup(b) {
    b.onResolve({ filter: /^@cy\// }, (a) => b.resolve('./' + a.path.slice(4), { resolveDir: SRC, kind: a.kind }));
    b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: join(ICI, 'src/faux/router.tsx') }));
    b.onResolve({ filter: /(supabase|appelApi)$/ }, async (a) => {
      if (a.pluginData === 'vrai') return undefined;
      const r = await b.resolve(a.path, { resolveDir: a.resolveDir, kind: a.kind, pluginData: 'vrai' });
      return FAUX[r.path] ? { path: FAUX[r.path] } : r;
    });
    // Les feuilles sont traitées à part (étape 2).
    b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'feuille' }));
    b.onLoad({ filter: /.*/, namespace: 'feuille' }, () => ({ contents: '', loader: 'js' }));
  },
};
const js = await esbuild.build({
  entryPoints: [join(ICI, 'src/tuile.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
  target: 'es2022',
  jsx: 'automatic',
  nodePaths: [join(WEB, 'node_modules')],
  plugins: [substitutions],
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    'process.env.NODE_ENV': '"production"',
  },
  legalComments: 'none',
  logLevel: 'warning',
});
const code = js.outputFiles[0].text.replaceAll('</script', '<\\/script');

// ── 2. La feuille ───────────────────────────────────────────────────────────
const postcss = exiger('postcss');
const tailwind = exiger('tailwindcss');
const config = (await import(pathToFileURL(join(WEB, 'tailwind.config.js')).href)).default;
const tw = tailwind({ ...config, content: [join(WEB, 'index.html'), join(SRC, '**/*.{ts,tsx}')] });
const lire = (f) => readFileSync(join(SRC, f), 'utf8');
// L'ordre de l'appli : main.tsx (fonts, index), puis Poker.tsx (CasinoRoot → casino.css,
// PkTable → CasinoTable → table.css, puis poker.css).
const brut = [
  lire('fonts.css'),
  (await postcss([tw]).process(lire('index.css'), { from: join(SRC, 'index.css') })).css,
  lire('screens/casino/casino.css'),
  lire('screens/casino/table/table.css'),
  lire('screens/poker/poker.css'),
].join('\n');

const ecran = (n, u) => `${(parseFloat(n) * (u === 'vw' ? L : H) / 100).toFixed(2)}px`;
let css = brut
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(\d*\.?\d+)(vw|dvh|svh|lvh|vh)\b/g, (_, n, u) => ecran(n, u))
  .replace(/\bbody(\[[^\]]*\])?::(before|after)/g, (_, attr = '', p) => `.cy-bg${attr}::${p}`)
  .replace(/:active\b/g, ':is(:active, .cy-press)');

const racineCss = postcss.parse(css);
// Les polices : le latin seul, servi à côté de la tuile sous le nom cy-*.
const policesUtiles = new Set();
racineCss.walkAtRules('font-face', (r) => {
  let src = '';
  r.walkDecls('src', (d) => { src = d.value; });
  const m = src.match(/\/fonts\/([a-z0-9-]+)\.woff2/);
  if (!m || !m[1].endsWith('-latin')) { r.remove(); return; }
  r.walkDecls('src', (d) => { d.value = d.value.replace(`/fonts/${m[1]}.woff2`, `cy-${m[1]}.woff2`); });
});

// ── 3. L'élagage : une boucle jouée dans Chrome ─────────────────────────────
const coque = readFileSync(join(ICI, 'coque.html'), 'utf8');
const assembler = (feuille, precharge = '') => coque
  .replace('<!--PRECHARGE-->', () => precharge)
  .replace('/*CSS*/', () => feuille)
  .replace('/*JS*/', () => code);

/** Un sélecteur sans pseudo-classes ni pseudo-éléments : ce qu'on cherche dans le DOM. */
function nu(sel) {
  let o = '', i = 0;
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === '[') { const j = sel.indexOf(']', i); o += sel.slice(i, j + 1); i = j + 1; continue; }
    if (ch === '\\') { o += sel.slice(i, i + 2); i += 2; continue; }
    if (ch === ':') {
      i++;
      if (sel[i] === ':') i++;
      while (i < sel.length && /[a-zA-Z0-9_-]/.test(sel[i])) i++;
      if (sel[i] === '(') { let p = 0; do { if (sel[i] === '(') p++; else if (sel[i] === ')') p--; i++; } while (i < sel.length && p > 0); }
      continue;
    }
    o += ch; i++;
  }
  o = o.replace(/\s+/g, ' ').replace(/\s*([>+~])\s*/g, '$1').trim().replace(/(^|[>+~ ])(?=[>+~ ]|$)/g, '$1*');
  return o || '*';
}
const regles = [];
racineCss.walkRules((r) => {
  if (r.parent?.type === 'atrule' && /keyframes$/.test(r.parent.name)) return;
  regles.push(r);
});
const tous = [...new Set(regles.flatMap((r) => r.selectors.map(nu)))];

const tmp = mkdtempSync(join(tmpdir(), 'cy-poker-'));
const brouillon = join(tmp, 'cy-poker.html');
writeFileSync(brouillon, assembler(racineCss.toString()));
const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ viewport: { width: L, height: H } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
await page.goto(pathToFileURL(brouillon).href);
await page.evaluate((sels) => {
  const vus = new Set();
  window.__vus = vus;
  const sonder = () => { for (const s of sels) { if (vus.has(s)) continue; try { if (document.querySelector(s)) vus.add(s); } catch { vus.add(s); } } };
  sonder();
  setInterval(sonder, 40);
}, tous);
await page.waitForTimeout(15500);
const vus = new Set(await page.evaluate(() => [...window.__vus]));
if (process.env.TRACE) writeFileSync(process.env.TRACE, JSON.stringify({ tous, vus: [...vus] }, null, 1));
await navigateur.close();
if (erreurs.length) { console.error(erreurs.join('\n')); process.exit(1); }

for (const r of regles) if (!r.selectors.some((s) => vus.has(nu(s)))) r.remove();
// Ce qui reste nommé : animations et familles de polices.
const texte = racineCss.toString();
racineCss.walkAtRules(/keyframes$/, (r) => {
  if (!new RegExp(`animation(-name)?\\s*:[^;}]*\\b${r.params.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(texte)) r.remove();
});
racineCss.walkAtRules('font-face', (r) => {
  let fam = '';
  r.walkDecls('font-family', (d) => { fam = d.value.replace(/['"]/g, ''); });
  let utilisee = false;
  racineCss.walkDecls(/^font(-family)?$/, (d) => { if (d.parent !== r && d.value.includes(fam)) utilisee = true; });
  if (!utilisee) { r.remove(); return; }
  r.walkDecls('src', (d) => { const m = d.value.match(/cy-[a-z0-9-]+\.woff2/); if (m) policesUtiles.add(m[0]); });
});
let vide;
do { vide = false; racineCss.walkAtRules((r) => { if (r.nodes && r.nodes.length === 0) { r.remove(); vide = true; } }); } while (vide);

// ── 4. Les polices et la tuile ──────────────────────────────────────────────
for (const p of policesUtiles) {
  const dest = join(POLICES, p);
  if (!existsSync(dest)) { copyFileSync(join(WEB, 'public/fonts', p.slice(3)), dest); console.log('police copiée :', p); }
}
const precharge = [...policesUtiles].filter((p) => !p.includes('anton'))
  .map((p) => `<link rel="preload" as="font" type="font/woff2" href="${p}" crossorigin>`).join('\n');
const final = assembler(racineCss.toString().replace(/\n{3,}/g, '\n\n'), precharge);
writeFileSync(SORTIE, final);
console.log(`${SORTIE} : ${(final.length / 1024).toFixed(0)} Ko (${tous.length} sélecteurs, ${vus.size} vus)`);
