// L'HORLOGE DE LA TUILE. Sans `?t=`, rien : la tuile vit au temps réel.
// Avec `?t=<s>`, le temps devient VIRTUEL — minuteurs, rAF, Date.now,
// performance.now, animations Web et transitions CSS — et la manche est jouée
// d'un trait jusqu'à l'instant demandé, puis figée. Même script, mêmes
// minuteurs : l'image figée est celle qu'on verrait en direct à cet instant.
(function () {
  var q = new URLSearchParams(location.search).get('t');
  if (q === null) return;
  var cible = Math.max(0, parseFloat(q) || 0) * 1000;
  var origine = { date: Date.UTC(2026, 9, 11, 20, 0, 0), perf: 1000 };
  var maintenant = 0;
  var minuteurs = new Map();
  var images = new Map();
  var seq = 1;

  window.setTimeout = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = seq++;
    minuteurs.set(id, { at: maintenant + Math.max(0, +ms || 0), fn: fn, args: args, id: id, rep: 0 });
    return id;
  };
  window.setInterval = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = seq++;
    var p = Math.max(1, +ms || 0);
    minuteurs.set(id, { at: maintenant + p, fn: fn, args: args, id: id, rep: p });
    return id;
  };
  window.clearTimeout = window.clearInterval = function (id) { minuteurs.delete(id); };
  var vraiRaf = window.requestAnimationFrame.bind(window);
  var fini = false;
  // Figé, une image demandée part au vrai rAF : le temps ne bouge plus, elle
  // redessine la même chose (et l'outil qui attend une image n'attend pas).
  window.requestAnimationFrame = function (fn) {
    if (fini) return vraiRaf(function () { fn(origine.perf + maintenant); });
    var id = seq++; images.set(id, fn); return id;
  };
  window.cancelAnimationFrame = function (id) { images.delete(id); };
  Date.now = function () { return origine.date + maintenant; };
  performance.now = function () { return origine.perf + maintenant; };

  // Les animations : chacune est arrêtée à sa naissance, puis posée à
  // (maintenant - naissance) ; finie, elle est terminée pour de bon (ses
  // promesses `finished` se résolvent, comme en vrai).
  var naissances = new Map();
  // Toutes celles déjà vues : une animation finie qui « remplit » reste dans
  // getAnimations(), elle ne doit pas être reprise de zéro.
  var vues = new WeakSet();
  var animate = Element.prototype.animate;
  Element.prototype.animate = function () {
    var a = animate.apply(this, arguments);
    a.pause();
    a.currentTime = 0;
    naissances.set(a, maintenant);
    vues.add(a);
    return a;
  };
  function piloter() {
    document.getAnimations().forEach(function (a) {
      if (vues.has(a)) return;
      vues.add(a);
      naissances.set(a, maintenant);
      try { a.pause(); } catch (e) { console.warn('[horloge] pause', e && e.message); }
    });
    naissances.forEach(function (t0, a) {
      if (a.playState === 'idle') { naissances.delete(a); return; }
      try {
        var fin = a.effect ? a.effect.getComputedTiming().endTime : 0;
        var t = maintenant - t0;
        if (isFinite(fin) && t >= fin) { naissances.delete(a); a.finish(); }
        else a.currentTime = t;
      } catch (e) { console.warn('[horloge]', e && e.message); naissances.delete(a); }
    });
  }

  var canal = new MessageChannel();
  var attente = [];
  canal.port1.onmessage = function () { var f = attente.shift(); if (f) f(); };
  // Laisse React (ordonnanceur sur MessageChannel) et les microtâches finir.
  function souffler() { return new Promise(function (ok) { attente.push(ok); canal.port2.postMessage(0); }); }
  async function calme() { for (var i = 0; i < 4; i++) await souffler(); }

  var IMAGE = 32; // une image toutes les 32 ms virtuelles (entier : pas de point fixe flottant)
  async function avancer(jusqua) {
    await calme();
    piloter();
    var prochaineImage = IMAGE;
    while (maintenant < jusqua) {
      var t = jusqua;
      minuteurs.forEach(function (m) { if (m.at < t) t = m.at; });
      if (images.size && prochaineImage < t) t = prochaineImage;
      maintenant = Math.max(maintenant, t);
      // Les minuteurs échus, dans l'ordre de leur échéance.
      var dus = [];
      minuteurs.forEach(function (m) { if (m.at <= maintenant) dus.push(m); });
      dus.sort(function (a, b) { return a.at - b.at || a.id - b.id; });
      for (var i = 0; i < dus.length; i++) {
        var m = dus[i];
        if (!minuteurs.has(m.id)) continue;
        if (m.rep) m.at += m.rep; else minuteurs.delete(m.id);
        try { if (typeof m.fn === 'function') m.fn.apply(window, m.args); } catch (e) { console.error(e); }
      }
      if (maintenant >= prochaineImage) {
        prochaineImage = maintenant + IMAGE;
        var lot = Array.from(images.values());
        images.clear();
        lot.forEach(function (f) { try { f(origine.perf + maintenant); } catch (e) { console.error(e); } });
      }
      await calme();
      piloter();
    }
    // La dernière image, exactement à l'instant demandé.
    var lot2 = Array.from(images.values());
    images.clear();
    lot2.forEach(function (f) { try { f(origine.perf + maintenant); } catch (e) { console.error(e); } });
    try { await calme(); piloter(); }
    catch (e) { console.error('[horloge]', e); }
    finally {
      fini = true;
      images.forEach(function (f) { vraiRaf(function () { f(origine.perf + maintenant); }); });
      images.clear();
      document.documentElement.setAttribute('data-fige', String(jusqua / 1000)); }
  }

  window.__cyHorloge = { fige: cible, avancer: avancer };
})();
