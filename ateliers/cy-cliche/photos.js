// LES TIRAGES DE LA TABLÉE. Aucune vraie photo : cinq clichés « un truc qui
// brille » peints au canvas, traités comme des photos de téléphone prises en
// soirée (bruit dans les ombres, hautes lumières qui bavent, vignettage, un
// peu de flou). Exécuté dans Chrome par construire.mjs, qui en tire des JPEG.
//
//   window.__photo(nom) -> HTMLCanvasElement 600 × 800
//   noms : boule, guirlande, cierge, sequins, neon
(function () {
  const W = 600, H = 800;

  function alea(graine) {
    let a = graine >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const toile = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctx2 = (c) => c.getContext('2d');

  // Floute une toile entière (copie).
  function flou(src, px) {
    const c = toile(src.width, src.height), g = ctx2(c);
    g.filter = `blur(${px}px)`;
    g.drawImage(src, 0, 0);
    return c;
  }

  // Le traitement « téléphone » : halo des hautes lumières, vignettage, grain
  // de capteur (plus fort dans les ombres), légère courbe.
  function developper(src, r, { halo = 0.5, vignette = 0.55, grain = 10, chaleur = 0, penche = 0 } = {}) {
    const c = toile(), g = ctx2(c);
    if (penche) {
      // la main qui tient le téléphone n'est jamais droite : on tourne, et on
      // recadre juste assez pour ne pas voir les coins
      const a = (penche * Math.PI) / 180;
      const k = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)) * (H / W);
      g.translate(W / 2, H / 2);
      g.rotate(a);
      g.scale(k, k);
      g.drawImage(src, -W / 2, -H / 2);
      g.setTransform(1, 0, 0, 1, 0, 0);
      src = flou(c, 0);
    } else g.drawImage(src, 0, 0);
    if (halo > 0) {
      // bloom : les zones claires bavent un peu (seuil approximé par contraste)
      const b = toile(), bg = ctx2(b);
      bg.filter = 'brightness(0.9) contrast(2.6) blur(14px)';
      bg.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = halo;
      g.drawImage(b, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    if (vignette > 0) {
      const v = g.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.72);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${vignette})`);
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      const amp = grain * (1.25 - lum);
      const n = (r() - 0.5) * amp;
      d[i] = d[i] + n + (r() - 0.5) * amp * 0.5 + chaleur;
      d[i + 1] = d[i + 1] + n + (r() - 0.5) * amp * 0.5;
      d[i + 2] = d[i + 2] + n + (r() - 0.5) * amp * 0.5 - chaleur;
    }
    g.putImageData(img, 0, 0);
    // la photo d'un téléphone n'est jamais parfaitement nette
    return flou(c, 0.45);
  }

  // Un disque de bokeh : bord un peu plus clair, cœur doux.
  function bokeh(g, x, y, rayon, couleur, alpha) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rayon);
    gr.addColorStop(0, couleur.replace('A', (alpha * 0.55).toFixed(3)));
    gr.addColorStop(0.82, couleur.replace('A', (alpha * 0.75).toFixed(3)));
    gr.addColorStop(0.93, couleur.replace('A', alpha.toFixed(3)));
    gr.addColorStop(1, couleur.replace('A', '0'));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rayon, 0, Math.PI * 2);
    g.fill();
  }

  // Une source ponctuelle : cœur blanc, halo coloré.
  function lueur(g, x, y, rayon, couleur, force = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rayon);
    gr.addColorStop(0, `rgba(255,255,255,${force})`);
    gr.addColorStop(0.12, couleur.replace('A', (0.9 * force).toFixed(3)));
    gr.addColorStop(0.4, couleur.replace('A', (0.25 * force).toFixed(3)));
    gr.addColorStop(1, couleur.replace('A', '0'));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rayon, 0, Math.PI * 2);
    g.fill();
  }

  // ─────────────────────────────────────────────────────────── la boule à facettes
  function boule() {
    const r = alea(11);
    const c = toile(), g = ctx2(c);
    // la pièce : plafond sombre, un mur violet bleuté à peine éclairé
    const fond = g.createLinearGradient(0, 0, 0, H);
    fond.addColorStop(0, '#07060d');
    fond.addColorStop(0.55, '#141026');
    fond.addColorStop(1, '#1d1230');
    g.fillStyle = fond;
    g.fillRect(0, 0, W, H);
    // un projecteur hors champ, en haut à droite
    const spot = g.createRadialGradient(560, 90, 10, 560, 90, 420);
    spot.addColorStop(0, 'rgba(120,90,255,0.35)');
    spot.addColorStop(1, 'rgba(120,90,255,0)');
    g.fillStyle = spot;
    g.fillRect(0, 0, W, H);
    // les éclats renvoyés sur les murs (flous, ovales)
    const eclats = toile(), ge = ctx2(eclats);
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = 260 + r() * (H - 260);
      const teinte = r() < 0.5 ? '255,250,235' : r() < 0.5 ? '190,170,255' : '255,140,210';
      ge.fillStyle = `rgba(${teinte},${0.25 + r() * 0.6})`;
      ge.beginPath();
      ge.ellipse(x, y, 2 + r() * 5, 1.5 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
      ge.fill();
    }
    g.drawImage(flou(eclats, 1.6), 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.6;
    g.drawImage(flou(eclats, 7), 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    // la boule
    const cx = 300, cy = 385, R = 168;
    // la chaîne
    g.strokeStyle = 'rgba(150,150,165,0.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx + 2, 0);
    g.lineTo(cx, cy - R + 4);
    g.stroke();
    g.fillStyle = '#0b0b10';
    g.beginPath();
    g.arc(cx, cy, R + 1, 0, Math.PI * 2);
    g.fill();
    // facettes : orthographique, la boule tourne de 12°, inclinaison 14°
    const incl = (14 * Math.PI) / 180, rot = 0.21;
    const proj = (phi, th) => {
      const x = Math.cos(phi) * Math.sin(th);
      const y0 = Math.sin(phi);
      const z0 = Math.cos(phi) * Math.cos(th);
      const y = y0 * Math.cos(incl) - z0 * Math.sin(incl);
      const z = y0 * Math.sin(incl) + z0 * Math.cos(incl);
      return [cx + x * R, cy - y * R, z, x, -y];
    };
    const bandes = 26;
    const facettes = [];
    for (let b = 0; b < bandes; b++) {
      const p0 = -Math.PI / 2 + (b / bandes) * Math.PI;
      const p1 = -Math.PI / 2 + ((b + 1) / bandes) * Math.PI;
      const pm = (p0 + p1) / 2;
      const n = Math.max(4, Math.round(bandes * 2 * Math.cos(pm)));
      for (let k = 0; k < n; k++) {
        const t0 = (k / n) * Math.PI * 2 + rot + b * 0.07;
        const t1 = ((k + 1) / n) * Math.PI * 2 + rot + b * 0.07;
        const pts = [proj(p0, t0), proj(p0, t1), proj(p1, t1), proj(p1, t0)];
        const centre = proj(pm, (t0 + t1) / 2);
        if (centre[2] <= 0.02) continue;
        facettes.push({ pts, centre });
      }
    }
    facettes.sort((a, b) => a.centre[2] - b.centre[2]);
    const chauds = [];
    for (const f of facettes) {
      const [, , z, nx, ny] = f.centre;
      // reflet du projecteur (en haut à droite) + un néon rose à gauche
      const spec = Math.max(0, nx * 0.55 + ny * -0.6 + z * 0.58);
      const rose = Math.max(0, -nx * 0.8 + z * 0.3 + ny * 0.2);
      let v = 28 + r() * 70 + spec * 60;
      let col = [v, v, v * 1.08];
      const tirage = r();
      if (tirage < 0.07 + spec * spec * 0.4) {
        col = [255, 252, 244];
        chauds.push(f.centre);
      } else if (tirage < 0.12 + rose * 0.18) {
        col = [255, 120 + r() * 60, 200 + r() * 40];
      } else if (tirage < 0.2) {
        col = [130 + r() * 40, 110 + r() * 40, 255];
      }
      const sh = 0.35 + 0.65 * Math.pow(z, 0.7);
      g.fillStyle = `rgb(${col[0] * sh | 0},${col[1] * sh | 0},${col[2] * sh | 0})`;
      g.beginPath();
      // un joint sombre entre les miroirs : on rétrécit la facette vers son centre
      f.pts.forEach(([x, y], i) => {
        const xx = f.centre[0] + (x - f.centre[0]) * 0.86;
        const yy = f.centre[1] + (y - f.centre[1]) * 0.86;
        i ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
      });
      g.closePath();
      g.fill();
    }
    // le volume : ombre propre en bas à gauche
    const vol = g.createRadialGradient(cx + 60, cy - 70, R * 0.2, cx, cy, R * 1.05);
    vol.addColorStop(0, 'rgba(0,0,0,0)');
    vol.addColorStop(0.75, 'rgba(0,0,0,0.15)');
    vol.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vol;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    // les miroirs qui renvoient le projecteur flambent
    g.globalCompositeOperation = 'lighter';
    chauds.forEach(([x, y, z], i) => lueur(g, x, y, 10 + z * 22, 'rgba(255,240,220,A)', 0.55));
    // une ou deux étoiles de diffraction
    for (const [x, y, z] of chauds.filter((p) => p[2] > 0.75).slice(0, 3)) {
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 1.4;
      for (const a of [0.3, 0.3 + Math.PI / 2]) {
        g.beginPath();
        g.moveTo(x - Math.cos(a) * 60, y - Math.sin(a) * 60);
        g.lineTo(x + Math.cos(a) * 60, y + Math.sin(a) * 60);
        g.stroke();
      }
      lueur(g, x, y, 46, 'rgba(255,230,250,A)', 0.7);
    }
    g.globalCompositeOperation = 'source-over';
    return developper(c, r, { halo: 0.55, vignette: 0.6, grain: 16, penche: -2.5 });
  }

  // ─────────────────────────────────────────────────────── la guirlande lumineuse
  function guirlande() {
    const r = alea(23);
    const c = toile(), g = ctx2(c);
    const fond = g.createLinearGradient(0, 0, W, H);
    fond.addColorStop(0, '#120a06');
    fond.addColorStop(1, '#050304');
    g.fillStyle = fond;
    g.fillRect(0, 0, W, H);
    // au fond, les guirlandes hors foyer : de gros bokehs chauds
    const loin = toile(), gl = ctx2(loin);
    gl.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const chaud = r() < 0.8;
      const col = chaud ? `rgba(255,${150 + r() * 70 | 0},${50 + r() * 50 | 0},A)` : `rgba(${255},${120 + r() * 40 | 0},${150 + r() * 50 | 0},A)`;
      bokeh(gl, r() * W, r() * H, 26 + r() * 52, col, 0.18 + r() * 0.3);
    }
    g.drawImage(flou(loin, 1.2), 0, 0);
    // au premier plan, net : le fil et les ampoules, en guirlande qui pend
    const ampoules = [];
    const fil = (y0, creux, n, dx) => {
      g.strokeStyle = 'rgba(40,30,24,0.95)';
      g.lineWidth = 2.2;
      g.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = -40 + t * (W + 80) + dx;
        const y = y0 + Math.sin(t * Math.PI) * creux + Math.sin(t * 9) * 4;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
        if (i % Math.round(60 / n) === 3) ampoules.push([x, y + 9]);
      }
      g.stroke();
    };
    fil(240, 170, 11, 0);
    fil(500, 110, 9, 30);
    g.globalCompositeOperation = 'lighter';
    for (const [x, y] of ampoules) {
      lueur(g, x, y, 70, 'rgba(255,170,70,A)', 0.55);
      lueur(g, x, y, 16, 'rgba(255,230,170,A)', 1);
    }
    g.globalCompositeOperation = 'source-over';
    // les petits culots des ampoules
    g.fillStyle = 'rgba(30,22,16,0.9)';
    for (const [x, y] of ampoules) g.fillRect(x - 2.5, y - 12, 5, 6);
    return developper(c, r, { halo: 0.6, vignette: 0.5, grain: 18, chaleur: 3, penche: 1.5 });
  }

  // ───────────────────────────────────────── le cierge magique (pose longue, un cœur)
  function cierge() {
    const r = alea(37);
    const c = toile(), g = ctx2(c);
    const fond = g.createLinearGradient(0, 0, 0, H);
    fond.addColorStop(0, '#04050c');
    fond.addColorStop(0.7, '#0a0b16');
    fond.addColorStop(1, '#1a1009');
    g.fillStyle = fond;
    g.fillRect(0, 0, W, H);
    // le jardin la nuit : une haie à peine visible en bas
    g.fillStyle = 'rgba(10,9,8,0.9)';
    g.beginPath();
    g.moveTo(0, 660);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, 650 + Math.sin(x * 0.05) * 14 + r() * 10);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
    // le cœur tracé à la lumière, d'un trait un peu tremblé
    const trace = [];
    for (let i = 0; i <= 260; i++) {
      const t = (i / 260) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      trace.push([300 + x * 13.5 + Math.sin(i * 0.4) * 2.5, 330 - y * 13.5 + Math.cos(i * 0.33) * 2.5]);
    }
    // et le tour s'achève en descendant vers le cierge
    for (let i = 1; i <= 30; i++) trace.push([300 + i * 1.2, 330 + 175 * 0 + i * 7]);
    const tracer = (largeur, couleur, floutage) => {
      const t = toile(), gt = ctx2(t);
      gt.strokeStyle = couleur;
      gt.lineWidth = largeur;
      gt.lineCap = 'round';
      gt.lineJoin = 'round';
      gt.beginPath();
      trace.forEach(([x, y], i) => (i ? gt.lineTo(x, y) : gt.moveTo(x, y)));
      gt.stroke();
      return floutage ? flou(t, floutage) : t;
    };
    g.globalCompositeOperation = 'lighter';
    g.drawImage(tracer(34, 'rgba(255,110,20,0.35)', 18), 0, 0);
    g.drawImage(tracer(12, 'rgba(255,170,60,0.7)', 5), 0, 0);
    g.drawImage(tracer(4, 'rgba(255,240,200,0.95)', 0.8), 0, 0);
    // des étincelles qui jaillissent le long du trait
    for (let i = 0; i < 220; i++) {
      const [x, y] = trace[(r() * trace.length) | 0];
      const a = r() * Math.PI * 2, l = 6 + r() * 26;
      g.strokeStyle = `rgba(255,${200 + r() * 55 | 0},${120 + r() * 80 | 0},${0.25 + r() * 0.5})`;
      g.lineWidth = 0.8 + r();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // le cierge lui-même, en bas : la tige, le foyer, la gerbe
    const fx = 336, fy = 540;
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(70,64,60,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx + 40, H + 10);
    g.stroke();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, l = 20 + Math.pow(r(), 2) * 120;
      const mx = fx + Math.cos(a) * l * 0.5, my = fy + Math.sin(a) * l * 0.5;
      g.strokeStyle = `rgba(255,${210 + r() * 45 | 0},${150 + r() * 80 | 0},${0.35 + r() * 0.5})`;
      g.lineWidth = 0.7 + r() * 0.9;
      g.beginPath();
      g.moveTo(fx, fy);
      g.quadraticCurveTo(mx + (r() - 0.5) * 10, my + (r() - 0.5) * 10, fx + Math.cos(a) * l, fy + Math.sin(a) * l + l * 0.08);
      g.stroke();
      // une petite fourche au bout
      if (r() < 0.4) {
        const ex = fx + Math.cos(a) * l, ey = fy + Math.sin(a) * l;
        for (let k = 0; k < 3; k++) {
          const b = a + (r() - 0.5) * 1.6;
          g.beginPath();
          g.moveTo(ex, ey);
          g.lineTo(ex + Math.cos(b) * 9, ey + Math.sin(b) * 9);
          g.stroke();
        }
      }
    }
    lueur(g, fx, fy, 180, 'rgba(255,140,40,A)', 0.55);
    lueur(g, fx, fy, 40, 'rgba(255,230,180,A)', 1);
    // la lumière orange qui retombe sur l'herbe
    const sol = g.createRadialGradient(fx, 720, 10, fx, 720, 300);
    sol.addColorStop(0, 'rgba(255,120,30,0.22)');
    sol.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = sol;
    g.fillRect(0, 500, W, 300);
    g.globalCompositeOperation = 'source-over';
    return developper(c, r, { halo: 0.5, vignette: 0.45, grain: 20, penche: 2 });
  }

  // ───────────────────────────────────────────── les sequins d'une robe, de près
  function sequins() {
    const r = alea(53);
    const c = toile(), g = ctx2(c);
    g.fillStyle = '#1a0b14';
    g.fillRect(0, 0, W, H);
    const pas = 30, rayon = 19;
    // la lumière : un flash au centre gauche, une lampe rose en haut à droite
    for (let row = -1; row < H / (pas * 0.8) + 2; row++) {
      for (let col = -1; col < W / pas + 2; col++) {
        const x = col * pas + (row % 2 ? pas / 2 : 0) + Math.sin(row * 0.4) * 6;
        const y = row * pas * 0.8 + Math.sin(col * 0.3 + row * 0.2) * 5;
        // le tissu ondule : l'orientation des sequins suit une vague
        const onde = Math.sin(x * 0.012 + y * 0.008) * 0.5 + Math.sin(y * 0.02 - x * 0.004) * 0.5;
        const flash = Math.exp(-((x - 230) ** 2 + (y - 360) ** 2) / (2 * 190 ** 2));
        const rosee = Math.exp(-((x - 520) ** 2 + (y - 120) ** 2) / (2 * 150 ** 2));
        const brille = Math.max(0, onde * 0.6 + (r() - 0.5) * 0.9) * (0.4 + flash * 1.2);
        // or rosé : base cuivrée, reflet presque blanc
        const base = [150 + r() * 30, 92 + r() * 20, 70 + r() * 20];
        const k = Math.min(1, brille);
        let col_ = [
          base[0] * (0.45 + k) + 120 * rosee,
          base[1] * (0.45 + k) + 40 * rosee,
          base[2] * (0.45 + k) + 90 * rosee,
        ];
        if (r() < 0.02 + flash * 0.07) col_ = [255, 245, 235];
        const ang = onde * 1.2 + r() * 0.5;
        const gr = g.createLinearGradient(x - rayon * Math.cos(ang), y - rayon * Math.sin(ang), x + rayon * Math.cos(ang), y + rayon * Math.sin(ang));
        const s = (v, m) => Math.max(0, Math.min(255, v * m)) | 0;
        gr.addColorStop(0, `rgb(${s(col_[0], 1.15)},${s(col_[1], 1.15)},${s(col_[2], 1.15)})`);
        gr.addColorStop(1, `rgb(${s(col_[0], 0.55)},${s(col_[1], 0.55)},${s(col_[2], 0.55)})`);
        // l'ombre portée du sequin sur le suivant
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.beginPath();
        g.ellipse(x + 2, y + 4, rayon, rayon * 0.92, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(x, y, rayon, rayon * 0.92, 0, 0, Math.PI * 2);
        g.fill();
        // le petit trou du fil
        g.fillStyle = 'rgba(30,12,18,0.8)';
        g.beginPath();
        g.arc(x, y - rayon * 0.55, 2, 0, Math.PI * 2);
        g.fill();
        if (col_[0] === 255) {
          g.globalCompositeOperation = 'lighter';
          lueur(g, x + (r() - 0.5) * 8, y + (r() - 0.5) * 8, 26, 'rgba(255,220,200,A)', 0.7);
          g.globalCompositeOperation = 'source-over';
        }
      }
    }
    // profondeur de champ : net au milieu, flou en haut et en bas
    const net = c;
    const flouFort = flou(net, 7);
    const out = toile(), go = ctx2(out);
    go.drawImage(flouFort, 0, 0);
    const masque = toile(), gm = ctx2(masque);
    gm.drawImage(net, 0, 0);
    gm.globalCompositeOperation = 'destination-in';
    const m = gm.createLinearGradient(0, 0, 0, H);
    m.addColorStop(0, 'rgba(0,0,0,0)');
    m.addColorStop(0.32, 'rgba(0,0,0,1)');
    m.addColorStop(0.6, 'rgba(0,0,0,1)');
    m.addColorStop(0.95, 'rgba(0,0,0,0)');
    gm.fillStyle = m;
    gm.fillRect(0, 0, W, H);
    go.drawImage(masque, 0, 0);
    return developper(out, r, { halo: 0.45, vignette: 0.5, grain: 12 });
  }

  // ─────────────────────────────────────────── l'enseigne au néon, au fond du bar
  function neon() {
    const r = alea(71);
    const c = toile(), g = ctx2(c);
    // le mur de briques, à peine éclairé
    g.fillStyle = '#0c0708';
    g.fillRect(0, 0, W, H);
    const bh = 26, bw = 66;
    for (let row = 0; row * bh < H + bh; row++) {
      for (let col = -1; col * bw < W + bw; col++) {
        const x = col * bw + (row % 2 ? bw / 2 : 0), y = row * bh;
        const v = 34 + r() * 22;
        g.fillStyle = `rgb(${v + 14 | 0},${v * 0.62 | 0},${v * 0.55 | 0})`;
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        // le grain de la brique
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`;
          g.fillRect(x + 2 + r() * (bw - 8), y + 2 + r() * (bh - 8), 2 + r() * 6, 1 + r() * 3);
        }
      }
    }
    // le dessin des tubes : un verre à cocktail (cyan), l'olive (citron vert),
    // deux étoiles (rose)
    const tubes = [];
    const verre = new Path2D();
    verre.moveTo(170, 230); verre.lineTo(430, 230); verre.lineTo(300, 400);
    verre.closePath();
    verre.moveTo(300, 400); verre.lineTo(300, 560);
    verre.moveTo(232, 572); verre.quadraticCurveTo(300, 548, 368, 572);
    tubes.push([verre, '0,230,255']);
    const olive = new Path2D();
    olive.arc(268, 290, 22, 0, Math.PI * 2);
    olive.moveTo(268, 290); olive.lineTo(352, 176);
    tubes.push([olive, '170,255,60']);
    const etoile = (cx, cy, R) => {
      const p = new Path2D();
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.45 : R;
        i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      return p;
    };
    tubes.push([etoile(468, 132, 42), '255,60,170']);
    tubes.push([etoile(120, 470, 28), '255,60,170']);
    // la lumière des tubes qui tombe sur le mur
    g.globalCompositeOperation = 'lighter';
    lueur(g, 300, 330, 380, 'rgba(0,170,230,A)', 0.28);
    lueur(g, 468, 132, 220, 'rgba(255,40,150,A)', 0.25);
    lueur(g, 120, 470, 160, 'rgba(255,40,150,A)', 0.2);
    const couche = (largeur, alpha, floutage, blanc) => {
      const t = toile(), gt = ctx2(t);
      gt.lineCap = 'round';
      gt.lineJoin = 'round';
      for (const [p, rgb] of tubes) {
        gt.strokeStyle = blanc ? `rgba(255,255,255,${alpha})` : `rgba(${rgb},${alpha})`;
        gt.lineWidth = largeur;
        gt.stroke(p);
      }
      return floutage ? flou(t, floutage) : t;
    };
    g.drawImage(couche(40, 0.32, 22), 0, 0);
    g.drawImage(couche(13, 0.75, 4), 0, 0);
    g.drawImage(couche(6, 0.95, 1), 0, 0);
    g.drawImage(couche(2.4, 0.75, 0.6, true), 0, 0);
    g.globalCompositeOperation = 'source-over';
    // les attaches du tube, sombres
    g.fillStyle = 'rgba(20,20,24,0.9)';
    for (const [x, y] of [[200, 230], [400, 230], [300, 470], [468, 100], [260, 310]]) g.fillRect(x - 3, y - 5, 6, 10);
    return developper(c, r, { halo: 0.5, vignette: 0.55, grain: 18, penche: 3.5 });
  }

  const PHOTOS = { boule, guirlande, cierge, sequins, neon };
  window.__photo = (nom) => PHOTOS[nom]();
  window.__photos = Object.keys(PHOTOS);
})();
