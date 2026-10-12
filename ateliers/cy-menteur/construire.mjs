// ateliers/cy-menteur/construire.mjs
// Construit public/tuiles/cy-menteur.html depuis le dépôt Cyrose voisin.
//
//   node ateliers/cy-menteur/construire.mjs        (depuis la racine du portfolio)
//
// 1. JS : esbuild compile tuile.tsx — la vraie salle du Bar des menteurs
//    (screens/menteur/salle/MenteurSalle) et les règles du serveur
//    (lib/menteur) — avec quatre bouchons : le son (muet), l'API (jamais
//    appelée, la salle reçoit une `api` locale), react-router (le lien
//    « Accueil ») et l'invite d'installation.
// 2. CSS : fonts.css + index.css passés dans Tailwind avec la config de
//    Cyrose (contenu restreint aux fichiers compilés), puis salle.css. Élagué
//    aux règles dont les classes existent dans la tuile, figé pour un écran
//    390×844 (vw/vh en px, safe-area à 0, requêtes de largeur tranchées).
// 3. Polices : celles qui manquent sont copiées en public/tuiles/cy-*.woff2.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const PORTFOLIO = resolve(ICI, '../..');
const CY = resolve(PORTFOLIO, process.env.CYROSE ?? '../cyrose_new/web');
const SRC = join(CY, 'src');
const SORTIE = join(PORTFOLIO, 'public/tuiles');
const ID = 'cy-menteur';
/** L'instant de l'affiche (s) — et l'image fixe du mouvement réduit. */
const AFFICHE = Number(process.env.AFFICHE ?? 3);
const L = 390;
const H = 844;

const exiger = createRequire(join(CY, 'package.json'));
const postcss = exiger('postcss');
const tailwind = exiger('tailwindcss');

// ── 1. Le JS ────────────────────────────────────────────────────────────────
const BOUCHONS = [
  [/\/lib\/sound$/, 'stubs/sound.ts'],
  [/\/lib\/menteurApi$/, 'stubs/menteurApi.ts'],
  [/\/components\/InstallPrompt$/, 'stubs/InstallPrompt.tsx'],
  [/^react-router-dom$/, 'stubs/react-router-dom.tsx'],
];
const aiguillage = {
  name: 'aiguillage',
  setup(b) {
    b.onResolve({ filter: /^@cy\// }, (a) => b.resolve('./' + a.path.slice(4), { resolveDir: SRC, kind: a.kind }));
    b.onResolve({ filter: /(\/lib\/sound|\/lib\/menteurApi|\/components\/InstallPrompt|^react-router-dom)$/ }, (a) => {
      for (const [re, f] of BOUCHONS) if (re.test(a.path)) return { path: join(ICI, f) };
      return undefined;
    });
    // Les feuilles importées par les composants sont assemblées à part (2.).
    b.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
  },
};
const js = await build({
  entryPoints: [join(ICI, 'tuile.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  target: 'es2022',
  minify: true,
  jsx: 'automatic',
  nodePaths: [join(CY, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' },
  legalComments: 'none',
  metafile: true,
  plugins: [aiguillage],
  logLevel: 'warning',
});
let code = js.outputFiles[0].text.replace('"__AFFICHE__"', JSON.stringify(String(AFFICHE)));
const sources = Object.keys(js.metafile.inputs)
  .map((f) => resolve(PORTFOLIO, f))
  .filter((f) => f.startsWith(SRC) && /\.(tsx?|jsx?)$/.test(f));

// ── 2. Le CSS ───────────────────────────────────────────────────────────────
const config = (await import(join(CY, 'tailwind.config.js'))).default;
const entree = readFileSync(join(SRC, 'fonts.css'), 'utf8') + '\n' + readFileSync(join(SRC, 'index.css'), 'utf8');
const base = await postcss([tailwind({ ...config, content: sources })]).process(entree, { from: join(SRC, 'index.css') });
const salle = readFileSync(join(SRC, 'screens/menteur/salle/salle.css'), 'utf8');
const racineCss = postcss.parse(base.css + '\n' + salle);

const COQUILLE = `
<div id="cy-stage" aria-hidden="true"><div id="cy-host"></div><div id="cy-finger"></div></div>`;
const corpus = code + COQUILLE;
// Les balises que la salle rend (DOM, SVG des mains et des revolvers).
const BALISES = new Set(['html', 'body', 'div', 'p', 'ul', 'li', 'button', 'a', 'span', 'svg', 'path', 'circle', 'g', 'ellipse', 'rect',
  'canvas', 'i', 'b', 'defs', 'pattern', 'lineargradient', 'radialgradient', 'stop', 'filter', 'use', 'polygon', 'line', 'clippath']);
const classeConnue = new Map();
const connue = (c) => {
  if (!classeConnue.has(c)) classeConnue.set(c, new RegExp(`[^\\w-]${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(corpus));
  return classeConnue.get(c);
};
function selecteurUtile(s) {
  if (/:hover|:focus(?!-visible)|::-moz|:-moz|::-ms|:-ms/.test(s)) return false;
  if (/^\s*body\b\S*::/.test(s)) return false; // le fond « rave » du site, sous la salle opaque
  const sansParens = s.replace(/\\./g, '');
  for (const m of sansParens.matchAll(/\.((?:[\w-]|\\.)+)/g)) if (!connue(m[1].replace(/\\/g, ''))) return false;
  for (const m of sansParens.matchAll(/#([\w-]+)/g)) if (!corpus.includes(`"${m[1]}"`) && !COQUILLE.includes(`id="${m[1]}"`)) return false;
  for (const m of sansParens.matchAll(/\[([\w-]+)/g)) if (!corpus.includes(m[1].replace(/^data-/, '')) && !['type', 'hidden', 'role'].includes(m[1])) return false;
  // Les balises : le premier mot de chaque composé.
  const nu = sansParens.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
  for (const m of nu.matchAll(/(^|[\s>+~,(])([a-zA-Z][\w-]*)/g)) if (!BALISES.has(m[2].toLowerCase())) return false;
  return true;
}
// Les requêtes média, tranchées pour un téléphone de 390×844, tactile.
function media(p) {
  if (/prefers-reduced-motion:\s*reduce/.test(p)) return false; // la tuile gère le mouvement réduit
  if (/prefers-reduced-motion:\s*no-preference/.test(p)) return true;
  if (/hover:\s*hover|pointer:\s*fine/.test(p)) return false;
  if (/print/.test(p)) return false;
  let ok = true;
  let vu = false;
  for (const m of p.matchAll(/\((min|max)-(width|height):\s*([\d.]+)(px|rem|em)\)/g)) {
    vu = true;
    const v = Number(m[3]) * (m[4] === 'px' ? 1 : 16);
    const x = m[2] === 'width' ? L : H;
    if (m[1] === 'min' ? x < v : x > v) ok = false;
  }
  for (const m of p.matchAll(/\(orientation:\s*(\w+)\)/g)) {
    vu = true;
    if (m[1] !== 'portrait') ok = false;
  }
  if (/\bor\b|,/.test(p)) return null;
  return vu ? ok : null;
}
function figer(v) {
  return v
    .replace(/env\(\s*safe-area-inset-\w+\s*(?:,\s*([^)]+))?\)/g, (_, r) => (r ? r.trim() : '0px'))
    .replace(/(-?\d*\.?\d+)d?s?l?vw\b/g, (_, n) => `${+(n * L / 100).toFixed(3)}px`)
    .replace(/(-?\d*\.?\d+)d?s?l?vh\b/g, (_, n) => `${+(n * H / 100).toFixed(3)}px`);
}

racineCss.walkAtRules('media', (r) => {
  const m = media(r.params);
  if (m === false) r.remove();
  else if (m === true) r.replaceWith(r.nodes);
});
racineCss.walkRules((r) => {
  if (r.parent?.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
  const garde = r.selectors.filter(selecteurUtile);
  if (!garde.length) return r.remove();
  // Un toucher de synthèse n'allume pas :active — le doigt pose `.cy-press`.
  const presses = garde.filter((s) => s.includes(':active')).map((s) => s.replace(/:active/g, '.cy-press'));
  r.selectors = [...garde, ...presses];
});
racineCss.walkDecls((d) => {
  d.value = figer(d.value);
});
// Les @keyframes et @font-face qu'on cite encore.
const decls = [];
racineCss.walkDecls((d) => {
  if (!(d.parent?.parent?.type === 'atrule' && /keyframes|font-face/.test(d.parent.parent.name)) && d.parent?.type !== 'atrule') decls.push(d);
});
const anim = decls.filter((d) => /^(animation|animation-name)$/.test(d.prop)).map((d) => d.value).join(' ');
const polices = decls.filter((d) => /^(font|font-family)$/.test(d.prop)).map((d) => d.value).join(' ');
const policesUtiles = new Set();
racineCss.walkAtRules((r) => {
  if (/keyframes$/.test(r.name) && !new RegExp(`(^|[\\s,])${r.params}($|[\\s,])`).test(anim)) r.remove();
  if (r.name === 'font-face') {
    let fam = '';
    let url = '';
    r.walkDecls((d) => {
      if (d.prop === 'font-family') fam = d.value.replace(/['"]/g, '');
      if (d.prop === 'src') url = d.value;
    });
    const fichier = url.match(/\/fonts\/([\w-]+)\.woff2/)?.[1];
    if (!fichier || /latin-ext/.test(fichier) || !polices.includes(fam)) return r.remove();
    policesUtiles.add(fichier);
    r.walkDecls('src', (d) => (d.value = `url('cy-${fichier}.woff2') format('woff2')`));
  }
});
racineCss.walkAtRules((r) => {
  if (r.nodes && !r.nodes.length) r.remove();
});
const css = racineCss.toString().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n');

// ── 3. Les polices ──────────────────────────────────────────────────────────
mkdirSync(SORTIE, { recursive: true });
for (const f of policesUtiles) {
  const cible = join(SORTIE, `cy-${f}.woff2`);
  if (!existsSync(cible)) copyFileSync(join(CY, 'public/fonts', `${f}.woff2`), cible);
}

// ── 4. Le fichier ───────────────────────────────────────────────────────────
const cadre = readFileSync(join(ICI, 'cadre.css'), 'utf8');
const html = `<!DOCTYPE html>
<html lang="fr" data-theme="default" style="--magenta: 255 30 140;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cyrose · Bar des menteurs</title>
<link rel="icon" href="data:,">
${[...policesUtiles].map((f) => `<link rel="preload" as="font" type="font/woff2" href="cy-${f}.woff2" crossorigin>`).join('\n')}
<style id="cy-css">
${css}
</style>
<style>
${cadre}
</style>
</head>
<body>${COQUILLE}
<script>${code.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
writeFileSync(join(SORTIE, `${ID}.html`), html);
console.log(
  `${relative(PORTFOLIO, join(SORTIE, `${ID}.html`))} : ${(html.length / 1024).toFixed(0)} ko ` +
    `(js ${(code.length / 1024).toFixed(0)} ko, css ${(css.length / 1024).toFixed(0)} ko), ` +
    `polices ${[...policesUtiles].join(', ')}, affiche ${AFFICHE} s`,
);
