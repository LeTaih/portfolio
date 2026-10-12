// ateliers/cy-navale/construire.mjs
// Construit public/tuiles/cy-navale.html depuis le dépôt Cyrose voisin.
//
//   node ateliers/cy-navale/construire.mjs      (depuis la racine du portfolio)
//
// 1. JS : tuile.tsx (+ les VRAIS composants de ../cyrose_new/web/src) compilé
//    par esbuild ; navaleApi et react-router-dom remplacés par des bouchons.
// 2. CSS : fonts.css + index.css (Tailwind, passé par le postcss de Cyrose) +
//    navale.css ; médias résolus pour un téléphone 390×844, unités d'écran
//    figées (vh → px…), fond de body porté par `.cy-bg`.
// 3. Élagage : la tuile brute est jouée dans Chrome (Playwright) en temps
//    virtuel ; on ne garde que les règles dont un sélecteur a servi.
// 4. Polices manquantes copiées à côté (public/tuiles/cy-*.woff2).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(ICI, '../../../cyrose_new/web');
const TUILES = resolve(ICI, '../../public/tuiles');
const SORTIE = join(TUILES, 'cy-navale.html');
const L = 390;
const H = 844;
/** Durée d'une boucle (cf. DUREE dans tuile.tsx). */
const BOUCLE = 13_400;

/* ───────────────────────────── 1. Le JS ───────────────────────────── */

const bouchons = {
  name: 'bouchons',
  setup(b) {
    b.onResolve({ filter: /(^|\/)navaleApi$/ }, () => ({ path: join(ICI, 'bouchons/navaleApi.ts') }));
    b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: join(ICI, 'bouchons/router.tsx') }));
    // La scène 3D du naufrage final (three, plusieurs centaines de ko) ne sert
    // pas à l'écran de tir : on refuse qu'elle entre par mégarde.
    b.onResolve({ filter: /naufrage3d|^three$/ }, (a) => ({ errors: [{ text: `import inattendu : ${a.path}` }] }));
  },
};

const js = await build({
  entryPoints: [join(ICI, 'tuile.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
  target: 'es2022',
  jsx: 'automatic',
  charset: 'utf8',
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' },
  nodePaths: [join(WEB, 'node_modules')],
  alias: { '@cy': join(WEB, 'src') },
  loader: { '.css': 'empty' },
  plugins: [bouchons],
  logLevel: 'warning',
});
const bundle = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

/* ───────────────────────────── 2. Le CSS ───────────────────────────── */

const exiger = createRequire(join(WEB, 'package.json'));
const postcss = exiger('postcss');
const tailwind = exiger('tailwindcss');
const autoprefixer = exiger('autoprefixer');
const tw = (await import(pathToFileURL(join(WEB, 'tailwind.config.js')).href)).default;

async function compiler(fichier, avecTailwind) {
  const src = readFileSync(join(WEB, fichier), 'utf8');
  const plugins = avecTailwind
    ? [tailwind({ ...tw, content: [join(WEB, 'index.html'), join(WEB, 'src/**/*.{ts,tsx}')] }), autoprefixer()]
    : [autoprefixer()];
  return (await postcss(plugins).process(src, { from: join(WEB, fichier) })).root;
}

const racine = postcss.root();
for (const [f, t] of [['src/fonts.css', false], ['src/index.css', true], ['src/screens/navale/navale.css', false]]) {
  racine.append((await compiler(f, t)).nodes);
}

// Les polices : le sous-ensemble latin seulement, servi à côté de la tuile.
const polices = new Map(); // fichier source → nom dans public/tuiles
racine.walkAtRules('font-face', (r) => {
  let src = '';
  r.walkDecls('src', (d) => { src = d.value; });
  const m = src.match(/url\(['"]?\/fonts\/([^'")]+)['"]?\)/);
  if (!m || /latin-ext/.test(m[1])) { r.remove(); return; }
  const nom = `cy-${m[1]}`;
  polices.set(m[1], nom);
  r.walkDecls('src', (d) => { d.value = d.value.replace(m[0], `url('${nom}')`); });
});

// Les médias, résolus pour un téléphone de 390×844 au doigt.
const PX = (v, u) => (u === 'rem' || u === 'em' ? v * 16 : v);
function condition(c) {
  const t = c.trim().replace(/^\(|\)$/g, '').trim();
  let m = t.match(/^(min|max)-(width|height)\s*:\s*([\d.]+)(px|rem|em)$/);
  if (m) {
    const v = PX(+m[3], m[4]);
    const ecran = m[2] === 'width' ? L : H;
    return m[1] === 'min' ? ecran >= v : ecran <= v;
  }
  m = t.match(/^(width|height)\s*(>=|<=|>|<)\s*([\d.]+)(px|rem|em)$/);
  if (m) {
    const e = m[1] === 'width' ? L : H, v = PX(+m[3], m[4]);
    return { '>=': e >= v, '<=': e <= v, '>': e > v, '<': e < v }[m[2]];
  }
  m = t.match(/^(any-)?hover\s*:\s*(\w+)$/);
  if (m) return m[2] === 'none';
  m = t.match(/^(any-)?pointer\s*:\s*(\w+)$/);
  if (m) return m[2] === 'coarse';
  m = t.match(/^orientation\s*:\s*(\w+)$/);
  if (m) return m[1] === 'portrait';
  m = t.match(/^display-mode\s*:\s*(\w+)$/);
  if (m) return m[1] === 'browser';
  return null; // préférence de l'utilisateur : laissée au navigateur
}
/** true, false, ou le texte de média à garder (préférences seulement). */
function media(params) {
  const requetes = params.split(/,(?![^(]*\))/).map((q) => q.trim());
  const restes = [];
  let vrai = false;
  for (const q of requetes) {
    if (/^not\b/.test(q)) { restes.push(q); continue; }
    const parts = q.replace(/^only\s+/, '').split(/\s+and\s+/);
    let ok = true;
    const inconnues = [];
    for (const p of parts) {
      if (/^(screen|all)$/.test(p)) continue;
      if (/^print$/.test(p)) { ok = false; break; }
      const r = condition(p);
      if (r === false) { ok = false; break; }
      if (r === null) inconnues.push(p);
    }
    if (!ok) continue;
    if (inconnues.length === 0) vrai = true;
    else restes.push(inconnues.join(' and '));
  }
  if (vrai) return true;
  return restes.length ? restes.join(', ') : false;
}
racine.walkAtRules('media', (r) => {
  const v = media(r.params);
  if (v === true) r.replaceWith(r.nodes);
  else if (v === false) r.remove();
  else r.params = v;
});

// Les unités d'écran, figées pour 390×844 ; pas d'encoche.
const fige = (v) => v
  .replace(/(-?\d*\.?\d+)(d|s|l)?vh\b/g, (_, n) => `${+(n * H / 100).toFixed(2)}px`)
  .replace(/(-?\d*\.?\d+)(d|s|l)?vw\b/g, (_, n) => `${+(n * L / 100).toFixed(2)}px`)
  .replace(/(-?\d*\.?\d+)vmin\b/g, (_, n) => `${+(n * L / 100).toFixed(2)}px`)
  .replace(/(-?\d*\.?\d+)vmax\b/g, (_, n) => `${+(n * H / 100).toFixed(2)}px`)
  .replace(/env\(\s*safe-area-inset-[a-z]+\s*(,\s*([^()]*|[^()]*\([^()]*\)[^()]*))?\)/g, (_, __, f) => (f ? f.trim() : '0px'));
racine.walkDecls((d) => { d.value = fige(d.value); });
racine.walkAtRules('media', (r) => { r.params = fige(r.params); });

// Le fond de la page (grain et halos) est porté par `.cy-bg`, dans l'écran.
racine.walkRules((r) => {
  r.selector = r.selector.replace(/\bbody::(before|after)/g, '.cy-bg::$1');
});

// LE MUR REPLIÉ. Dans l'app, les tuiles des flottes sont posées sur leur ligne
// par une animation liée au défilement de la page (`scroll(root)`), ici au
// repos : on écrit cet état de départ en dur. La tuile ne défile pas, et une
// timeline de défilement sans course serait inactive — les tuiles seraient
// restées tout en bas, hors de l'écran.
racine.append(postcss.parse(`
.navale-mur-page .nvm-tuile { animation: none; transform: translateY(var(--nvm-dy, 0px)); clip-path: inset(0 0 var(--nvm-replie, 0%) 0 round 0.55rem); }
.navale-mur-page .nvm-plateau { animation: none; opacity: 0; transform: scale(0.94); transform-origin: 50% 0; }
.navale-mur__titre { animation: none; opacity: 0; transform: translateY(10px); }
@media (prefers-reduced-motion: reduce) {
  .navale-mur-page .nvm-tuile { transform: none; clip-path: none; }
  .navale-mur-page .nvm-plateau, .navale-mur__titre { opacity: 1; transform: none; }
}
`));

/* ───────────────────────────── La page ───────────────────────────── */

const CADRE = `
/* ── Le cadre de la tuile : un téléphone 390×844, mis à l'échelle de l'iframe ── */
html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
#cy-stage { position: absolute; left: 0; top: 0; width: ${L}px; height: ${H}px; transform-origin: 0 0; overflow: hidden;
  background: var(--bg); font-family: 'Archivo', system-ui, sans-serif; color: var(--text); }
.cy-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
#cy-host { position: absolute; inset: 0; overflow: hidden; }
#cy-host, #cy-host * { pointer-events: none; }
/* Le doigt fictif : un disque blanc translucide. */
#cy-finger { position: absolute; left: 0; top: 0; z-index: 500; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
  background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.42), rgba(255,255,255,0.22) 70%);
  box-shadow: 0 0 0 1.5px rgba(255,255,255,0.45), 0 8px 22px -8px rgba(0,0,0,0.7);
  pointer-events: none; opacity: 0; translate: 330px 940px;
  transition: translate 440ms var(--ease-in-out), opacity 260ms var(--ease-out), scale 140ms var(--ease-out); }
#cy-finger.is-on { opacity: 1; }
#cy-finger.is-down { scale: 0.8; }
#cy-finger::after { content: ''; position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.6); opacity: 0; }
#cy-finger.is-tap::after { animation: cyRipple 520ms var(--ease-out) both; }
@keyframes cyRipple { from { opacity: 0.9; transform: scale(0.9); } to { opacity: 0; transform: scale(1.9); } }
@media (prefers-reduced-motion: reduce) { .cy-bg::before { animation: none !important; } #cy-finger { display: none; } }
`;

function page(css) {
  const utilisees = [...polices.values()].filter((p) => css.includes(p));
  return `<!DOCTYPE html>
<html lang="fr" data-theme="default" style="--magenta: 255 30 140;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cyrose · Bataille navale</title>
<link rel="icon" href="data:,">
${utilisees.map((p) => `<link rel="preload" as="font" type="font/woff2" href="${p}" crossorigin>`).join('\n')}
<style id="cy-css">
${css}
</style>
<style>${CADRE}</style>
</head>
<body>
<div id="cy-stage" aria-hidden="true"><div class="cy-bg"></div><div id="cy-host"></div><div id="cy-finger"></div></div>
<script>${bundle}</script>
</body>
</html>
`;
}

/* ───────────────────────────── 3. L'élagage ───────────────────────────── */

// La tuile brute est servie en HTTP (les polices refusent file://) : la page
// elle-même depuis la mémoire, les polices depuis Cyrose.
let brute = page(racine.toString());
const serveur = createServer((req, res) => {
  const nom = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1));
  if (nom === 'cy-navale.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(brute); return; }
  const src = [...polices].find(([, n]) => n === nom)?.[0];
  if (!src) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'font/woff2' });
  res.end(readFileSync(join(WEB, 'public/fonts', src)));
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const ADRESSE = `http://127.0.0.1:${serveur.address().port}`;

/** Le sélecteur tel qu'on peut le chercher dans le DOM : sans pseudo-élément
    ni état d'interaction (on garde la règle si l'élément existe). */
const DYNAMIQUES = 'hover|active|focus|focus-visible|focus-within|visited|target|placeholder-shown|autofill';
function cherchable(s) {
  let t = s
    .replace(/(?<!\\)::?(before|after|first-line|first-letter|placeholder|selection|marker|backdrop|file-selector-button|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/g, '')
    .replace(new RegExp(`(?<!\\\\):(${DYNAMIQUES})(?![\\w-])`, 'g'), '')
    .trim();
  if (!t || /[>+~]$/.test(t)) t = `${t} *`.trim();
  return t;
}
const decoupe = (sel) => sel.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);

const selecteurs = new Set();
racine.walkRules((r) => {
  if (r.parent?.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
  decoupe(r.selector).forEach((s) => selecteurs.add(s));
});

const navigateur = await chromium.launch({ channel: 'chrome' });
const onglet = await navigateur.newPage({ viewport: { width: L, height: H } });
const erreurs = [];
onglet.on('pageerror', (e) => erreurs.push(e.message));
onglet.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
await onglet.goto(`${ADRESSE}/cy-navale.html?parcours`);
await onglet.waitForFunction(() => window.__cyParcours && document.fonts.status === 'loaded');
const servis = new Set(await onglet.evaluate(async ({ liste, fin }) => {
  const restants = new Map(liste);
  const ok = [];
  const tester = () => {
    for (const [s, q] of restants) {
      let vu = true;
      try { vu = !!document.querySelector(q); } catch { /* sélecteur que le DOM ne sait pas chercher : gardé */ }
      if (vu) { ok.push(s); restants.delete(s); }
    }
  };
  let k = 0;
  await window.__cyParcours(1000 / 60, fin, () => { if (k++ % 2 === 0) tester(); });
  tester();
  return ok;
}, { liste: [...selecteurs].map((s) => [s, cherchable(s)]), fin: BOUCLE + 200 }));
await navigateur.close();
serveur.close();
if (erreurs.length) { console.error(erreurs.join('\n')); process.exit(1); }

// On garde les racines (variables, :root, html, body) et ce qui a servi.
racine.walkRules((r) => {
  if (r.parent?.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
  const garde = decoupe(r.selector).filter((s) => servis.has(s) || /^(:root|html|body|\*)/.test(s));
  if (garde.length === 0) r.remove();
  else r.selector = garde.join(',\n');
});
// Les @-règles vidées, puis les keyframes et polices que plus rien n'appelle.
const vider = () => racine.walkAtRules((r) => {
  if (['media', 'supports', 'layer'].includes(r.name) && (!r.nodes || r.nodes.length === 0)) r.remove();
});
vider(); vider();
const texte = () => { let t = ''; racine.walkDecls((d) => { t += `${d.prop}:${d.value};`; }); return t; };
const decls = texte();
racine.walkAtRules(/keyframes$/, (r) => {
  if (!new RegExp(`(^|[\\s,:])${r.params}([\\s,;]|$)`).test(decls)) r.remove();
});
const declsSansPolices = (() => { let t = ''; racine.walkDecls((d) => { if (d.parent?.name !== 'font-face') t += `${d.value};`; }); return t; })();
racine.walkAtRules('font-face', (r) => {
  let fam = '';
  r.walkDecls('font-family', (d) => { fam = d.value.replace(/['"]/g, ''); });
  if (!declsSansPolices.includes(fam)) r.remove();
});
racine.walkComments((c) => c.remove());

const css = racine.toString().replace(/\n{3,}/g, '\n\n');
writeFileSync(SORTIE, page(css));
// 4. Les polices dont la tuile se sert, à côté d'elle si elles n'y sont pas.
for (const [src, nom] of polices) {
  const dest = join(TUILES, nom);
  if (css.includes(nom) && !existsSync(dest)) { copyFileSync(join(WEB, 'public/fonts', src), dest); console.log(`police ajoutée : ${nom}`); }
}
console.log(`public/tuiles/cy-navale.html : ${(Buffer.byteLength(page(css)) / 1024).toFixed(0)} ko (JS ${(bundle.length / 1024).toFixed(0)} ko, CSS ${(css.length / 1024).toFixed(0)} ko, ${servis.size}/${selecteurs.size} sélecteurs)`);
