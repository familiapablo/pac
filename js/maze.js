/* PAC-MAN 2027* — mazes: the arcade layout, a procedural generator and fast BFS */
(function (PM) {
  'use strict';
  const W = PM.W, H = PM.H, DX = PM.DX, DY = PM.DY;
  const PATH = 0, WALL = 1, DOOR = 2, HOUSE = 3;
  PM.TILE = { PATH, WALL, DOOR, HOUSE };

  // 28 x 31, '.' dot, 'o' energizer, ' ' empty path, '-' ghost door
  const CLASSIC = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.##### ## #####.######',
    '######.##### ## #####.######',
    '######.##          ##.######',
    '######.## ###--### ##.######',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '######.## ######## ##.######',
    '######.##          ##.######',
    '######.## ######## ##.######',
    '######.## ######## ##.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################'
  ];

  const QUEUE = new Int16Array(W * H);
  const wrapX = x => ((x % W) + W) % W;

  class Maze {
    constructor(rows, kind, seed) {
      this.rows = rows;
      this.kind = kind;
      this.seed = seed || 0;
      this.type = new Uint8Array(W * H);
      this.dots0 = new Uint8Array(W * H);
      this.tunnel = new Uint8Array(W * H);
      this.redZone = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = rows[y][x], i = y * W + x;
          this.type[i] = c === '#' ? WALL : c === '-' ? DOOR : PATH;
          if (c === '.') this.dots0[i] = 1;
          else if (c === 'o') this.dots0[i] = 2;
        }
      }
      for (let y = 13; y <= 15; y++) for (let x = 11; x <= 16; x++) this.type[y * W + x] = HOUSE;
      for (let x = 0; x < W; x++) if ((x <= 5 || x >= 22) && this.type[14 * W + x] === PATH) this.tunnel[14 * W + x] = 1;
      if (kind === 'classic') for (const [x, y] of [[12, 11], [15, 11], [12, 23], [15, 23]]) this.redZone[y * W + x] = 1;
      // walkable graph (ghost door and house are handled by the ghost-house logic, not the graph)
      this.adj = new Int16Array(W * H * 4).fill(-1);
      this.paths = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (this.type[i] !== PATH) continue;
          this.paths.push(i);
          for (let d = 0; d < 4; d++) {
            const ny = y + DY[d], nx = wrapX(x + DX[d]);
            if (ny < 0 || ny >= H) continue;
            const j = ny * W + nx;
            if (this.type[j] === PATH) this.adj[i * 4 + d] = j;
          }
        }
      }
      this.dotTotal = 0;
      for (let i = 0; i < W * H; i++) if (this.dots0[i]) this.dotTotal++;
    }
    idx(x, y) { return y * W + wrapX(x); }
    tileAt(px, py) { return PM.U.clamp(Math.floor(py), 0, H - 1) * W + wrapX(Math.floor(px)); }
    isPath(x, y) { return y >= 0 && y < H && this.type[y * W + wrapX(x)] === PATH; }
    degree(i) { let n = 0; for (let d = 0; d < 4; d++) if (this.adj[i * 4 + d] >= 0) n++; return n; }
    nearestPath(x, y, filter) {
      let best = -1, bd = 1e9;
      for (const i of this.paths) {
        if (filter && !filter(i)) continue;
        const d = PM.U.dist2(i % W, (i / W) | 0, x, y);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    /* breadth-first distances in tiles; `blocked` is a tile the search may not enter */
    bfs(start, out, blocked, maxDepth) {
      out.fill(-1);
      if (start < 0) return out;
      maxDepth = maxDepth === undefined ? 9999 : maxDepth;
      let h = 0, t = 0;
      QUEUE[t++] = start; out[start] = 0;
      const adj = this.adj;
      while (h < t) {
        const u = QUEUE[h++], du = out[u];
        if (du >= maxDepth) continue;
        for (let d = 0; d < 4; d++) {
          const v = adj[u * 4 + d];
          if (v < 0 || v === blocked || out[v] >= 0) continue;
          out[v] = du + 1; QUEUE[t++] = v;
        }
      }
      return out;
    }
    /* distance from the nearest of many sources (e.g. "how far is the closest dot") */
    multiBfs(sources, out) {
      out.fill(-1);
      let h = 0, t = 0;
      for (const s of sources) if (out[s] < 0) { out[s] = 0; QUEUE[t++] = s; }
      const adj = this.adj;
      while (h < t) {
        const u = QUEUE[h++], du = out[u];
        for (let d = 0; d < 4; d++) {
          const v = adj[u * 4 + d];
          if (v < 0 || out[v] >= 0) continue;
          out[v] = du + 1; QUEUE[t++] = v;
        }
      }
      return out;
    }
  }
  PM.Maze = Maze;
  PM.Maze.classic = () => new Maze(CLASSIC, 'classic', 0);

  /* ================= procedural mazes =================
     Corridors live on the arcade's own grid lines (columns 1,6,9,12 mirrored,
     rows 1,5,8,...,29), so every maze keeps the classic proportions, ghost house,
     tunnel and start positions. The edge set is mirrored, dead ends are removed and
     the graph is made fully connected, so ghosts (which never reverse) can't get stuck. */
  const COLS = [1, 6, 9, 12, 15, 18, 21, 26];
  const ROWS = [1, 5, 8, 11, 14, 17, 20, 23, 26, 29];
  const NC = COLS.length, NR = ROWS.length;
  const hId = (r, c) => 'h' + r + ',' + c; // (c,r)-(c+1,r)
  const vId = (r, c) => 'v' + r + ',' + c; // (c,r)-(c,r+1)
  const hMirror = c => NC - 2 - c;
  const vMirror = c => NC - 1 - c;
  const FORBID = new Set([hId(4, 2), hId(4, 3), hId(4, 4), vId(3, 3), vId(4, 3), vId(3, 4), vId(4, 4)]);
  const FORCED = [hId(3, 2), hId(3, 3), hId(3, 4), hId(5, 2), hId(5, 3), hId(5, 4), hId(4, 0), hId(4, 1), hId(4, 5), hId(4, 6),
    hId(7, 3), vId(3, 2), vId(4, 2), vId(3, 5), vId(4, 5)];

  function edgesOfNode(c, r) {
    const out = [];
    if (c > 0) out.push(hId(r, c - 1));
    if (c < NC - 1) out.push(hId(r, c));
    if (r > 0) out.push(vId(r - 1, c));
    if (r < NR - 1) out.push(vId(r, c));
    return out.filter(e => !FORBID.has(e));
  }
  function mirrorOf(e) {
    const [r, c] = e.slice(1).split(',').map(Number);
    return e[0] === 'h' ? hId(r, hMirror(c)) : vId(r, vMirror(c));
  }
  function ends(e) {
    const [r, c] = e.slice(1).split(',').map(Number);
    return e[0] === 'h' ? [[c, r], [c + 1, r]] : [[c, r], [c, r + 1]];
  }

  function buildEdges(rng) {
    const E = new Set(FORCED);
    const add = e => { E.add(e); E.add(mirrorOf(e)); };
    const del = e => { if (FORCED.includes(e)) return; E.delete(e); E.delete(mirrorOf(e)); };
    const p = 0.46 + rng() * 0.2;
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c <= 3; c++) {
        const h = hId(r, c), v = vId(r, c);
        if (c <= 3 && !FORBID.has(h) && rng() < p) add(h);
        if (r < NR - 1 && !FORBID.has(v) && rng() < p) add(v);
      }
    }
    const degree = (c, r) => {
      let d = edgesOfNode(c, r).filter(e => E.has(e)).length;
      if (r === 4 && (c === 0 || c === NC - 1)) d++; // tunnel wrap
      return d;
    };
    for (let round = 0; round < 12; round++) {
      // 1) no dead ends
      for (let it = 0; it < 300; it++) {
        let changed = false;
        for (let r = 0; r < NR; r++) {
          for (let c = 0; c < NC; c++) {
            if (degree(c, r) !== 1) continue;
            const cands = edgesOfNode(c, r).filter(e => !E.has(e));
            const own = edgesOfNode(c, r).find(e => E.has(e));
            if (cands.length && (rng() < 0.7 || FORCED.includes(own))) add(cands[Math.floor(rng() * cands.length)]);
            else if (own) del(own);
            changed = true;
          }
        }
        if (!changed) break;
      }
      // 2) everything connected to the start node (col 12/15 on row 23)
      const seen = new Set(['3,7']), stack = [[3, 7]];
      while (stack.length) {
        const [c, r] = stack.pop();
        for (const e of edgesOfNode(c, r)) {
          if (!E.has(e)) continue;
          for (const [a, b] of ends(e)) { const k = a + ',' + b; if (!seen.has(k)) { seen.add(k); stack.push([a, b]); } }
        }
        if (r === 4 && (c === 0 || c === NC - 1)) { const k = (NC - 1 - c) + ',4'; if (!seen.has(k)) { seen.add(k); stack.push([NC - 1 - c, 4]); } }
      }
      const lonely = [];
      for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) if (degree(c, r) > 0 && !seen.has(c + ',' + r)) lonely.push([c, r]);
      if (!lonely.length) return E;
      let linked = false;
      for (const [c, r] of PM.shuffle(lonely, rng)) {
        const bridge = edgesOfNode(c, r).find(e => !E.has(e) && ends(e).some(([a, b]) => seen.has(a + ',' + b)));
        if (bridge) { add(bridge); linked = true; break; }
      }
      if (!linked) for (const [c, r] of lonely) for (const e of edgesOfNode(c, r)) del(e);
    }
    return null;
  }

  PM.Maze.generate = function (seed) {
    const rng = PM.rng(seed);
    for (let attempt = 0; attempt < 40; attempt++) {
      const E = buildEdges(rng);
      if (!E) continue;
      const g = Array.from({ length: H }, () => Array(W).fill('#'));
      for (const e of E) {
        const [[c1, r1], [c2, r2]] = ends(e);
        for (let y = ROWS[r1]; y <= ROWS[r2]; y++) for (let x = COLS[c1]; x <= COLS[c2]; x++) g[y][x] = ' ';
      }
      g[14][0] = ' '; g[14][W - 1] = ' ';
      const house = ['###--###', '#      #', '#      #', '#      #', '########'];
      for (let k = 0; k < 5; k++) for (let x = 0; x < 8; x++) g[12 + k][10 + x] = house[k][x];
      // dots everywhere except the ghost-house area, the tunnel and the start spot
      let dots = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (g[y][x] !== ' ') continue;
          const nearHouse = y >= 9 && y <= 19 && x >= 7 && x <= 20;
          const tunnel = y === 14 && (x <= 5 || x >= 22);
          const start = y === 23 && (x === 13 || x === 14);
          if (!nearHouse && !tunnel && !start) { g[y][x] = '.'; dots++; }
        }
      }
      if (dots < 170 || dots > 290) continue;
      // energizers near the four corners (mirrored)
      const near = (tx, ty) => {
        let best = null, bd = 1e9;
        for (let y = 0; y < H; y++) for (let x = 0; x <= 13; x++) {
          if (g[y][x] !== '.') continue;
          const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
          if (d < bd) { bd = d; best = [x, y]; }
        }
        return best;
      };
      const e1 = near(1, 3); if (e1) { g[e1[1]][e1[0]] = 'o'; g[e1[1]][W - 1 - e1[0]] = 'o'; }
      const e2 = near(1, 23); if (e2) { g[e2[1]][e2[0]] = 'o'; g[e2[1]][W - 1 - e2[0]] = 'o'; }
      return new Maze(g.map(r => r.join('')), 'generated', seed);
    }
    return PM.Maze.classic();
  };
})(window.PM = window.PM || {});
