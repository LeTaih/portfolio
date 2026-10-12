// Construit public/tuiles/cy-cliche.html (+ public/tuiles/cy-cliche/*.jpg,
// cy-anton-400-latin.woff2) depuis les vrais écrans de Cliché.
//
//   node ateliers/cy-cliche/construire.mjs        (depuis la racine du portfolio)
//
// Étapes : 1. les tirages (photos.js, peints dans Chrome) → JPEG ;
// 2. le CSS de l'appli (index.css passé par son Tailwind, figé pour 390×844) ;
// 3. le JS (tuile.tsx + vrais écrans, esbuild, stubs réseau) ; 4. assemblage ;
// 5. élagage du CSS d'après le DOM d'une vraie partie (deux passes : lecture
// et mouvement réduit).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const ATELIER = path.dirname(fileURLToPath(import.meta.url));
const ici = (...p) => path.resolve(ATELIER, ...p);
const WEB = ici('../../../cyrose_new/web');
const PUBLIC = ici('../../public/tuiles');
const SORTIE = path.join(PUBLIC, 'cy-cliche.html');
const PHOTOS = path.join(PUBLIC, 'cy-cliche');
const W = 390, H = 844;
const requireWeb = createRequire(path.join(WEB, 'package.json'));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ─── 1. Les tirages ──────────────────────────────────────────────────────────
const navigateur = await chromium.launch({ channel: 'chrome' });
fs.mkdirSync(PHOTOS, { recursive: true });
{
  const p = await navigateur.newPage();
  await p.setContent('<html><body></body></html>');
  await p.addScriptTag({ path: ici('photos.js') });
  for (const nom of await p.evaluate(() => window.__photos)) {
    const url = await p.evaluate((n) => window.__photo(n).toDataURL('image/jpeg', 0.8), nom);
    fs.writeFileSync(path.join(PHOTOS, `${nom}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  }
  await p.close();
  log('tirages', fs.readdirSync(PHOTOS).join(' '));
}

// ─── Polices : Anton manque aux tuiles Cyrose ───────────────────────────────
for (const [src, dst] of [
  ['anton-400-latin.woff2', 'cy-anton-400-latin.woff2'],
  ['archivo-400-latin.woff2', 'cy-archivo-400-latin.woff2'],
  ['space-mono-400-latin.woff2', 'cy-space-mono-400-latin.woff2'],
  ['space-mono-700-latin.woff2', 'cy-space-mono-700-latin.woff2'],
  ['syne-700-latin.woff2', 'cy-syne-700-latin.woff2'],
]) {
  const d = path.join(PUBLIC, dst);
  if (!fs.existsSync(d)) { fs.copyFileSync(path.join(WEB, 'public/fonts', src), d); log('police', dst); }
}
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const police = (famille, poids, fichier) =>
  `@font-face{font-family:'${famille}';font-style:normal;font-weight:${poids};font-display:swap;src:url('${fichier}') format('woff2');unicode-range:${LATIN};}`;
const POLICES = [
  police('Anton', 400, 'cy-anton-400-latin.woff2'),
  ...[400, 600, 700].map((p) => police('Archivo', p, 'cy-archivo-400-latin.woff2')),
  police('Space Mono', 400, 'cy-space-mono-400-latin.woff2'),
  police('Space Mono', 700, 'cy-space-mono-700-latin.woff2'),
  ...[700, 800].map((p) => police('Syne', p, 'cy-syne-700-latin.woff2')),
].join('\n');

// ─── 2. Le CSS de l'appli, figé pour un téléphone 390 × 844 ─────────────────
const postcss = requireWeb('postcss');
const tailwindcss = requireWeb('tailwindcss');
const autoprefixer = requireWeb('autoprefixer');
const configTw = (await import(pathToFileURL(path.join(WEB, 'tailwind.config.js')).href)).default;
const css0 = (await postcss([
  tailwindcss({ ...configTw, content: [path.join(WEB, 'src/screens/cliche/*.tsx'), path.join(WEB, 'src/screens/shared/NavBar.tsx'), ici('tuile.tsx')] }),
  autoprefixer,
]).process(fs.readFileSync(path.join(WEB, 'src/index.css'), 'utf8'), { from: path.join(WEB, 'src/index.css') })).css;

// Les @media de taille sont tranchés ici, pour 390 × 844 : l'iframe fait 220 à
// 340 px de large, elle ne doit pas réveiller les règles « petit écran ».
const enPx = (v, u) => (u === 'px' ? +v : +v * 16);
function trancherRequete(req) {
  req = req.trim();
  if (/^not\b|\bonly\b/.test(req)) return { v: null, req };
  const morceaux = req.split(/\s+and\s+/i);
  const restent = [];
  for (const m of morceaux) {
    const t = m.trim().toLowerCase();
    if (t === 'screen' || t === 'all') continue;
    if (t === 'print') return { v: false };
    const f = t.match(/^\((min|max)-(width|height)\s*:\s*([\d.]+)(px|rem|em)\)$/);
    if (f) {
      const val = enPx(f[3], f[4]), dim = f[2] === 'width' ? W : H;
      if (!(f[1] === 'min' ? dim >= val : dim <= val)) return { v: false };
      continue;
    }
    const o = t.match(/^\(orientation\s*:\s*(portrait|landscape)\)$/);
    if (o) { if (o[1] !== 'portrait') return { v: false }; continue; }
    if (/width|height|aspect-ratio/.test(t)) return { v: null, req }; // forme inattendue : on ne touche pas
    restent.push(m.trim());
  }
  return restent.length ? { v: null, req: restent.join(' and ') } : { v: true };
}
function decouper(texte) {
  // Découpe en blocs de premier niveau (prélude + corps), chaînes comprises.
  const blocs = [];
  let i = 0;
  const n = texte.length;
  while (i < n) {
    while (i < n && /\s/.test(texte[i])) i++;
    if (i >= n) break;
    let j = i, q = null;
    while (j < n) {
      const c = texte[j];
      if (q) { if (c === '\\') { j += 2; continue; } if (c === q) q = null; j++; continue; }
      if (c === '"' || c === "'") { q = c; j++; continue; }
      if (c === '{' || c === ';') break;
      j++;
    }
    const prelude = texte.slice(i, j).trim();
    if (j >= n) break;
    if (texte[j] === ';') { blocs.push({ prelude, corps: null }); i = j + 1; continue; }
    let d = 1, k = j + 1; q = null;
    while (k < n && d > 0) {
      const c = texte[k];
      if (q) { if (c === '\\') { k += 2; continue; } if (c === q) q = null; k++; continue; }
      if (c === '"' || c === "'") q = c; else if (c === '{') d++; else if (c === '}') d--;
      k++;
    }
    blocs.push({ prelude, corps: texte.slice(j + 1, k - 1) });
    i = k;
  }
  return blocs;
}
function figer(texte) {
  return decouper(texte.replace(/\/\*[\s\S]*?\*\//g, '')).map(({ prelude, corps }) => {
    if (corps === null) return prelude + ';\n';
    const m = prelude.match(/^@media\s+(.*)$/is);
    if (m) {
      const reqs = m[1].split(',').map(trancherRequete);
      if (reqs.some((r) => r.v === true)) return figer(corps);
      const vivantes = reqs.filter((r) => r.v === null);
      if (!vivantes.length) return '';
      return `@media ${vivantes.map((r) => r.req).join(', ')}{\n${figer(corps)}}\n`;
    }
    if (/^@(supports|layer|container)\b/.test(prelude)) return `${prelude}{\n${figer(corps)}}\n`;
    if (prelude.startsWith('@')) return `${prelude}{${corps}}\n`;
    return `${prelude}{${corps.trim()}}\n`;
  }).join('');
}
const unite = (n, base) => `${+(base * n / 100).toFixed(2)}px`;
let css = figer(css0)
  // le fond « rave » (grain + halos) du body vit dans .cy-bg, sous l'écran
  .replace(/\bbody::before\b/g, '.cy-bg::before')
  .replace(/\bbody::after\b/g, '.cy-bg::after')
  .replace(/(-?\d*\.?\d+)(dvh|svh|lvh|vh)\b/g, (_, n) => unite(n, H))
  .replace(/(-?\d*\.?\d+)(dvw|svw|lvw|vw)\b/g, (_, n) => unite(n, W));
log('css', Math.round(css0.length / 1024), 'Ko →', Math.round(css.length / 1024), 'Ko (figé)');

// ─── 3. Le JS ────────────────────────────────────────────────────────────────
const stub = (f) => ici('stubs', f);
const PHASES_ABSENTES = /^\.\/(ClicheLobby|ClichePropose|ClichePhoto|ClicheScores)$/;
const branchements = {
  name: 'tuile',
  setup(b) {
    b.onResolve({ filter: /^@cy\// }, (a) => b.resolve('./' + a.path.slice(4), { resolveDir: path.join(WEB, 'src'), kind: a.kind }));
    b.onResolve({ filter: /\.css$/ }, () => ({ path: 'css', namespace: 'vide' }));
    b.onLoad({ filter: /.*/, namespace: 'vide' }, () => ({ contents: '', loader: 'js' }));
    b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: stub('router.tsx') }));
    b.onResolve({ filter: /(^|\/)lib\/supabase(\.ts)?$/ }, () => ({ path: stub('supabase.ts') }));
    b.onResolve({ filter: /(^|\/)lib\/clicheApi(\.ts)?$/ }, () => ({ path: stub('clicheApi.ts') }));
    b.onResolve({ filter: /(^|\/)lib\/sound(\.ts)?$/ }, () => ({ path: stub('sound.ts') }));
    b.onResolve({ filter: /^\.\/useUploadQueue$/ }, () => ({ path: stub('useUploadQueue.ts') }));
    b.onResolve({ filter: PHASES_ABSENTES }, () => ({ path: stub('absent.tsx') }));
  },
};
const lot = await esbuild.build({
  entryPoints: [ici('tuile.tsx')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, metafile: true,
  jsx: 'automatic', nodePaths: [path.join(WEB, 'node_modules')], plugins: [branchements], legalComments: 'none',
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production"}' },
  logLevel: 'warning',
});
const js = lot.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
for (const f of Object.keys(lot.metafile.inputs)) if (/supabase-js|@supabase/.test(f)) throw new Error('supabase embarqué : ' + f);
log('js', Math.round(js.length / 1024), 'Ko');

// ─── 4. Assemblage ───────────────────────────────────────────────────────────
const modele = fs.readFileSync(ici('modele.html'), 'utf8');
const assembler = (c) => modele
  .replace('/*__POLICES__*/', () => POLICES)
  .replace('/*__CSS__*/', () => c)
  .replace('/*__JS__*/', () => js);
fs.writeFileSync(SORTIE, assembler(css));
if (process.env.SANS_ELAGAGE) { await navigateur.close(); log('assemblé sans élagage'); process.exit(0); }

// ─── 5. Élagage : on joue une boucle et on garde ce qui a servi ─────────────
const types = { '.html': 'text/html', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const serveur = http.createServer((req, res) => {
  const f = path.join(PUBLIC, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${serveur.address().port}/cy-cliche.html`;
const gardees = new Set();
const norm = (s) => s.replace(/\s+/g, ' ').trim();
for (const [mouvement, duree] of [['no-preference', 14_000], ['reduce', 2_500]]) {
  const p = await navigateur.newPage({ viewport: { width: W, height: H }, reducedMotion: mouvement });
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.goto(base);
  await p.evaluate(() => { window.__cySel = '#cy-css'; });
  await p.addScriptTag({ path: ici('collecte.js') });
  // les vraies horloges : celles de la page sont virtuelles (et figées en mouvement réduit)
  await p.evaluate((d) => new Promise((ok) => { const v = window.__cyVrai; const t = v.perf(); const iv = v.setInterval(() => { window.__cyCollect(); if (v.perf() - t > d) { v.clearInterval(iv); ok(); } }, 25); }), duree);
  const sortie = await p.evaluate(() => window.__cyEmit());
  sortie.replace(/([^{}\n][^{}]*)\{([^{}]*)\}/g, (x, sel, corps) => { gardees.add(norm(sel) + '{' + norm(corps) + '}'); return x; });
  if (erreurs.length) throw new Error(`${mouvement} : ${erreurs.join(' | ')}`);
  await p.close();
}
serveur.close();
await navigateur.close();

function elaguer(texte) {
  return decouper(texte).map(({ prelude, corps }) => {
    if (corps === null) return prelude + ';\n';
    if (/^@(media|supports|layer|container)\b/.test(prelude)) { const d = elaguer(corps); return d.trim() ? `${prelude}{\n${d}}\n` : ''; }
    if (prelude.startsWith('@')) return `${prelude}{${corps}}\n`;
    return gardees.has(norm(prelude) + '{' + norm(corps) + '}') ? `${prelude}{${corps.trim()}}\n` : '';
  }).join('');
}
let net = elaguer(css);
// les @keyframes que plus rien n'appelle
for (const nom of [...net.matchAll(/@keyframes\s+([\w-]+)/g)].map((x) => x[1])) {
  const reste = net.replace(new RegExp('@keyframes\\s+' + nom + '\\b', 'g'), '');
  if (!new RegExp('animation[^;{}]*\\b' + nom + '\\b').test(reste)) {
    const debut = net.search(new RegExp('@keyframes\\s+' + nom + '\\s*\\{'));
    let d = 0, k = net.indexOf('{', debut);
    for (; k < net.length; k++) { if (net[k] === '{') d++; else if (net[k] === '}') { d--; if (d === 0) break; } }
    net = net.slice(0, debut) + net.slice(k + 1);
  }
}
fs.writeFileSync(SORTIE, assembler(net));
log('css élagué', Math.round(net.length / 1024), 'Ko ;', path.relative(process.cwd(), SORTIE), Math.round(fs.statSync(SORTIE).size / 1024), 'Ko');
