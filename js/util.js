/* PAC-MAN 2027* — shared helpers */
(function (PM) {
  'use strict';

  // directions: 0 up, 1 left, 2 down, 3 right (the arcade tie-break order)
  PM.DX = [0, -1, 0, 1];
  PM.DY = [-1, 0, 1, 0];
  PM.OPP = [2, 3, 0, 1];
  PM.W = 28;
  PM.H = 31;
  PM.TPS = 9.47; // tiles per second at "100%" arcade speed

  PM.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    dist2: (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by),
    // horizontal distance across the wrap-around tunnel
    wrapDx(ax, bx) { let d = ax - bx; if (d > PM.W / 2) d -= PM.W; else if (d < -PM.W / 2) d += PM.W; return d; },
    fmt: n => Math.floor(n).toLocaleString('en-US'),
    esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  };

  // xorshift32: small, fast, seedable (daily challenge must be identical for everyone)
  PM.rng = function (seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    r.int = n => Math.floor(r() * n);
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.range = (a, b) => a + r() * (b - a);
    return r;
  };
  PM.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  PM.dateKey = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  PM.shuffle = function (arr, r) {
    r = r || Math.random;
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };
})(window.PM = window.PM || {});
