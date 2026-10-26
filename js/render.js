/* PAC-MAN 2027* — canvas renderer. Everything is drawn in tile units. */
(function (PM) {
  'use strict';
  const W = PM.W, H = PM.H, PI = Math.PI, TAU = PI * 2;
  const DIR_ANGLE = [-PI / 2, PI, PI / 2, 0];
  const FONT = "'Orbitron', 'Rubik', system-ui, sans-serif";

  /* ---------- small cached glow sprites (cheaper than shadowBlur every frame) ---------- */
  const glowCache = new Map();
  function glow(color, px) {
    const key = color + px;
    let c = glowCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = px * 2;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(px, px, 0, px, px, px);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.55; g.fillStyle = gr; g.fillRect(0, 0, px * 2, px * 2);
    glowCache.set(key, c);
    return c;
  }
  const rainbow = t => 'hsl(' + ((t * 140) % 360) + ',100%,60%)';

  /* ================= shapes (tile units, any canvas) ================= */
  const Draw = {
    pacColor(color, t) {
      if (color === 'rainbow') return rainbow(t);
      if (color === 'gold') return '#ffcf3a';
      return color;
    },
    pac(ctx, o) {
      // o: x, y, r, dir, mouth (0..1 open), color, hat, t, outline, alpha
      const r = o.r || 0.8, a = DIR_ANGLE[o.dir === undefined ? 3 : o.dir];
      const open = (o.mouth === undefined ? 0.2 : o.mouth) * PI * 0.42;
      ctx.save();
      if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
      let fill = Draw.pacColor(o.color, o.t || 0);
      if (o.color === 'gold') {
        const g = ctx.createLinearGradient(o.x - r, o.y - r, o.x + r, o.y + r);
        g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#ffc21a'); g.addColorStop(1, '#c98a00');
        fill = g;
      }
      ctx.beginPath();
      if (o.death !== undefined) { // arcade death: the mouth opens until nothing is left
        const f = o.death;
        ctx.moveTo(o.x, o.y);
        ctx.arc(o.x, o.y, r, -PI / 2 + f * PI, -PI / 2 + TAU - f * PI);
      } else {
        ctx.moveTo(o.x, o.y);
        ctx.arc(o.x, o.y, r, a + open, a + TAU - open);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (o.color === '#1b1b2e' || o.outline) { ctx.lineWidth = 0.09; ctx.strokeStyle = o.outline || '#7b5cff'; ctx.stroke(); }
      // little shine for depth
      if (o.death === undefined) {
        ctx.globalAlpha *= 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(o.x - r * 0.3, o.y - r * 0.45, r * 0.22, r * 0.12, -0.5, 0, TAU); ctx.fill();
      }
      ctx.restore();
      if (o.hat && o.hat !== 'none' && o.death === undefined) Draw.hat(ctx, o.hat, o.x, o.y, r, o.dir, o.t || 0);
    },
    hat(ctx, hat, x, y, r, dir, t) {
      const top = y - r * 0.82, face = dir === 1 ? -1 : 1;
      ctx.save();
      switch (hat) {
        case 'cap':
          ctx.fillStyle = '#ff3b5c';
          ctx.beginPath(); ctx.ellipse(x, top + 0.05, r * 0.62, r * 0.42, 0, PI, TAU); ctx.fill();
          ctx.fillRect(Math.min(x, x + face * r * 0.9), top, r * 0.9, 0.12);
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, top - r * 0.38, 0.07, 0, TAU); ctx.fill();
          break;
        case 'bow':
          ctx.fillStyle = '#ff5ec8';
          ctx.beginPath(); ctx.moveTo(x - 0.15, top - 0.05); ctx.lineTo(x - 0.55, top - 0.35); ctx.lineTo(x - 0.55, top + 0.25); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x + 0.15, top - 0.05); ctx.lineTo(x + 0.55, top - 0.35); ctx.lineTo(x + 0.55, top + 0.25); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ff9be0'; ctx.beginPath(); ctx.arc(x, top - 0.05, 0.16, 0, TAU); ctx.fill();
          break;
        case 'party': {
          const g = ctx.createLinearGradient(x - 0.35, 0, x + 0.35, 0);
          g.addColorStop(0, '#4ef2ff'); g.addColorStop(0.5, '#ff5ec8'); g.addColorStop(1, '#ffe14d');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x - 0.38, top + 0.12); ctx.lineTo(x + 0.38, top + 0.12); ctx.lineTo(x + 0.05, top - 0.85); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 0.05, top - 0.85, 0.13, 0, TAU); ctx.fill();
          break;
        }
        case 'headphones':
          ctx.strokeStyle = '#2a2c48'; ctx.lineWidth = 0.13;
          ctx.beginPath(); ctx.arc(x, y - 0.05, r * 0.98, PI * 1.08, PI * 1.92); ctx.stroke();
          ctx.fillStyle = '#4ef2ff';
          ctx.fillRect(x - r * 1.08, y - 0.3, 0.24, 0.48);
          ctx.fillRect(x + r * 1.08 - 0.24, y - 0.3, 0.24, 0.48);
          break;
        case 'antenna': {
          ctx.strokeStyle = '#c8cbe0'; ctx.lineWidth = 0.07;
          ctx.beginPath(); ctx.moveTo(x, top + 0.1); ctx.lineTo(x + 0.12, top - 0.55); ctx.stroke();
          const on = Math.floor(t * 3) % 2 === 0;
          ctx.fillStyle = on ? '#ff3b5c' : '#ffd23a';
          ctx.beginPath(); ctx.arc(x + 0.12, top - 0.6, 0.14, 0, TAU); ctx.fill();
          break;
        }
        case 'horns':
          ctx.fillStyle = '#a8aec8';
          ctx.beginPath(); ctx.ellipse(x, top + 0.12, r * 0.7, r * 0.3, 0, PI, TAU); ctx.fill();
          ctx.fillStyle = '#f4f0e0';
          for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(x + s * 0.45, top + 0.02); ctx.quadraticCurveTo(x + s * 0.95, top - 0.2, x + s * 0.8, top - 0.7);
            ctx.quadraticCurveTo(x + s * 0.7, top - 0.25, x + s * 0.3, top - 0.1); ctx.closePath(); ctx.fill();
          }
          break;
        case 'halo':
          ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 0.12; ctx.globalAlpha *= 0.9;
          ctx.beginPath(); ctx.ellipse(x, top - 0.38 + Math.sin(t * 3) * 0.05, r * 0.55, r * 0.18, 0, 0, TAU); ctx.stroke();
          break;
        case 'crown':
          ctx.fillStyle = '#ffcf3a';
          ctx.beginPath();
          ctx.moveTo(x - 0.48, top + 0.12); ctx.lineTo(x - 0.48, top - 0.32); ctx.lineTo(x - 0.24, top - 0.08); ctx.lineTo(x, top - 0.46);
          ctx.lineTo(x + 0.24, top - 0.08); ctx.lineTo(x + 0.48, top - 0.32); ctx.lineTo(x + 0.48, top + 0.12); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.arc(x, top - 0.02, 0.08, 0, TAU); ctx.fill();
          break;
      }
      ctx.restore();
    },
    ghost(ctx, o) {
      // o: x, y, color, dir, t, mode ('normal' | 'fright' | 'flash' | 'eyes' | 'frozen'), r
      const r = o.r || 0.82, x = o.x, y = o.y - 0.05, t = o.t || 0;
      ctx.save();
      if (o.mode !== 'eyes') {
        const body = o.mode === 'fright' ? '#2b3cff' : o.mode === 'flash' ? '#f4f4ff' : o.mode === 'frozen' ? '#bfefff' : o.color;
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(x, y - 0.08, r, PI, 0);
        const bottom = y + r * 0.86, n = 6, step = (2 * r) / n, phase = Math.floor(t * 8) % 2;
        ctx.lineTo(x + r, bottom);
        for (let i = 0; i < n; i++) {
          const px = x + r - (i + 0.5) * step;
          ctx.lineTo(px, bottom - ((i + phase) % 2 ? 0.22 : -0.02));
        }
        ctx.lineTo(x - r, bottom);
        ctx.closePath();
        ctx.fill();
        if (o.mode === 'fright' || o.mode === 'flash') {
          ctx.fillStyle = o.mode === 'flash' ? '#ff3b5c' : '#ffd8b8';
          ctx.beginPath(); ctx.arc(x - 0.27, y - 0.2, 0.11, 0, TAU); ctx.arc(x + 0.27, y - 0.2, 0.11, 0, TAU); ctx.fill();
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.08;
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) ctx.lineTo(x - 0.48 + i * 0.16, y + 0.28 + (i % 2 ? -0.09 : 0.05));
          ctx.stroke();
          ctx.restore();
          return;
        }
        if (o.mode === 'frozen') {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.06;
          ctx.strokeRect(x - r - 0.1, y - r - 0.15, 2 * r + 0.2, 2 * r + 0.3);
          ctx.fillStyle = 'rgba(160,230,255,0.35)';
          ctx.fillRect(x - r - 0.1, y - r - 0.15, 2 * r + 0.2, 2 * r + 0.3);
        }
      }
      const dx = PM.DX[o.dir === undefined ? 1 : o.dir] * 0.11, dy = PM.DY[o.dir === undefined ? 1 : o.dir] * 0.11;
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(x + s * 0.3 + dx * 0.6, y - 0.22 + dy * 0.6, 0.22, 0.28, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2233ff';
        ctx.beginPath(); ctx.arc(x + s * 0.3 + dx * 1.6, y - 0.2 + dy * 1.6, 0.12, 0, TAU); ctx.fill();
      }
      ctx.restore();
    },
    fruit(ctx, type, x, y, s) {
      s = s || 1;
      ctx.save();
      ctx.translate(x, y); ctx.scale(s, s);
      const circle = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); };
      const leaf = (cx, cy, rot, c) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = c || '#3ddc5a'; ctx.beginPath(); ctx.ellipse(0, 0, 0.22, 0.1, 0, 0, TAU); ctx.fill(); ctx.restore(); };
      switch (type) {
        case 'cherry':
          ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 0.08;
          ctx.beginPath(); ctx.moveTo(-0.3, 0.2); ctx.quadraticCurveTo(0, -0.4, 0.35, -0.55); ctx.moveTo(0.3, 0.25); ctx.quadraticCurveTo(0.3, -0.2, 0.35, -0.55); ctx.stroke();
          circle(-0.3, 0.3, 0.3, '#ff2244'); circle(0.3, 0.35, 0.3, '#ff2244');
          circle(-0.38, 0.22, 0.07, '#ffffff'); circle(0.22, 0.27, 0.07, '#ffffff');
          break;
        case 'strawberry':
          ctx.fillStyle = '#ff2b4a';
          ctx.beginPath(); ctx.moveTo(-0.45, -0.2); ctx.quadraticCurveTo(0, -0.45, 0.45, -0.2); ctx.quadraticCurveTo(0.4, 0.3, 0, 0.6); ctx.quadraticCurveTo(-0.4, 0.3, -0.45, -0.2); ctx.fill();
          ctx.fillStyle = '#ffe9a8';
          for (const [px, py] of [[-0.2, 0], [0.15, -0.05], [0, 0.25], [-0.1, 0.4], [0.2, 0.2]]) ctx.fillRect(px, py, 0.06, 0.06);
          leaf(-0.15, -0.3, -0.4); leaf(0.15, -0.3, 0.4);
          break;
        case 'orange':
          circle(0, 0.08, 0.48, '#ff9a1f'); leaf(0.15, -0.45, 0.3); circle(-0.15, -0.08, 0.08, '#ffd08a');
          break;
        case 'apple':
          circle(-0.18, 0.1, 0.38, '#ff2b3a'); circle(0.18, 0.1, 0.38, '#ff2b3a');
          ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.lineTo(0.05, -0.5); ctx.stroke();
          leaf(0.2, -0.42, -0.4); circle(-0.25, -0.02, 0.08, '#ffb0b8');
          break;
        case 'melon':
          circle(0, 0.05, 0.5, '#3ddc5a');
          ctx.strokeStyle = '#1e8a34'; ctx.lineWidth = 0.07;
          for (const k of [-0.25, 0, 0.25]) { ctx.beginPath(); ctx.ellipse(k, 0.05, 0.08, 0.48, 0, 0, TAU); ctx.stroke(); }
          break;
        case 'ship':
          ctx.fillStyle = '#4ef2ff';
          ctx.beginPath(); ctx.moveTo(0, -0.55); ctx.lineTo(0.18, 0.1); ctx.lineTo(0.55, 0.45); ctx.lineTo(0, 0.25); ctx.lineTo(-0.55, 0.45); ctx.lineTo(-0.18, 0.1); ctx.closePath(); ctx.fill();
          circle(0, -0.08, 0.1, '#ff3b5c');
          break;
        case 'bell':
          ctx.fillStyle = '#ffd23a';
          ctx.beginPath(); ctx.moveTo(-0.45, 0.35); ctx.quadraticCurveTo(-0.4, -0.5, 0, -0.5); ctx.quadraticCurveTo(0.4, -0.5, 0.45, 0.35); ctx.closePath(); ctx.fill();
          circle(0, 0.42, 0.12, '#ffffff'); circle(-0.15, -0.2, 0.06, '#fff7c8');
          break;
        case 'key':
          ctx.strokeStyle = '#7fe7ff'; ctx.lineWidth = 0.13;
          ctx.beginPath(); ctx.arc(0, -0.3, 0.22, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -0.08); ctx.lineTo(0, 0.55); ctx.moveTo(0, 0.3); ctx.lineTo(0.2, 0.3); ctx.moveTo(0, 0.48); ctx.lineTo(0.2, 0.48); ctx.stroke();
          break;
        case 'coin':
          circle(0, 0, 0.42, '#ffcf3a'); circle(0, 0, 0.3, '#ffe27a');
          ctx.fillStyle = '#c98a00'; ctx.fillRect(-0.05, -0.2, 0.1, 0.4);
          break;
      }
      ctx.restore();
    },
    power(ctx, type, x, y, s, t) {
      const def = PM.POWERUPS[type];
      s = s || 1;
      ctx.save();
      ctx.translate(x, y); ctx.scale(s, s);
      ctx.fillStyle = 'rgba(10,10,30,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, 0.55, 0, TAU); ctx.fill();
      ctx.lineWidth = 0.09; ctx.strokeStyle = def.color;
      ctx.beginPath(); ctx.arc(0, 0, 0.55, 0, TAU); ctx.stroke();
      ctx.fillStyle = def.color; ctx.strokeStyle = def.color; ctx.lineWidth = 0.1; ctx.lineCap = 'round';
      switch (type) {
        case 'turbo':
          ctx.beginPath(); ctx.moveTo(0.08, -0.38); ctx.lineTo(-0.2, 0.05); ctx.lineTo(0.02, 0.05); ctx.lineTo(-0.08, 0.38); ctx.lineTo(0.22, -0.06); ctx.lineTo(0, -0.06); ctx.closePath(); ctx.fill();
          break;
        case 'magnet':
          ctx.lineWidth = 0.14;
          ctx.beginPath(); ctx.arc(0, 0, 0.24, 0, PI); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-0.24, 0); ctx.lineTo(-0.24, -0.28); ctx.moveTo(0.24, 0); ctx.lineTo(0.24, -0.28); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.fillRect(-0.31, -0.36, 0.14, 0.1); ctx.fillRect(0.17, -0.36, 0.14, 0.1);
          break;
        case 'freeze':
          for (let i = 0; i < 3; i++) { const a = i * PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.34, Math.sin(a) * 0.34); ctx.lineTo(-Math.cos(a) * 0.34, -Math.sin(a) * 0.34); ctx.stroke(); }
          break;
        case 'shield':
          ctx.beginPath(); ctx.moveTo(0, -0.36); ctx.lineTo(0.3, -0.22); ctx.quadraticCurveTo(0.28, 0.2, 0, 0.38); ctx.quadraticCurveTo(-0.28, 0.2, -0.3, -0.22); ctx.closePath(); ctx.fill();
          break;
        case 'shock':
          for (const rr of [0.12, 0.24, 0.36]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); }
          break;
        case 'phase':
          ctx.globalAlpha *= 0.85;
          ctx.beginPath(); ctx.arc(0, -0.05, 0.27, PI, 0); ctx.lineTo(0.27, 0.3); ctx.lineTo(0.1, 0.2); ctx.lineTo(0, 0.3); ctx.lineTo(-0.1, 0.2); ctx.lineTo(-0.27, 0.3); ctx.closePath(); ctx.fill();
          break;
        case 'double':
          ctx.font = '800 0.42px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('2x', 0, 0.03);
          break;
      }
      ctx.restore();
    }
  };
  PM.Draw = Draw;

  /* ================= particles & floating text ================= */
  class FX {
    constructor() { this.parts = []; this.texts = []; this.rings = []; }
    clear() { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; }
    burst(x, y, color, n, speed, size, life) {
      for (let i = 0; i < n && this.parts.length < 900; i++) {
        const a = Math.random() * TAU, s = (0.3 + Math.random()) * (speed || 6);
        this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (life || 0.6) * (0.6 + Math.random() * 0.6), max: life || 0.6,
          color: typeof color === 'function' ? color() : color, size: (size || 0.14) * (0.6 + Math.random() * 0.8), shape: 'dot', drag: 3 });
      }
    }
    spawn(p) { if (this.parts.length < 900) this.parts.push(Object.assign({ vx: 0, vy: 0, drag: 2, shape: 'dot', size: 0.12, life: 0.5, max: 0.5 }, p)); }
    text(x, y, str, color, size, life) { this.texts.push({ x, y, str, color, size: size || 0.9, life: life || 1, max: life || 1 }); }
    ring(x, y, color, r, life) { this.rings.push({ x, y, color, r: r || 3, life: life || 0.5, max: life || 0.5 }); }
    update(dt) {
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; if (p.grav) p.vy += p.grav * dt; }
      this.parts = this.parts.filter(p => p.life > 0);
      for (const t of this.texts) { t.life -= dt; t.y -= dt * 0.8; }
      this.texts = this.texts.filter(t => t.life > 0);
      for (const r of this.rings) r.life -= dt;
      this.rings = this.rings.filter(r => r.life > 0);
    }
    draw(ctx) {
      for (const p of this.parts) {
        const a = Math.max(0, p.life / p.max);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.shape === 'square') ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        else if (p.shape === 'heart') {
          const s = p.size;
          ctx.beginPath(); ctx.moveTo(p.x, p.y + s); ctx.bezierCurveTo(p.x - s * 2, p.y - s * 0.4, p.x - s * 0.6, p.y - s * 1.6, p.x, p.y - s * 0.5);
          ctx.bezierCurveTo(p.x + s * 0.6, p.y - s * 1.6, p.x + s * 2, p.y - s * 0.4, p.x, p.y + s); ctx.fill();
        } else if (p.shape === 'star') {
          ctx.fillRect(p.x - p.size, p.y - p.size * 0.25, p.size * 2, p.size * 0.5);
          ctx.fillRect(p.x - p.size * 0.25, p.y - p.size, p.size * 0.5, p.size * 2);
        } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU); ctx.fill(); }
      }
      for (const r of this.rings) {
        const k = 1 - r.life / r.max;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = r.color; ctx.lineWidth = 0.15 * (1 - k) + 0.03;
        ctx.beginPath(); ctx.arc(r.x, r.y, 0.3 + r.r * k, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  PM.FX = FX;

  /* ================= the renderer ================= */
  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.T = 16; this.dpr = 1; this.S = 16;
      this.fx = new FX();
      this.mazeKey = '';
      this.time = 0;
      this.shake = 0;
      this.dark = null;
      this.stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 0.08 + 0.02, p: Math.random() * TAU }));
      this.showTargets = false;
      this.reduced = false;
    }
    resize(w, h) {
      const T = Math.max(6, Math.min(w / W, h / H));
      this.T = T;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.S = T * this.dpr;
      this.cv.style.width = Math.round(W * T) + 'px';
      this.cv.style.height = Math.round(H * T) + 'px';
      this.cv.width = Math.round(W * this.S);
      this.cv.height = Math.round(H * this.S);
      this.mazeKey = '';
    }

    /* walls: marching squares on tile centres, inset so corridors read wider (arcade look) */
    wallGeometry(maze) {
      const L = 0.82, fills = [], segs = [];
      const val = (x, y) => maze.type[PM.U.clamp(y, 0, H - 1) * W + PM.U.clamp(x, 0, W - 1)] === PM.TILE.WALL ? 1 : 0;
      const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      for (let j = -1; j < H; j++) {
        for (let i = -1; i < W; i++) {
          const v = [val(i, j), val(i + 1, j), val(i + 1, j + 1), val(i, j + 1)];
          const sum = v[0] + v[1] + v[2] + v[3];
          if (!sum) continue;
          const c = [[i + 0.5, j + 0.5], [i + 1.5, j + 0.5], [i + 1.5, j + 1.5], [i + 0.5, j + 1.5]];
          const poly = [], edge = [];
          for (let k = 0; k < 4; k++) {
            const n = (k + 1) % 4;
            if (v[k]) poly.push(c[k]);
            if (v[k] !== v[n]) { const p = v[k] ? lerp(c[n], c[k], L) : lerp(c[k], c[n], L); poly.push(p); edge.push(p); }
          }
          fills.push(poly);
          if (edge.length === 2) segs.push(edge);
          else if (edge.length === 4) {
            // saddle: keep the two wall corners connected
            if (v[0]) { segs.push([edge[0], edge[1]]); segs.push([edge[2], edge[3]]); }
            else { segs.push([edge[3], edge[0]]); segs.push([edge[1], edge[2]]); }
          }
        }
      }
      return { fills, segs };
    }
    buildMaze(game) {
      const th = PM.THEMES[game.theme] || PM.THEMES.retro;
      const key = game.maze.kind + game.maze.seed + game.theme + this.S;
      if (key === this.mazeKey) return;
      this.mazeKey = key;
      const geo = this.wallGeometry(game.maze);
      const make = (line, glowCol, fill) => {
        const c = document.createElement('canvas');
        c.width = this.cv.width; c.height = this.cv.height;
        const g = c.getContext('2d');
        g.scale(this.S, this.S);
        g.fillStyle = fill; g.strokeStyle = fill; g.lineWidth = 0.04;
        g.beginPath();
        for (const p of geo.fills) { g.moveTo(p[0][0], p[0][1]); for (let k = 1; k < p.length; k++) g.lineTo(p[k][0], p[k][1]); g.closePath(); }
        g.fill(); g.stroke();
        g.lineCap = 'round'; g.lineJoin = 'round';
        const path = new Path2D();
        for (const s of geo.segs) { path.moveTo(s[0][0], s[0][1]); path.lineTo(s[1][0], s[1][1]); }
        g.shadowColor = glowCol; g.shadowBlur = this.S * 0.55;
        g.strokeStyle = line; g.lineWidth = 0.16; g.stroke(path);
        g.shadowBlur = 0;
        g.globalAlpha = 0.65; g.strokeStyle = '#ffffff'; g.lineWidth = 0.045; g.stroke(path);
        g.globalAlpha = 1;
        // ghost house door
        g.fillStyle = th.door; g.fillRect(13, 12.4, 2, 0.2);
        return c;
      };
      this.mazeImg = make(th.wall, th.glow, th.fill);
      this.mazeFlash = make('#ffffff', '#ffffff', 'rgba(255,255,255,0.12)');
    }

    text(str, x, y, size, color, align) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = '800 ' + Math.round(size * this.S) + 'px ' + FONT;
      ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, this.S * 0.18); ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineJoin = 'round';
      ctx.strokeText(str, x * this.S + this.ox, y * this.S + this.oy);
      ctx.fillStyle = color;
      ctx.fillText(str, x * this.S + this.ox, y * this.S + this.oy);
      ctx.restore();
    }

    // effects that follow game events
    onEvent(e, game) {
      const fx = this.fx, P = game.pacs[e.pac] || game.player;
      const col = P ? Draw.pacColor(P.color, this.time) : '#ffe14d';
      switch (e.type) {
        case 'dot':
          if (e.kind === 2) { fx.ring(e.x, e.y, '#ffffff', 2.5, 0.45); fx.burst(e.x, e.y, '#ffffff', 14, 6, 0.12, 0.5); }
          else if (!this.reduced && Math.random() < (e.magnet ? 1 : 0.35)) fx.burst(e.x, e.y, (PM.THEMES[game.theme] || PM.THEMES.retro).dot, e.magnet ? 3 : 2, 2.5, 0.07, 0.3);
          break;
        case 'ghostEaten':
          fx.burst(e.x, e.y, PM.GHOSTS[e.ghost].color, 26, 8, 0.16, 0.7);
          fx.ring(e.x, e.y, '#4ef2ff', 3, 0.5);
          if (game.battle || e.shatter) fx.text(e.x, e.y - 0.6, String(e.pts), '#4ef2ff', 0.9, 1);
          this.shake = Math.max(this.shake, 0.18);
          break;
        case 'fruitEaten': fx.text(e.x, e.y, String(e.pts), '#ffb8ff', 0.85, 1.4); fx.burst(e.x, e.y, '#ff5ec8', 18, 5); break;
        case 'coin': fx.text(e.x, e.y - 0.5, '+100', '#ffcf3a', 0.7, 0.8); fx.burst(e.x, e.y, '#ffcf3a', 10, 4); break;
        case 'power': {
          const c = PM.POWERUPS[e.what].color;
          fx.ring(e.x, e.y, c, e.what === 'shock' ? 7 : 3, e.what === 'shock' ? 0.7 : 0.5);
          fx.burst(e.x, e.y, c, 24, 7, 0.14, 0.6);
          fx.text(e.x, e.y - 0.8, PM.POWERUPS[e.what].name.toUpperCase(), c, 0.7, 1.1);
          if (e.what === 'shock') this.shake = Math.max(this.shake, 0.35);
          break;
        }
        case 'shieldBlock': fx.ring(e.x, e.y, '#5dff9e', 3, 0.6); fx.burst(e.x, e.y, '#5dff9e', 20, 7); this.shake = Math.max(this.shake, 0.25); break;
        case 'death':
          this.shake = Math.max(this.shake, game.battle ? 0.25 : 0.4);
          if (game.battle) { fx.burst(e.x, e.y, col, 30, 8, 0.16, 0.8); }
          break;
        case 'rivalEaten': fx.text(e.x, e.y - 0.6, String(e.pts), '#ffe14d', 0.9, 1.2); fx.ring(e.x, e.y, '#ffe14d', 3, 0.5); break;
        case 'combo': fx.text(e.x, e.y - 1, 'COMBO x' + e.mult, '#ffd23a', 0.75, 1); break;
        case 'respawn': fx.ring(e.x, e.y, col, 2.5, 0.5); break;
        case 'levelClear': if (e.bonus) fx.text(14, 17.5, 'TIME BONUS ' + e.bonus, '#ffd23a', 0.8, 2.2); break;
        case 'extraLife': fx.text(P.x, P.y - 1, '1UP', '#5dff9e', 0.9, 1.4); break;
      }
    }

    trail(p, game, dt) {
      if (!p.alive || !p.moving || p.trail === 'none' || this.reduced) return;
      p._trailT = (p._trailT || 0) - dt;
      if (p._trailT > 0) return;
      p._trailT = 0.035;
      const bx = p.x - PM.DX[p.dir] * 0.6, by = p.y - PM.DY[p.dir] * 0.6;
      const j = () => (Math.random() - 0.5) * 0.5;
      switch (p.trail) {
        case 'sparkle': this.fx.spawn({ x: bx + j(), y: by + j(), color: Math.random() < 0.5 ? '#ffffff' : '#fff3a0', shape: 'star', size: 0.13, life: 0.45, max: 0.45 }); break;
        case 'hearts': this.fx.spawn({ x: bx + j(), y: by + j(), vy: -0.8, color: '#ff5ec8', shape: 'heart', size: 0.12, life: 0.6, max: 0.6 }); break;
        case 'fire': this.fx.spawn({ x: bx + j(), y: by + j(), vy: -1.6, color: Math.random() < 0.5 ? '#ff7a1a' : '#ffd23a', size: 0.2, life: 0.4, max: 0.4 }); break;
        case 'pixels': this.fx.spawn({ x: bx + j(), y: by + j(), color: Draw.pacColor(p.color, this.time), shape: 'square', size: 0.09, life: 0.5, max: 0.5 }); break;
        case 'rainbow': this.fx.spawn({ x: bx + j() * 0.4, y: by + j() * 0.4, color: rainbow(this.time * 2), size: 0.22, life: 0.5, max: 0.5 }); break;
      }
    }

    draw(game, dt, opt) {
      opt = opt || {};
      this.time += dt;
      const ctx = this.ctx, S = this.S, th = PM.THEMES[game.theme] || PM.THEMES.retro, t = this.time;
      this.buildMaze(game);
      this.fx.update(dt);
      for (const p of game.pacs) this.trail(p, game, dt);
      this.shake = Math.max(0, this.shake - dt);
      const sh = this.reduced ? 0 : this.shake;
      this.ox = sh ? (Math.random() - 0.5) * sh * S : 0;
      this.oy = sh ? (Math.random() - 0.5) * sh * S : 0;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, this.cv.height);
      bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      ctx.setTransform(S, 0, 0, S, this.ox, this.oy);
      if (th.stars) {
        for (const s of this.stars) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + s.p); ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x, s.y, s.s, s.s); }
        ctx.globalAlpha = 1;
      }

      const clearing = game.state === 'clear';
      const flash = clearing && game.clearT < 1.8 && Math.floor(game.clearT * 4) % 2 === 0;
      ctx.setTransform(1, 0, 0, 1, this.ox, this.oy);
      ctx.drawImage(flash ? this.mazeFlash : this.mazeImg, 0, 0);
      ctx.setTransform(S, 0, 0, S, this.ox, this.oy);

      // dots: one path for all of them
      ctx.fillStyle = th.dot;
      ctx.beginPath();
      const dots = game.dots;
      for (let i = 0; i < W * H; i++) {
        if (dots[i] !== 1) continue;
        const x = i % W + 0.5, y = ((i / W) | 0) + 0.5;
        ctx.moveTo(x + 0.12, y); ctx.arc(x, y, 0.12, 0, TAU);
      }
      ctx.fill();
      const blink = game.state !== 'play' || Math.floor(t * 4.5) % 2 === 0;
      for (let i = 0; i < W * H; i++) {
        if (dots[i] !== 2) continue;
        const x = i % W + 0.5, y = ((i / W) | 0) + 0.5;
        if (blink) {
          const gs = glow(th.dot, Math.round(S * 1.2));
          ctx.drawImage(gs, x - 1.2, y - 1.2, 2.4, 2.4);
          ctx.fillStyle = th.dot; ctx.beginPath(); ctx.arc(x, y, 0.36 + Math.sin(t * 6) * 0.03, 0, TAU); ctx.fill();
        }
      }

      // items
      const drawn = new Set();
      for (const i of game.maze.paths) {
        const it = game.items[i];
        if (!it || drawn.has(it)) continue;
        drawn.add(it);
        const bobY = Math.sin(t * 3 + it.x) * 0.08;
        if (it.kind === 'fruit') { ctx.drawImage(glow('#ff5ec8', Math.round(S)), it.x - 1, it.y - 1, 2, 2); Draw.fruit(ctx, it.type, it.x, it.y + bobY, 1.05); }
        else if (it.kind === 'coin') Draw.fruit(ctx, 'coin', it.x, it.y + bobY, 0.8 + Math.sin(t * 5 + it.x) * 0.05);
        else if (it.kind === 'power') {
          if (it.t < 3 && Math.floor(t * 6) % 2) continue;
          const c = PM.POWERUPS[it.type].color;
          ctx.drawImage(glow(c, Math.round(S * 1.4)), it.x - 1.4, it.y - 1.4, 2.8, 2.8);
          Draw.power(ctx, it.type, it.x, it.y + bobY, 1 + Math.sin(t * 4) * 0.05, t);
        }
      }

      const dying = game.state === 'dying';
      const hideGhosts = (dying && game.dieT < 1.9) || clearing || game.state === 'over';

      // ghosts
      if (!hideGhosts) {
        for (const g of game.ghosts) {
          if (g === game.hitGhost) continue;
          let mode = 'normal';
          if (g.state === 'eaten' || g.state === 'entering') mode = 'eyes';
          else if (game.freezeT > 0 && (g.state === 'active' || g.state === 'leaving')) mode = 'frozen';
          else if (g.fright > 0) mode = g.fright < game.flashDur && Math.floor(t * 6) % 2 ? 'flash' : 'fright';
          this.drawWrapped(g.x, () => {
            if (mode !== 'eyes') ctx.drawImage(glow(mode === 'normal' ? g.color : '#2b3cff', Math.round(S * 1.3)), g.x - 1.3, g.y - 1.3, 2.6, 2.6);
            Draw.ghost(ctx, { x: g.x, y: g.y, color: g.color, dir: g.dir, t, mode });
          });
          if (this.showTargets && g.target && g.state === 'active' && mode === 'normal') {
            ctx.strokeStyle = g.color; ctx.lineWidth = 0.08; ctx.globalAlpha = 0.8;
            const [tx, ty] = g.target;
            ctx.strokeRect(tx + 0.15, ty + 0.15, 0.7, 0.7);
            ctx.setLineDash([0.2, 0.2]); ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(tx + 0.5, ty + 0.5); ctx.stroke(); ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          }
        }
      }
      if (game.hitGhost && game.hitstop > 0) this.text(String(game.hitPts), game.hitGhost.x, game.hitGhost.y, 0.75, '#4ef2ff');

      // pacs
      for (const p of game.pacs) {
        if (!p.alive && !(dying && p === game.player)) {
          continue;
        }
        const pc = Draw.pacColor(p.color, t);
        this.drawWrapped(p.x, () => {
          if (!p.alive) {
            const f = PM.U.clamp((p.deadT - 0.7) / 1.3, 0, 1);
            if (f < 1) Draw.pac(ctx, { x: p.x, y: p.y, r: 0.8, color: p.color, death: f * 0.98 + 0.02, t });
            else if (!p._popped) { p._popped = true; this.fx.burst(p.x, p.y, pc, 24, 5, 0.12, 0.6); }
            return;
          }
          p._popped = false;
          const blinkInv = p.invuln > 0 && Math.floor(t * 10) % 2;
          ctx.drawImage(glow(pc === '#1b1b2e' ? '#7b5cff' : pc, Math.round(S * 1.3)), p.x - 1.3, p.y - 1.3, 2.6, 2.6);
          if (p.power > 0) { ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 12); ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(p.x, p.y, 1.05, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
          if (p.magnet > 0) { ctx.strokeStyle = '#ff5a7a'; ctx.globalAlpha = 0.25; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4 + Math.sin(t * 8) * 0.1, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
          if (p.turbo > 0 && p.moving) {
            ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 0.06; ctx.globalAlpha = 0.7;
            for (let k = -1; k <= 1; k++) {
              const px = -PM.DX[p.dir], py = -PM.DY[p.dir], ox = PM.DY[p.dir] * k * 0.35, oy = PM.DX[p.dir] * k * 0.35;
              ctx.beginPath(); ctx.moveTo(p.x + px * 0.9 + ox, p.y + py * 0.9 + oy); ctx.lineTo(p.x + px * (1.5 + Math.random() * 0.4) + ox, p.y + py * (1.5 + Math.random() * 0.4) + oy); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
          const ready = game.state === 'ready';
          Draw.pac(ctx, {
            x: p.x, y: p.y, r: 0.8, dir: p.dir, color: p.color, hat: p.hat, t,
            mouth: ready ? 0.15 : p.moving ? Math.abs(Math.sin(p.mouth * 2.4)) : 0.35,
            alpha: p.phase > 0 ? 0.45 : blinkInv ? 0.35 : 1
          });
          if (p.shield > 0) {
            ctx.strokeStyle = '#5dff9e'; ctx.lineWidth = 0.08; ctx.globalAlpha = p.shield < 3 && Math.floor(t * 8) % 2 ? 0.25 : 0.75;
            ctx.beginPath(); ctx.arc(p.x, p.y, 1.0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
          }
        });
        if (game.battle && p.alive) this.text(p.isPlayer ? 'YOU' : p.name, p.x, p.y - 1.45, 0.42, p.isPlayer ? '#ffffff' : pc);
        if (p.emote && p.alive) this.text(p.emote, p.x + 0.9, p.y - 1.1, 0.7, '#ffffff');
      }

      this.fx.draw(ctx);

      // blackout event: only a small light around each pac (ghost eyes still glow)
      if (game.event === 'blackout' && !clearing && game.state !== 'over') this.drawDarkness(game);

      // arcade messages
      if (game.state === 'ready') {
        if (game.level === 1 && game.readyT > 2.2 && !game.battle) this.text('PLAYER ONE', 14, 11.5, 0.85, '#4ef2ff');
        this.text(game.battle ? 'GET READY!' : 'READY!', 14, 17.5, 0.9, th.accent);
      }
      if (game.state === 'over' && !game.battle) this.text('GAME  OVER', 14, 17.5, 0.9, '#ff3b5c');
      if (opt.paused) this.text('PAUSED', 14, 17.5, 1, '#ffffff');
    }

    drawWrapped(x, fn) {
      fn();
      if (x < 1.5) { this.ctx.save(); this.ctx.translate(W, 0); fn(); this.ctx.restore(); }
      else if (x > W - 1.5) { this.ctx.save(); this.ctx.translate(-W, 0); fn(); this.ctx.restore(); }
    }

    drawDarkness(game) {
      const ctx = this.ctx, S = this.S;
      if (!this.dark || this.dark.width !== this.cv.width || this.dark.height !== this.cv.height) {
        this.dark = document.createElement('canvas');
        this.dark.width = this.cv.width; this.dark.height = this.cv.height;
      }
      const d = this.dark.getContext('2d');
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, this.dark.width, this.dark.height);
      d.fillStyle = 'rgba(2,2,8,0.95)';
      d.fillRect(0, 0, this.dark.width, this.dark.height);
      d.globalCompositeOperation = 'destination-out';
      for (const p of game.pacs) {
        if (!p.alive) continue;
        const r = 4.6 * S, x = p.x * S, y = p.y * S;
        const g = d.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
      }
      ctx.setTransform(1, 0, 0, 1, this.ox, this.oy);
      ctx.drawImage(this.dark, 0, 0);
      ctx.setTransform(S, 0, 0, S, this.ox, this.oy);
      for (const g of game.ghosts) {
        if (g.state === 'house') continue;
        for (const s of [-1, 1]) {
          ctx.fillStyle = g.fright > 0 ? '#ffd8b8' : '#ffffff';
          ctx.beginPath(); ctx.arc(g.x + s * 0.3, g.y - 0.27, 0.13, 0, TAU); ctx.fill();
        }
      }
    }

    // small images for the DOM HUD
    icon(kind, type, px) {
      this.icons = this.icons || new Map();
      const key = kind + type + px;
      if (this.icons.has(key)) return this.icons.get(key);
      const c = document.createElement('canvas');
      c.width = c.height = px;
      const g = c.getContext('2d');
      g.scale(px / 2, px / 2);
      if (kind === 'fruit') Draw.fruit(g, type, 1, 1, 1.2);
      else if (kind === 'power') Draw.power(g, type, 1, 1, 1.5, 0);
      else if (kind === 'pac') Draw.pac(g, { x: 1, y: 1, r: 0.85, dir: 1, color: type, mouth: 0.6 });
      const url = c.toDataURL();
      this.icons.set(key, url);
      return url;
    }
  }
  PM.Renderer = Renderer;
})(window.PM = window.PM || {});
