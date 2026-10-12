// ateliers/cy-blackjack/construire.mjs
// Reconstruit public/tuiles/cy-blackjack.html depuis le worktree voisin
// ../cyrose-casino-table (branche feat/casino-table). Lancer depuis la racine du
// portfolio :   node ateliers/cy-blackjack/construire.mjs
//
// Étapes : 1. CSS réel de l'appli, lu sur son serveur dev (port 5199) ;
//          2. la vraie table compilée avec esbuild, branchée sur un faux serveur ;
//          3. CSS figé pour 390×844, polices copiées ;
//          4. élagage du CSS aux règles réellement utilisées pendant une boucle
//             et dans l'état fixe (mouvement réduit) ;
//          5. écriture de la tuile.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const ATELIER = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ATELIER, '../..');
const DEPOTS = path.resolve(RACINE, '..');
const WEB = path.join(DEPOTS, 'cyrose-casino-table', 'web');
const TMP = '/tmp/tuiles/cy-blackjack';
const SORTIE = path.join(RACINE, 'public', 'tuiles');
const ID = 'cy-blackjack';
const PORT = 5199;
const ORIGINE = 'http://tuile.local';
const POLICES_LATIN = /\/fonts\/((?!anton)[\w-]+-latin\.woff2)/;

const etape = (m) => console.log(`\n· ${m}`);
fs.mkdirSync(TMP, { recursive: true });
if (!fs.existsSync(path.join(WEB, 'src', 'screens', 'blackjack', 'table', 'BjTable.tsx'))) {
  throw new Error(`source introuvable : ${WEB} (worktree feat/casino-table attendu)`);
}
const commit = execFileSync('git', ['-C', WEB, 'log', '-1', '--format=%h %s'], { encoding: 'utf8' }).trim();
const branche = execFileSync('git', ['-C', WEB, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
console.log(`source : ${WEB}\n         ${branche} @ ${commit}`);

// ─── 1. Le CSS de l'appli, tel que son serveur dev le sert ───────────────────
async function cssDeLAppli() {
  etape(`serveur dev Cyrose sur ${PORT}`);
  const vite = spawn(path.join(WEB, 'node_modules', '.bin', 'vite'), ['--port', String(PORT), '--strictPort'], { cwd: WEB, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = '';
  vite.stdout.on('data', (d) => { journal += d; });
  vite.stderr.on('data', (d) => { journal += d; });
  const navigateur = await chromium.launch({ channel: 'chrome' });
  try {
    const url = `http://localhost:${PORT}/labo-salons?cas=blackjack-invite&nu=1`;
    for (let i = 0; ; i++) {
      try { const r = await fetch(url); if (r.ok) break; } catch { /* pas encore prêt */ }
      if (i > 120 || vite.exitCode !== null) throw new Error(`le serveur dev ne répond pas :\n${journal}`);
      await new Promise((r) => setTimeout(r, 250));
    }
    const p = await navigateur.newPage({ viewport: { width: 390, height: 844 } });
    // Au démarrage à froid, Vite peut réoptimiser ses dépendances et recharger la
    // page : on réessaie plutôt que d'échouer.
    for (let essai = 1; ; essai++) {
      try {
        await p.goto(url, { timeout: 60000 });
        await p.waitForSelector('#banc-scene', { state: 'attached', timeout: 45000 });
        await p.waitForTimeout(2500);
        await p.waitForSelector('#banc-scene', { state: 'attached', timeout: 15000 });
        break;
      } catch (e) {
        if (essai >= 4) throw e;
        console.log(`  le banc ne s'affiche pas encore (essai ${essai}), on recharge…`);
      }
    }
    // Le banc monte le salon : on passe sa table aux mises pour charger la feuille
    // de la table (screens/casino/table/table.css).
    await p.addScriptTag({ path: path.join(ATELIER, 'outils', 'banc.js') });
    await p.evaluate(() => window.__cyInit());
    await p.evaluate(() => {
      const { game, session } = window.__cy;
      window.__cyApply({ state: 'playing', blackjack: { ...game.BLACKJACK.fresh('banc-p1'), phase: 'betting', roundNumber: 3 }, casino: { ...session.freshSession(), opened: true } });
    });
    await p.waitForSelector('.table-ecran', { timeout: 30000 });
    await p.waitForTimeout(800);
    const feuilles = await p.evaluate(() => [...document.querySelectorAll('style')].map((s) => ({ id: (s.getAttribute('data-vite-dev-id') || 'inline').replace(/.*\/src\//, 'src/'), t: s.textContent })));
    const gardees = feuilles.filter((s) => !/roulette|poker|navale|purple|cliche|menteur|pyra|ckk|\buc\b|salon/.test(s.id));
    console.log(gardees.map((s) => `  ${s.id} ${s.t.length}`).join('\n'));
    return gardees.map((s) => `/* ==== ${s.id} ==== */\n${s.t}`).join('\n');
  } finally {
    await navigateur.close();
    vite.kill('SIGTERM');
  }
}

// ─── Un petit lecteur de CSS : règles, groupes (@media…), blocs bruts ────────
function lire(texte) {
  const out = []; let i = 0; const n = texte.length;
  const avance = (j, stop) => {
    let q = null;
    while (j < n) {
      const c = texte[j];
      if (q) { if (c === '\\') { j += 2; continue; } if (c === q) q = null; j++; continue; }
      if (c === '\\') { j += 2; continue; }
      if (c === '"' || c === "'") { q = c; j++; continue; }
      if (stop(c)) break;
      j++;
    }
    return j;
  };
  while (i < n) {
    while (i < n && /\s/.test(texte[i])) i++;
    if (i >= n) break;
    const j = avance(i, (c) => c === '{' || c === ';');
    const prelude = texte.slice(i, j).trim();
    if (j >= n) break;
    if (texte[j] === ';') { out.push({ type: 'stmt', texte: prelude + ';' }); i = j + 1; continue; }
    let d = 1, k = j + 1, q = null;
    while (k < n && d > 0) {
      const c = texte[k];
      if (q) { if (c === '\\') { k += 2; continue; } if (c === q) q = null; k++; continue; }
      if (c === '\\') { k += 2; continue; }
      if (c === '"' || c === "'") q = c; else if (c === '{') d++; else if (c === '}') d--;
      k++;
    }
    const dedans = texte.slice(j + 1, k - 1);
    if (prelude.startsWith('@')) {
      if (/^@(media|supports|layer|container)\b/.test(prelude)) out.push({ type: 'groupe', prelude, enfants: lire(dedans) });
      else out.push({ type: 'brut', prelude, corps: dedans });
    } else out.push({ type: 'regle', sel: prelude, corps: dedans });
    i = k;
  }
  return out;
}
function ecrire(liste, garder = () => true) {
  let s = '';
  for (const r of liste) {
    if (r.type === 'groupe') { const d = ecrire(r.enfants, garder); if (d.trim()) s += `${r.prelude}{\n${d}}\n`; }
    else if (r.type === 'regle') { if (garder(r)) s += `${r.sel}{${r.corps.trim()}}\n`; }
    else if (r.type === 'brut') s += `${r.prelude}{${r.corps}}\n`;
  }
  return s;
}
function sansKeyframesOrphelines(css) {
  for (const nom of [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])) {
    const reste = css.replace(new RegExp(`@keyframes\\s+${nom}\\b`, 'g'), '');
    if (new RegExp(`animation[^;{}]*\\b${nom}\\b`).test(reste)) continue;
    const debut = css.search(new RegExp(`@keyframes\\s+${nom}\\s*\\{`));
    let d = 0, k = css.indexOf('{', debut);
    for (; k < css.length; k++) { if (css[k] === '{') d++; else if (css[k] === '}') { d--; if (d === 0) break; } }
    css = css.slice(0, debut) + css.slice(k + 1);
  }
  return css.replace(/\n\s*\n+/g, '\n');
}

// ─── 3. Le CSS figé pour le téléphone de référence (390 × 844, tactile) ──────
function figer(brut) {
  const polices = new Set();
  const verdict = (prelude) => {
    const cond = prelude.replace(/^@media\s*/, '');
    if (/prefers-|print/.test(cond)) return 'garder';
    if (/hover:\s*hover|pointer:\s*fine/.test(cond)) return 'retirer';
    let ok = true, vu = false;
    cond.replace(/\((min|max)-(width|height):\s*([\d.]+)(rem|px|em)\)/g, (m, mm, dim, v, u) => {
      vu = true; const px = parseFloat(v) * (u === 'px' ? 1 : 16); const ref = dim === 'width' ? 390 : 844;
      if (mm === 'min' ? ref < px : ref > px) ok = false;
    });
    return !vu ? 'garder' : ok ? 'deballer' : 'retirer';
  };
  const passe = (liste) => {
    let s = '';
    for (const r of liste) {
      if (r.type === 'groupe') {
        const v = r.prelude.startsWith('@media') ? verdict(r.prelude) : 'garder';
        if (v === 'retirer') continue;
        const d = passe(r.enfants);
        if (v === 'deballer') s += d; else if (d.trim()) s += `${r.prelude}{\n${d}}\n`;
      } else if (r.type === 'regle') {
        const sel = r.sel
          .replace(/(^|[\s,>+~])body::(before|after)/g, '$1.cy-bg::$2') // le fond du site, dans le téléphone
          .replace(/:active\b/g, ':is(:active, .cy-press)');             // l'appui du doigt fictif
        s += `${sel}{${r.corps.trim()}}\n`;
      } else if (r.type === 'brut') {
        if (r.prelude.startsWith('@font-face')) {
          const m = r.corps.match(/url\(['"]?(\/fonts\/[^'")]+)['"]?\)/);
          const f = m && m[1].match(POLICES_LATIN);
          if (!f) continue;
          polices.add(f[1]);
          s += `@font-face{${r.corps.replace(m[0], `url('cy-${f[1]}')`).trim()}}\n`;
        } else s += `${r.prelude}{${r.corps}}\n`;
      }
    }
    return s;
  };
  let css = passe(lire(brut.replace(/\/\*[\s\S]*?\*\//g, '')));
  css = css
    .replace(/(-?\d*\.?\d+)(dvh|svh|lvh|vh)\b/g, (m, v) => `${(parseFloat(v) * 8.44).toFixed(2)}px`)
    .replace(/(-?\d*\.?\d+)(dvw|svw|lvw|vw)\b/g, (m, v) => `${(parseFloat(v) * 3.9).toFixed(2)}px`)
    .replace(/(-?\d*\.?\d+)vmax\b/g, (m, v) => `${(parseFloat(v) * 8.44).toFixed(2)}px`)
    .replace(/(-?\d*\.?\d+)vmin\b/g, (m, v) => `${(parseFloat(v) * 3.9).toFixed(2)}px`);
  return { css: sansKeyframesOrphelines(css), polices };
}

// ─── 2. La vraie table, compilée ─────────────────────────────────────────────
async function compiler() {
  etape('compilation (esbuild)');
  const stub = (f) => path.join(ATELIER, 'src', 'stubs', f);
  const greffe = {
    name: 'tuile',
    setup(b) {
      b.onResolve({ filter: /^@wt\// }, (a) => b.resolve(`./${a.path.slice(4)}`, { resolveDir: path.join(WEB, 'src'), kind: a.kind }));
      // UN SEUL React : celui de l'appli, pour la tuile comme pour ses composants.
      b.onResolve({ filter: /^(react|react-dom|scheduler)(\/.*)?$/ }, (a) => (a.resolveDir.startsWith(WEB) ? undefined : b.resolve(a.path, { resolveDir: WEB, kind: a.kind })));
      b.onResolve({ filter: /\.css$/ }, () => ({ path: 'css', namespace: 'vide' }));
      b.onLoad({ filter: /.*/, namespace: 'vide' }, () => ({ contents: '', loader: 'js' }));
      b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: stub('router.tsx') }));
      b.onResolve({ filter: /(^|\/)lib\/supabase(\.ts)?$/ }, () => ({ path: stub('supabase.ts') }));
      b.onResolve({ filter: /(^|\/)lib\/sound(\.ts)?$/ }, () => ({ path: stub('sound.ts') }));
    },
  };
  const sortie = path.join(TMP, 'tuile.js');
  await esbuild.build({
    entryPoints: [path.join(ATELIER, 'src', 'harness.tsx')],
    bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: sortie,
    jsx: 'automatic', nodePaths: [path.join(WEB, 'node_modules')], plugins: [greffe], legalComments: 'none',
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production"}' },
    logLevel: 'warning',
  });
  const js = fs.readFileSync(sortie, 'utf8').replace(/<\/script/gi, '<\\/script');
  console.log(`  ${(js.length / 1024).toFixed(0)} Ko`);
  return js;
}

function assembler(css, js) {
  const gabarit = fs.readFileSync(path.join(ATELIER, 'src', 'template.html'), 'utf8');
  return gabarit
    .replace('<!--__ORIGINE__-->', () => `<!-- Tuile construite par ateliers/${ID}/construire.mjs depuis cyrose-casino-table (${branche} @ ${commit.split(' ')[0]}) -->`)
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js);
}

// ─── 4. Élagage : les règles réellement utilisées ────────────────────────────
async function elaguer(html) {
  etape('élagage du CSS (une boucle + l’état fixe)');
  fs.writeFileSync(path.join(TMP, 'complet.html'), html);
  const navigateur = await chromium.launch({ channel: 'chrome' });
  const utilisees = [];
  try {
    for (const [rm, duree] of [['no-preference', 14500], ['reduce', 2500]]) {
      const p = await navigateur.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: rm });
      const erreurs = [];
      p.on('pageerror', (e) => erreurs.push(e.message));
      await p.route(`${ORIGINE}/**`, (r) => {
        const f = path.join(TMP, path.basename(new URL(r.request().url()).pathname));
        if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
        r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.html') ? 'text/html' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' });
      });
      await p.goto(`${ORIGINE}/complet.html`);
      await p.evaluate(() => { window.__cySel = '#cy-css'; });
      await p.addScriptTag({ path: path.join(ATELIER, 'outils', 'collecte.js') });
      await p.evaluate((d) => new Promise((ok) => { const t0 = performance.now(); const iv = setInterval(() => { window.__cyCollect(); if (performance.now() - t0 > d) { clearInterval(iv); ok(); } }, 30); }), duree);
      utilisees.push(await p.evaluate(() => window.__cyEmit()));
      if (erreurs.length) throw new Error(`erreurs JS (${rm}) : ${erreurs.join(' | ')}`);
      await p.close();
    }
  } finally { await navigateur.close(); }
  const norme = (s) => s.replace(/\s+/g, ' ').trim();
  const cles = new Set();
  utilisees.join('\n').replace(/([^{}\n][^{}]*)\{([^{}]*)\}/g, (x, sel, corps) => { cles.add(`${norme(sel)}{${norme(corps)}}`); return x; });
  const actuel = html.match(/<style id="cy-css">\n([\s\S]*?)\n<\/style>/)[1];
  return sansKeyframesOrphelines(ecrire(lire(actuel), (r) => cles.has(`${norme(r.sel)}{${norme(r.corps)}}`)));
}

// ─── Le tout ─────────────────────────────────────────────────────────────────
const brut = await cssDeLAppli();
fs.writeFileSync(path.join(TMP, 'appli.css'), brut);
const js = await compiler();
etape('CSS figé pour 390×844');
const { css, polices } = figer(brut);
for (const f of polices) fs.copyFileSync(path.join(WEB, 'public', 'fonts', f), path.join(TMP, `cy-${f}`));
const complet = assembler(css, js);
const elague = await elaguer(complet);
console.log(`  CSS ${(css.length / 1024).toFixed(0)} Ko → ${(elague.length / 1024).toFixed(0)} Ko`);
const final = complet.replace(/(<style id="cy-css">\n)[\s\S]*?(\n<\/style>)/, (m, a, b) => a + elague + b);
etape('écriture');
fs.mkdirSync(SORTIE, { recursive: true });
for (const f of polices) {
  if (!new RegExp(`cy-${f}`).test(elague)) continue;
  fs.copyFileSync(path.join(WEB, 'public', 'fonts', f), path.join(SORTIE, `cy-${f}`));
  console.log(`  public/tuiles/cy-${f}`);
}
fs.writeFileSync(path.join(SORTIE, `${ID}.html`), final);
console.log(`  public/tuiles/${ID}.html (${(final.length / 1024).toFixed(0)} Ko)`);
