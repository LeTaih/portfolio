// Construit public/tuiles/cy-salon.html depuis les vrais écrans de Cyrose.
//
//   node ateliers/cy-salon/construire.mjs      (depuis la racine du portfolio)
//
// Sources : ../cyrose_new/web (salon identique sur feat/poker et main — cf.
// LISEZMOI.md). Rien n'est écrit hors de public/tuiles/.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const PORTFOLIO = resolve(ICI, '../..');
const CY_WEB = resolve(PORTFOLIO, '../cyrose_new/web');
const CY_SRC = join(CY_WEB, 'src');
const SORTIE = join(PORTFOLIO, 'public/tuiles');
const ID = 'cy-salon';

const exiger = createRequire(join(CY_WEB, 'package.json'));
const postcss = exiger('postcss');
const tailwindcss = exiger('tailwindcss');

// Les deux cartes de la partie, tirées du vrai paquet : un duel, puis un vote.
const QUESTIONS = [
  '%s et %s se défient : qui a les plus grandes mains remporte $ gorgées',
  'Plutôt rhum ou whisky ? Votez tous en même temps, les minoritaires prennent $ gorgées',
];

// Les modules remplacés (chemin dans web/src → fichier de l'atelier).
const STUBS = {
  'lib/supabase.ts': 'stubs/supabase.ts',
  'lib/identity.ts': 'stubs/identity.ts',
  'screens/shared/roomUrls.ts': 'stubs/roomUrls.ts',
};

// ------------------------------------------------------------------ 1. le JS
const feuilles = [];
const extensions = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
function trouverFichier(base) {
  for (const e of extensions) if (existsSync(base + e) && !existsSync(base + e + '/')) return base + e;
  return null;
}
const plugin = {
  name: 'cy-salon',
  setup(b) {
    b.onResolve({ filter: /^@cy\// }, (a) => {
      const p = trouverFichier(join(CY_SRC, a.path.slice(4)));
      if (!p) return { errors: [{ text: `introuvable : ${a.path}` }] };
      return { path: remplacer(p) };
    });
    b.onResolve({ filter: /^\./ }, (a) => {
      if (!a.importer.startsWith(CY_SRC)) return undefined;
      const p = trouverFichier(resolve(dirname(a.importer), a.path));
      if (!p) return undefined;
      return { path: remplacer(p) };
    });
    b.onLoad({ filter: /\.css$/ }, (a) => {
      if (!feuilles.includes(a.path)) feuilles.push(a.path);
      return { contents: '', loader: 'js' };
    });
    b.onLoad({ filter: /questions_formatted\.json$/ }, (a) => {
      const tout = JSON.parse(readFileSync(a.path, 'utf8'));
      const questions = tout.questions.filter((q) => QUESTIONS.includes(q.question));
      if (questions.length !== QUESTIONS.length) throw new Error('question introuvable dans le paquet');
      return { contents: JSON.stringify({ questions }), loader: 'json' };
    });
    // Le catalogue du salon est un portail sur <body> : on le pose dans l'écran.
    b.onLoad({ filter: /screens\/shared\/GamePicker\.tsx$/ }, (a) => {
      const src = readFileSync(a.path, 'utf8');
      const patch = src.replace(/document\.body\s*\n?\s*\);/, "(document.getElementById('cy-portail') ?? document.body));");
      if (patch === src) throw new Error('GamePicker : portail introuvable');
      return { contents: patch, loader: 'tsx' };
    });
  },
};
function remplacer(p) {
  const rel = p.slice(CY_SRC.length + 1);
  return STUBS[rel] ? join(ICI, STUBS[rel]) : p;
}

const res = await build({
  entryPoints: [join(ICI, 'entree.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  jsx: 'automatic',
  metafile: true,
  nodePaths: [join(CY_WEB, 'node_modules')],
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production"}',
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [plugin],
  logLevel: 'warning',
});
const js = res.outputFiles[0].text;
if (process.env.ANALYSE) {
  const sorties = Object.values(res.metafile.outputs)[0].inputs;
  const gros = Object.entries(sorties).sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput).slice(0, 25);
  for (const [f, v] of gros) console.log(String(v.bytesInOutput).padStart(8), f);
}
const sourcesCy = Object.keys(res.metafile.inputs)
  .map((p) => resolve(PORTFOLIO, p))
  .filter((p) => p.startsWith(CY_SRC) && /\.(tsx?|jsx?)$/.test(p));

// ------------------------------------------------------------------ 2. le CSS
// L'ordre de main.tsx (fonts, index, flyer), puis les feuilles importées par
// les écrans, dans l'ordre où esbuild les a rencontrées.
const ordre = ['fonts.css', 'index.css', 'flyer.css'].map((f) => join(CY_SRC, f));
const toutes = [...ordre, ...feuilles.filter((f) => !ordre.includes(f))];
const config = (await import(pathToFileURL(join(CY_WEB, 'tailwind.config.js')).href)).default;
config.content = sourcesCy; // seulement les classes des écrans compilés

let css = '';
for (const f of toutes) {
  const r = await postcss([tailwindcss(config)]).process(readFileSync(f, 'utf8'), { from: f });
  css += `\n/* ${f.slice(CY_WEB.length + 1)} */\n` + r.css;
}

// ---- l'élagage et le gel pour 390×844
const L = 390;
const H = 844;
const corpus = js;
const px = (n) => `${+n.toFixed(3)}px`;
function figerUnites(v) {
  return v
    .replace(/(-?\d*\.?\d+)(?:d|s|l)?vh\b/g, (_, n) => px((H * n) / 100))
    .replace(/(-?\d*\.?\d+)(?:d|s|l)?vw\b/g, (_, n) => px((L * n) / 100))
    .replace(/(-?\d*\.?\d+)vmin\b/g, (_, n) => px((L * n) / 100))
    .replace(/(-?\d*\.?\d+)vmax\b/g, (_, n) => px((H * n) / 100));
}
const enPx = (v) => {
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(v.trim());
  if (!m) return null;
  return m[2] === 'rem' || m[2] === 'em' ? +m[1] * 16 : +m[1];
};
// Une requête média, jugée pour un téléphone de 390×844 tenu droit, au doigt.
// Rend true / false, ou la requête réduite à ce qui ne se juge pas d'avance
// (prefers-reduced-motion…).
function jugerRequete(q) {
  q = q.trim();
  let non = false;
  if (/^not\s/i.test(q)) {
    non = true;
    q = q.replace(/^not\s+/i, '');
  }
  const morceaux = q.split(/\s+and\s+/i);
  const restes = [];
  let ok = true;
  for (const m of morceaux) {
    const t = m.trim();
    if (/^(only\s+)?(screen|all)$/i.test(t)) continue;
    if (/^print$/i.test(t)) {
      ok = false;
      continue;
    }
    const f = /^\(\s*([\w-]+)\s*(?::\s*([^)]+))?\)$/.exec(t);
    if (!f) {
      restes.push(t);
      continue;
    }
    const [, nom, val = ''] = f;
    const n = enPx(figerUnites(val));
    switch (nom) {
      case 'min-width': ok &&= L >= n; break;
      case 'max-width': ok &&= L <= n; break;
      case 'min-height': ok &&= H >= n; break;
      case 'max-height': ok &&= H <= n; break;
      case 'orientation': ok &&= val.trim() === 'portrait'; break;
      case 'hover': case 'any-hover': ok &&= val.trim() === 'none'; break;
      case 'pointer': case 'any-pointer': ok &&= val.trim() === 'coarse'; break;
      case 'display-mode': ok &&= val.trim() === 'browser'; break;
      default: restes.push(t);
    }
  }
  if (non) {
    if (restes.length) return `not ${q}`;
    return !ok;
  }
  if (!ok) return false;
  return restes.length ? restes.join(' and ') : true;
}

// Une classe est gardée si le JS la porte en clair, ou s'il la fabrique par un
// gabarit (`qreveal--${famille}`) dont elle prolonge le préfixe.
function classePresente(nom) {
  if (corpus.includes(nom)) return true;
  for (let i = nom.length - 1; i > 0; i--) if (nom[i] === '-' && corpus.includes(nom.slice(0, i + 1) + '${')) return true;
  return false;
}
const MARQUES_ETRANGERES = /\[data-theme=['"]?flyer|\[data-da=['"]?bar|\[data-saison=['"]?halloween|\.alt-|\[data-alt/;
function nettoyerSelecteur(s) {
  if (MARQUES_ETRANGERES.test(s)) return null;
  for (const m of s.matchAll(/\.((?:\\.|[\w-])+)/g)) {
    const nom = m[1].replace(/\\(.)/g, '$1');
    if (nom === 'cy-press') continue;
    if (!classePresente(nom)) return null;
  }
  // <body> → la scène ; ses pseudo-éléments → le calque de fond de la scène.
  s = s.replace(/(^|[\s>+~(,])body((?:\[[^\]]*\])*)::(before|after)/g, '$1#cy-stage$2 > .cy-bg::$3');
  s = s.replace(/(^|[\s>+~(,])body(?![\w-])/g, '$1#cy-stage');
  // L'appui du doigt fictif tient lieu de :active.
  s = s.replace(/:active\b/g, '.cy-press');
  return s;
}

const arbre = postcss.parse(css);
arbre.walkAtRules('media', (r) => {
  const verdicts = r.params.split(',').map(jugerRequete);
  if (verdicts.includes(true)) return r.replaceWith(r.nodes);
  const gardees = verdicts.filter((v) => typeof v === 'string');
  if (!gardees.length) return r.remove();
  r.params = gardees.join(', ');
});
arbre.walkRules((r) => {
  if (r.parent?.type === 'atrule' && /keyframes/i.test(r.parent.name)) return;
  const sels = r.selectors.map(nettoyerSelecteur).filter(Boolean);
  if (!sels.length) r.remove();
  else r.selectors = sels;
});
arbre.walkDecls((d) => {
  d.value = figerUnites(d.value);
});
// Les polices : latin seulement (tout le texte de la tuile y tient), servies à côté.
const polices = new Set();
arbre.walkAtRules('font-face', (r) => {
  let src = '';
  r.walkDecls('src', (d) => (src = d.value));
  const m = /\/fonts\/([\w-]+\.woff2)/.exec(src);
  if (!m || /-ext\.woff2/.test(m[1])) return r.remove();
  r.walkDecls('src', (d) => (d.value = d.value.replace(/url\(['"]?\/fonts\/([\w-]+\.woff2)['"]?\)/, "url('cy-$1')")));
  polices.add(m[1]);
});
// Les familles réellement demandées par une règle restante.
let declarations = '';
arbre.walkDecls((d) => {
  if (d.parent?.type === 'atrule' && d.parent.name === 'font-face') return;
  declarations += `${d.prop}:${d.value};`;
});
arbre.walkAtRules('font-face', (r) => {
  let fam = '';
  r.walkDecls('font-family', (d) => (fam = d.value.replace(/['"]/g, '')));
  if (!declarations.includes(fam) && !corpus.includes(fam)) {
    r.walkDecls('src', (d) => polices.delete(/cy-([\w-]+\.woff2)/.exec(d.value)?.[1]));
    r.remove();
  }
});
// Les animations nommées par une règle restante.
arbre.walkAtRules(/keyframes$/i, (r) => {
  const nom = r.params.trim();
  if (!new RegExp(`(^|[\\s,:;])${nom.replace(/[-]/g, '\\-')}([\\s,;]|$)`).test(declarations)) r.remove();
});
// Les @-règles vidées par l'élagage.
let vides = true;
while (vides) {
  vides = false;
  arbre.walkAtRules((r) => {
    if (r.nodes && r.nodes.length === 0) {
      r.remove();
      vides = true;
    }
  });
}
arbre.walkComments((c) => c.remove());
const cssFinal = arbre.toString().replace(/\n{2,}/g, '\n');

// ------------------------------------------------------------------ 3. le fichier
mkdirSync(SORTIE, { recursive: true });
for (const f of polices) {
  const cible = join(SORTIE, `cy-${f}`);
  if (!existsSync(cible)) copyFileSync(join(CY_WEB, 'public/fonts', f), cible);
}
const prechargements = [...polices]
  .map((f) => `<link rel="preload" as="font" type="font/woff2" href="cy-${f}" crossorigin>`)
  .join('\n');
const cadre = readFileSync(join(ICI, 'cadre.css'), 'utf8');
const html = `<!DOCTYPE html>
<html lang="fr" data-theme="default" style="--magenta: 255 30 140;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cyrose · Le salon</title>
<link rel="icon" href="data:,">
${prechargements}
<style id="cy-css">
${cssFinal}
</style>
<style>
${cadre}
</style>
</head>
<body>
<div id="cy-stage" aria-hidden="true"><div class="cy-bg"></div><div id="cy-host"></div><div id="cy-finger"></div></div>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
writeFileSync(join(SORTIE, `${ID}.html`), html);
console.log(
  `${ID}.html : ${(html.length / 1024).toFixed(0)} Ko (JS ${(js.length / 1024).toFixed(0)} Ko, CSS ${(cssFinal.length / 1024).toFixed(0)} Ko), polices : ${[...polices].join(', ')}`
);
