// node ateliers/cy-roulette/construire.mjs   (depuis la racine du portfolio)
//
// Régénère public/tuiles/cy-roulette.html depuis le worktree Cyrose
// ../cyrose-casino-table (branche feat/casino-table) :
//   1. esbuild compile harness.tsx — la vraie RlTable, le faux serveur, le script ;
//   2. le serveur Vite de Cyrose (sans écoute) rend les feuilles de l'appli
//      (Tailwind compris), figées pour un téléphone 390 × 844 ;
//   3. Chrome joue la tuile (direct, ?t=, mouvement réduit) et ne garde que les
//      règles qui ont touché un élément ;
//   4. les polices manquantes sont copiées à côté (cy-*.woff2).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(ICI, '../../../cyrose-casino-table/web');
const SORTIE = path.resolve(ICI, '../../public/tuiles');
const FICHIER = path.join(SORTIE, 'cy-roulette.html');
const POLICES = path.join(WT, 'public/fonts');
// Les feuilles de l'appli, dans l'ordre où l'appli les charge (main.tsx, puis
// CasinoRoot, CasinoTable, Roulette).
const FEUILLES = ['src/fonts.css', 'src/index.css', 'src/screens/casino/casino.css', 'src/screens/casino/table/table.css', 'src/screens/roulette/roulette.css'];

// ─── 1. Le JavaScript ───
const vues = new Set();
const stub = (p) => path.join(ICI, 'stubs', p);
const plugin = {
  name: 'tuile',
  setup(b) {
    b.onResolve({ filter: /^@wt\// }, (a) => b.resolve('./' + a.path.slice(4), { resolveDir: path.join(WT, 'src'), kind: a.kind }));
    b.onResolve({ filter: /\.css$/ }, (a) => {
      vues.add(path.relative(WT, path.resolve(a.path.startsWith('@wt/') ? path.join(WT, 'src') : a.resolveDir, a.path.replace(/^@wt\//, ''))));
      return { path: 'css', namespace: 'vide' };
    });
    b.onLoad({ filter: /.*/, namespace: 'vide' }, () => ({ contents: '', loader: 'js' }));
    b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: stub('router.tsx') }));
    b.onResolve({ filter: /(^|\/)lib\/supabase(\.ts)?$/ }, () => ({ path: stub('supabase.ts') }));
    b.onResolve({ filter: /(^|\/)lib\/sound(\.ts)?$/ }, () => ({ path: stub('sound.ts') }));
  },
};
const build = await esbuild.build({
  entryPoints: [path.join(ICI, 'harness.tsx')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  jsx: 'automatic', nodePaths: [path.join(WT, 'node_modules')], plugins: [plugin], legalComments: 'none',
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production"}' },
  logLevel: 'warning',
});
const js = build.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const horloge = fs.readFileSync(path.join(ICI, 'horloge.js'), 'utf8');
for (const v of vues) if (!FEUILLES.includes(v)) console.warn('feuille importée mais non chargée :', v);
console.log('js', js.length);

// ─── 2. Le CSS de l'appli ───
const wreq = createRequire(path.join(WT, 'package.json'));
const { createServer } = wreq('vite');
// Tailwind lit sa configuration (et ses `content`) depuis le dossier courant.
const ou = process.cwd();
process.chdir(WT);
const vite = await createServer({ root: WT, configFile: path.join(WT, 'vite.config.ts'), logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
let brut = '';
for (const f of FEUILLES) {
  const r = await vite.transformRequest('/' + f + '?direct');
  if (!r) throw new Error('feuille introuvable ' + f);
  brut += `/* ==== ${f} ==== */\n` + r.code + '\n';
}
await vite.close();
process.chdir(ou);

function parse(text) {
  const out = []; let i = 0; const n = text.length;
  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++;
    if (i >= n) break;
    let j = i, q = null;
    while (j < n) { const c = text[j]; if (q) { if (c === '\\') { j += 2; continue; } if (c === q) q = null; j++; continue; } if (c === '\\') { j += 2; continue; } if (c === '"' || c === "'") { q = c; j++; continue; } if (c === '{' || c === ';') break; j++; }
    const prelude = text.slice(i, j).trim();
    if (j >= n) break;
    if (text[j] === ';') { out.push({ type: 'stmt', text: prelude + ';' }); i = j + 1; continue; }
    let d = 1, k = j + 1; q = null;
    while (k < n && d > 0) { const c = text[k]; if (q) { if (c === '\\') { k += 2; continue; } if (c === q) q = null; k++; continue; } if (c === '\\') { k += 2; continue; } if (c === '"' || c === "'") q = c; else if (c === '{') d++; else if (c === '}') d--; k++; }
    const inner = text.slice(j + 1, k - 1);
    if (prelude.startsWith('@')) {
      if (/^@(media|supports|layer|container)\b/.test(prelude)) out.push({ type: 'group', prelude, children: parse(inner) });
      else out.push({ type: 'raw', prelude, body: inner });
    } else out.push({ type: 'rule', sel: prelude, body: inner });
    i = k;
  }
  return out;
}
// Les requêtes média, tranchées pour le téléphone de référence (390 × 844, tactile).
function verdictMedia(prelude) {
  const cond = prelude.replace(/^@media\s*/, '');
  if (/prefers-|print/.test(cond)) return 'garder';
  if (/hover:\s*hover|pointer:\s*fine/.test(cond)) return 'jeter';
  let ok = true, vu = false;
  cond.replace(/\((min|max)-(width|height):\s*([\d.]+)(rem|px|em)\)/g, (m, mm, dim, v, u) => {
    vu = true; const px = parseFloat(v) * (u === 'px' ? 1 : 16); const ref = dim === 'width' ? 390 : 844;
    if (mm === 'min' ? ref < px : ref > px) ok = false;
  });
  if (!vu) return 'garder';
  return ok ? 'deballer' : 'jeter';
}
function emettre(list) {
  let s = '';
  for (const r of list) {
    if (r.type === 'group') {
      if (r.prelude.startsWith('@media')) {
        const v = verdictMedia(r.prelude);
        if (v === 'jeter') continue;
        if (v === 'deballer') { s += emettre(r.children); continue; }
      }
      const inner = emettre(r.children);
      if (inner.trim()) s += r.prelude + '{\n' + inner + '}\n';
    } else if (r.type === 'rule') {
      let sel = r.sel;
      sel = sel.replace(/(^|[\s,>+~])body::(before|after)/g, '$1.cy-bg::$2');
      sel = sel.replace(/:active\b/g, ':is(:active, .cy-press)');
      s += sel + '{' + r.body.trim() + '}\n';
    } else if (r.type === 'raw') {
      if (r.prelude.startsWith('@font-face')) {
        const m = r.body.match(/url\(['"]?\/fonts\/([^'")]+)['"]?\)/);
        if (!m || /-ext\./.test(m[1])) continue;
        s += '@font-face{' + r.body.replace(m[0], `url('cy-${m[1]}')`).trim() + '}\n';
      } else s += r.prelude + '{' + r.body + '}\n';
    }
  }
  return s;
}
let css = emettre(parse(brut.replace(/\/\*[\s\S]*?\*\//g, '')));
// Les unités de fenêtre → le téléphone de référence (l'iframe n'est PAS cette fenêtre).
css = css.replace(/(-?\d*\.?\d+)(dvh|svh|lvh|vh)\b/g, (m, v) => (parseFloat(v) * 8.44).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)(dvw|svw|lvw|vw)\b/g, (m, v) => (parseFloat(v) * 3.9).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)vmax\b/g, (m, v) => (parseFloat(v) * 8.44).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)vmin\b/g, (m, v) => (parseFloat(v) * 3.9).toFixed(2) + 'px');

const git = (...a) => execFileSync('git', ['-C', WT, ...a], { encoding: 'utf8' }).trim();
const source = `<!-- Cyrose · Roulette — compilée depuis ../cyrose-casino-table (${git('rev-parse', '--abbrev-ref', 'HEAD')} @ ${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain', '--', 'src') ? ', avec modifications locales' : ''}) par ateliers/cy-roulette/construire.mjs -->`;
const gabarit = fs.readFileSync(path.join(ICI, 'template.html'), 'utf8').replace('<!--__SOURCE__-->', () => source);
function ecrire(feuille, polices) {
  const preload = polices.map((f) => `<link rel="preload" as="font" type="font/woff2" href="${f}" crossorigin>`).join('\n');
  fs.writeFileSync(FICHIER, gabarit
    .replace('<!--__PRELOAD__-->', () => preload)
    .replace('/*__CSS__*/', () => feuille)
    .replace('/*__HORLOGE__*/', () => horloge)
    .replace('/*__JS__*/', () => js));
}
// Les polices de la feuille complète, le temps de l'élagage.
const policesDe = (s) => [...new Set([...s.matchAll(/url\('(cy-[^']+\.woff2)'\)/g)].map((m) => m[1]))];
for (const f of policesDe(css)) if (!fs.existsSync(path.join(SORTIE, f))) fs.copyFileSync(path.join(POLICES, f.slice(3)), path.join(SORTIE, f));
ecrire(css, []);
if (process.env.SANS_ELAGAGE) { console.log('écrit sans élagage', fs.statSync(FICHIER).size); process.exit(0); }

// ─── 3. L'élagage, la tuile jouée dans Chrome ───
const serveur = http.createServer((req, res) => {
  const p = path.join(SORTIE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(SORTIE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${serveur.address().port}/cy-roulette.html`;
const nav = await chromium.launch({ channel: 'chrome' });
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.addInitScript({ path: path.join(ICI, 'collecte.js') });
await page.addInitScript(() => { window.__cySel = '#cy-css'; });
// Le collecteur garde ses marques d'une page à l'autre : on les transporte.
const passes = [
  { url: base, rm: 'no-preference', duree: 16000 },
  { url: base, rm: 'reduce', duree: 2500 },
  ...[2, 6, 10.5, 12.5, 14].map((t) => ({ url: `${base}?t=${t}`, rm: 'no-preference', duree: 0, fige: true })),
];
let marques = [];
for (const p of passes) {
  await page.emulateMedia({ reducedMotion: p.rm });
  await page.goto(p.url);
  await page.evaluate((m) => { window.__cyCollect(); window.__cyMarquer?.(m); }, marques);
  if (p.fige) await page.waitForFunction(() => document.documentElement.hasAttribute('data-fige'), null, { timeout: 30000 });
  await page.evaluate((duree) => new Promise((ok) => { const m = window.__cyMinuteur; const t0 = m.now(); const iv = m.set(() => { window.__cyCollect(); if (m.now() - t0 >= duree) { m.clear(iv); ok(); } }, 30); }), p.duree);
  console.log('passe', p.url.replace(base, '') || '(direct)', p.rm);
  marques = await page.evaluate(() => window.__cyMarques());
}
const elague = await page.evaluate(() => window.__cyEmit());
await nav.close();
serveur.close();
if (erreurs.length) console.warn('erreurs pendant l’élagage :', erreurs);

// Les keyframes : seulement celles qu'une animation nomme encore.
let final = elague.replace(/\/\* ==== [^*]*==== \*\/\n/g, '');
const kfRe = /@keyframes\s+([\w-]+)\s*\{/g;
for (const nom of [...final.matchAll(kfRe)].map((m) => m[1])) {
  const reste = final.replace(new RegExp('@keyframes\\s+' + nom + '\\s*\\{', 'g'), '');
  if (new RegExp('animation[^;{}]*\\b' + nom + '\\b').test(reste)) continue;
  const debut = final.search(new RegExp('@keyframes\\s+' + nom + '\\s*\\{'));
  let d = 0, k = final.indexOf('{', debut);
  for (; k < final.length; k++) { if (final[k] === '{') d++; else if (final[k] === '}') { d--; if (d === 0) break; } }
  final = final.slice(0, debut) + final.slice(k + 1);
}
// Les @font-face : seulement les familles qu'une règle gardée emploie.
const sansFontFace = final.replace(/@font-face\{[^}]*\}/g, '');
// (font-family comme raccourci `font:` : le nom suffit.)
const employee = (fam) => fam === 'Archivo' /* la police du cadre (#cy-stage) */ || sansFontFace.includes(fam);
final = final.replace(/@font-face\{font-family:\s*'([^']+)'[^}]*\}\n/g, (m, fam) => (employee(fam) ? m : ''));
final = final.replace(/\n\s*\n+/g, '\n');
const polices = policesDe(final);
for (const f of polices) if (!fs.existsSync(path.join(SORTIE, f))) fs.copyFileSync(path.join(POLICES, f.slice(3)), path.join(SORTIE, f));
ecrire(final, polices.filter((f) => /archivo|syne|space-mono-400/.test(f)));
console.log('css', css.length, '→', final.length, '· polices', polices.join(' '), '·', fs.statSync(FICHIER).size, 'octets');
