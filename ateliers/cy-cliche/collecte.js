// Élagage du CSS d’après le DOM réel : on garde une règle dès qu’un de ses sélecteurs (débarrassé des pseudo-classes d’état) a trouvé un élément pendant la partie.
(function () {
  function parse(text) {
    const out = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
      while (i < n && /\s/.test(text[i])) i++;
      if (i >= n) break;
      let j = i, q = null;
      while (j < n) {
        const c = text[j];
        if (q) { if (c === '\\') { j += 2; continue; } if (c === q) q = null; j++; continue; }
        if (c === '\\') { j += 2; continue; } if (c === '"' || c === "'") { q = c; j++; continue; }
        if (c === '{' || c === ';') break;
        j++;
      }
      const prelude = text.slice(i, j).trim();
      if (j >= n) break;
      if (text[j] === ';') { out.push({ type: 'stmt', text: prelude + ';' }); i = j + 1; continue; }
      let d = 1, k = j + 1; q = null;
      while (k < n && d > 0) {
        const c = text[k];
        if (q) { if (c === '\\') { k += 2; continue; } if (c === q) q = null; k++; continue; }
        if (c === '\\') { k += 2; continue; } if (c === '"' || c === "'") q = c;
        else if (c === '{') d++;
        else if (c === '}') d--;
        k++;
      }
      const inner = text.slice(j + 1, k - 1);
      if (prelude.startsWith('@')) {
        if (/^@(media|supports|layer|container|document)\b/.test(prelude)) out.push({ type: 'group', prelude, children: parse(inner) });
        else out.push({ type: 'raw', prelude, text: prelude + '{' + inner + '}' });
      } else out.push({ type: 'rule', sel: prelude, body: inner });
      i = k;
    }
    return out;
  }
  const strip = (sel) => sel
    .replace(/::?(before|after|placeholder|selection|-webkit-[a-z-]+|-moz-[a-z-]+|backdrop|marker|file-selector-button)\b(\([^)]*\))?/g, '')
    .replace(/:(hover|active|focus|focus-visible|focus-within|disabled|visited|checked|enabled)\b/g, '');
  function splitSel(s) { const parts = []; let d = 0, cur = ''; for (const c of s) { if (c === '(' || c === '[') d++; if (c === ')' || c === ']') d--; if (c === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += c; } parts.push(cur); return parts; }
  let sheets = null;
  window.__cyCollect = function () {
    if (!sheets) {
      sheets = [...document.querySelectorAll(window.__cySel || 'style')].map((st) => ({ id: st.getAttribute('data-vite-dev-id') || 'inline', tree: parse(st.textContent.replace(/\/\*[\s\S]*?\*\//g, '')) }));
    }
    const mark = (list) => list.forEach((r) => {
      if (r.type === 'group') mark(r.children);
      else if (r.type === 'rule' && !r.keep) {
        for (const s of splitSel(r.sel)) {
          const t = strip(s.trim()) || '*';
          try { if (document.querySelector(t)) { r.keep = true; break; } } catch (e) { r.keep = 'err'; break; }
        }
      }
    });
    sheets.forEach((s) => mark(s.tree));
    return true;
  };
  window.__cyEmit = function () {
    const emit = (list) => list.map((r) => {
      if (r.type === 'rule') return r.keep ? r.sel + '{' + r.body.trim() + '}\n' : '';
      if (r.type === 'group') { const inner = emit(r.children); return inner.trim() ? r.prelude + '{\n' + inner + '}\n' : ''; }
      if (r.type === 'raw') return r.text + '\n';
      return '';
    }).join('');
    return sheets.map((s) => '/* ==== ' + s.id.replace(/.*\/src\//, 'src/') + ' ==== */\n' + emit(s.tree)).join('');
  };
  window.__cyErrs = function () { const e = []; const w = (l) => l.forEach((r) => { if (r.type === 'group') w(r.children); else if (r.keep === 'err') e.push(r.sel); }); sheets.forEach((s) => w(s.tree)); return e; };
})();
