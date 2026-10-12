// Construit public/tuiles/cy-undercover.html depuis ../cyrose_new/web.
//   node ateliers/cy-undercover/construire.mjs        (depuis la racine du portfolio)
// 1. esbuild compile harnais.tsx + le vrai écran screens/uc/Undercover, faux serveur
//    branché (stubs/), en un seul script.
// 2. La feuille de l'appli (fonts.css + index.css) passe par Tailwind avec la
//    configuration de l'appli, puis est figée pour 390×844 (vh/vw en px, media
//    queries tranchées, fond du body sur .cy-bg, :active doublé par .cy-press).
// 3. La tuile est jouée une boucle entière dans Chrome (Playwright) : on ne garde
//    que les règles qui ont touché le DOM.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(ICI, '../../../cyrose_new/web');
const PORTFOLIO = path.resolve(ICI, '../..');
const SORTIE = path.join(PORTFOLIO, 'public/tuiles');
const FICHIER = path.join(SORTIE, 'cy-undercover.html');
const reqP = createRequire(path.join(PORTFOLIO, 'package.json'));
const reqW = createRequire(path.join(WEB, 'package.json'));

// ─── 1. Le script ───
const esbuild = reqP('esbuild');
const stub = (f) => path.join(ICI, 'stubs', f);
const aiguillage = {
  name: 'tuile',
  setup(b) {
    b.onResolve({ filter: /^@cy\// }, (a) => b.resolve('./' + a.path.slice(4), { resolveDir: path.join(WEB, 'src'), kind: a.kind }));
    b.onResolve({ filter: /\.css$/ }, () => ({ path: 'css', namespace: 'vide' }));
    b.onLoad({ filter: /.*/, namespace: 'vide' }, () => ({ contents: '', loader: 'js' }));
    b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: stub('router.tsx') }));
    b.onResolve({ filter: /^canvas-confetti$/ }, () => ({ path: stub('confetti.ts') }));
    b.onResolve({ filter: /(^|\/)lib\/supabase(\.ts)?$/ }, () => ({ path: stub('supabase.ts') }));
    b.onResolve({ filter: /(^|\/)lib\/ucApi(\.ts)?$/ }, () => ({ path: stub('ucApi.ts') }));
    b.onResolve({ filter: /(^|\/)lib\/sound(\.ts)?$/ }, () => ({ path: stub('sound.ts') }));
    b.onResolve({ filter: /(^|\/)lib\/identity(\.ts)?$/ }, () => ({ path: stub('identity.ts') }));
    // Le salon d'Undercover n'est jamais monté par la tuile.
    b.onResolve({ filter: /^\.\/UcLobby$/ }, () => ({ path: stub('vide.tsx') }));
  },
};
const r = await esbuild.build({
  entryPoints: [path.join(ICI, 'harnais.tsx')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  jsx: 'automatic', nodePaths: [path.join(WEB, 'node_modules')], plugins: [aiguillage], metafile: true,
  legalComments: 'none', resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs'], logLevel: 'warning',
  define: {
    'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true',
    'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production"}',
  },
});
const js = r.outputFiles[0].text;
const sources = Object.keys(r.metafile.inputs).filter((k) => k.includes('cyrose_new/web/src')).map((k) => k.replace(/.*cyrose_new\/web\//, ''));
console.log('script', js.length, 'octets ;', sources.length, 'fichiers de l’appli :', sources.join(', '));

// ─── 2. La feuille ───
const postcss = reqW('postcss');
const tailwind = reqW('tailwindcss');
const autoprefixer = reqW('autoprefixer');
const config = (await import(pathToFileURL(path.join(WEB, 'tailwind.config.js')).href)).default;
config.content = config.content.map((c) => path.join(WEB, c));
let css = '';
for (const f of ['src/fonts.css', 'src/index.css']) {
  const src = fs.readFileSync(path.join(WEB, f), 'utf8');
  const out = await postcss([tailwind(config), autoprefixer]).process(src, { from: path.join(WEB, f) });
  css += out.css + '\n';
}

function analyser(text) {
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
      if (/^@(media|supports|layer|container)\b/.test(prelude)) out.push({ type: 'group', prelude, children: analyser(inner) });
      else out.push({ type: 'raw', prelude, body: inner });
    } else out.push({ type: 'rule', sel: prelude, body: inner });
    i = k;
  }
  return out;
}
// Les media queries, tranchées pour le téléphone de référence (390 × 844, tactile).
function verdict(prelude) {
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
const polices = new Set();
function emettre(liste) {
  let s = '';
  for (const r of liste) {
    if (r.type === 'group') {
      if (r.prelude.startsWith('@media')) {
        const v = verdict(r.prelude);
        if (v === 'jeter') continue;
        if (v === 'deballer') { s += emettre(r.children); continue; }
      }
      const inner = emettre(r.children);
      if (inner.trim()) s += r.prelude + '{\n' + inner + '}\n';
    } else if (r.type === 'rule') {
      let sel = r.sel.replace(/(^|[\s,>+~])body::(before|after)/g, '$1.cy-bg::$2');
      sel = sel.replace(/:active\b/g, ':is(:active, .cy-press)');
      s += sel + '{' + r.body.trim() + '}\n';
    } else if (r.type === 'raw') {
      if (r.prelude.startsWith('@font-face')) {
        const m = r.body.match(/url\(['"]?\/fonts\/([^'")]+)['"]?\)/);
        if (!m || /-ext\./.test(m[1]) || /anton/.test(m[1])) continue;
        polices.add(m[1]);
        s += '@font-face{' + r.body.replace(m[0], `url('cy-${m[1]}')`).trim() + '}\n';
      } else s += r.prelude + '{' + r.body + '}\n';
    }
  }
  return s;
}
let feuille = emettre(analyser(css.replace(/\/\*[\s\S]*?\*\//g, '')));
// Unités de la fenêtre → le téléphone de référence (l'iframe n'est PAS cette fenêtre).
feuille = feuille
  .replace(/(-?\d*\.?\d+)(dvh|svh|lvh|vh)\b/g, (m, v) => (parseFloat(v) * 8.44).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)(dvw|svw|lvw|vw)\b/g, (m, v) => (parseFloat(v) * 3.9).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)vmax\b/g, (m, v) => (parseFloat(v) * 8.44).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)vmin\b/g, (m, v) => (parseFloat(v) * 3.9).toFixed(2) + 'px');

const gabarit = fs.readFileSync(path.join(ICI, 'gabarit.html'), 'utf8');
const ecrire = (f) => fs.writeFileSync(FICHIER, gabarit.replace('/*__CSS__*/', () => f).replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script')));
ecrire(feuille);
for (const p of polices) {
  const dest = path.join(SORTIE, 'cy-' + p);
  if (!fs.existsSync(dest)) fs.copyFileSync(path.join(WEB, 'public/fonts', p), dest);
}

// ─── 3. L'élagage ───
const { chromium } = reqP('playwright-core');
const nav = await chromium.launch({ channel: 'chrome' });
const garde = new Set();
const norm = (s) => s.replace(/\s+/g, ' ').trim();
for (const [mouvement, duree] of [['no-preference', 15600], ['reduce', 2500]]) {
  const page = await nav.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: mouvement });
  page.on('pageerror', (e) => console.error('ERREUR', e.message));
  await page.goto(pathToFileURL(FICHIER).href);
  await page.evaluate(() => { window.__cySel = '#cy-css'; });
  await page.addScriptTag({ path: path.join(ICI, 'elaguer-page.js') });
  await page.evaluate((d) => new Promise((ok) => {
    const t0 = performance.now();
    const iv = setInterval(() => { window.__cyCollect(); if (performance.now() - t0 > d) { clearInterval(iv); ok(); } }, 30);
  }), duree);
  const sortie = await page.evaluate(() => window.__cyEmit());
  sortie.replace(/([^{}\n][^{}]*)\{([^{}]*)\}/g, (x, sel, body) => { garde.add(norm(sel) + '{' + norm(body) + '}'); return x; });
  await page.close();
}
await nav.close();

function elaguer(liste) {
  let s = '';
  for (const r of liste) {
    if (r.type === 'group') { const inner = elaguer(r.children); if (inner.trim()) s += r.prelude + '{\n' + inner + '}\n'; }
    else if (r.type === 'rule') { if (garde.has(norm(r.sel) + '{' + norm(r.body) + '}')) s += r.sel + '{' + r.body.trim() + '}\n'; }
    else if (r.type === 'raw') s += r.prelude + '{' + r.body + '}\n';
  }
  return s;
}
let finale = elaguer(analyser(feuille));
// Les keyframes que plus rien n'appelle.
for (const nom of [...finale.matchAll(/@keyframes\s+([\w-]+)/g)].map((x) => x[1])) {
  const reste = finale.replace(new RegExp('@keyframes\\s+' + nom + '\\b', 'g'), '');
  if (!new RegExp('animation[^;{}]*\\b' + nom + '\\b').test(reste)) {
    const debut = finale.search(new RegExp('@keyframes\\s+' + nom + '\\s*\\{'));
    let d = 0, k = finale.indexOf('{', debut);
    for (; k < finale.length; k++) { if (finale[k] === '{') d++; else if (finale[k] === '}') { d--; if (d === 0) break; } }
    finale = finale.slice(0, debut) + finale.slice(k + 1);
  }
}
// Les polices que plus rien n'appelle (familles absentes des règles gardées).
finale = finale.replace(/@font-face\{[^}]*font-family:\s*'([^']+)'[^}]*\}\n?/g, (m, fam) =>
  new RegExp(`font-family:[^;}]*${fam}`).test(finale.replace(/@font-face\{[^}]*\}/g, '')) ? m : '');
ecrire(finale);
console.log('feuille', feuille.length, '->', finale.length, '; tuile', fs.statSync(FICHIER).size, 'octets ->', path.relative(PORTFOLIO, FICHIER));
