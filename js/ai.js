/* PAC-MAN 2027* — ghost brains and the humanlike Pac-Man bot */
(function (PM) {
  'use strict';
  const W = PM.W, H = PM.H, DX = PM.DX, DY = PM.DY, OPP = PM.OPP;
  const DOOR_TILE = 11 * W + 13;
  const N = W * H;

  /* ---------- ghosts: the four arcade personalities ---------- */
  PM.ghostTarget = function (game, g) {
    if (g.state === 'eaten') return [13, 11];
    const elroyChase = g.id === 0 && g.elroy > 0;
    if (game.isScatter() && !elroyChase) return g.corner;
    const p = game.targetPacFor(g);
    const px = Math.floor(p.x), py = Math.floor(p.y), d = p.dir;
    const bug = game.maze.kind === 'classic'; // the arcade's famous "up" overflow
    switch (g.id) {
      case 0: return [px, py]; // Blinky: straight at you
      case 1: { // Pinky: four tiles ahead
        let tx = px + 4 * DX[d]; const ty = py + 4 * DY[d];
        if (bug && d === 0) tx -= 4;
        return [tx, ty];
      }
      case 2: { // Inky: mirror of Blinky through two tiles ahead of you
        let vx = px + 2 * DX[d]; const vy = py + 2 * DY[d];
        if (bug && d === 0) vx -= 2;
        const b = game.ghosts[0];
        return [2 * vx - Math.floor(b.x), 2 * vy - Math.floor(b.y)];
      }
      default: { // Clyde: chases until he gets close, then runs home
        const dd = PM.U.dist2(Math.floor(g.x), Math.floor(g.y), px, py);
        return dd > 64 ? [px, py] : g.corner;
      }
    }
  };

  const FIELD = new Int16Array(W * H);
  PM.ghostChoose = function (game, g, tile) {
    const m = game.maze;
    const opts = [];
    for (let d = 0; d < 4; d++) {
      if (d === OPP[g.dir]) continue;
      const n = m.adj[tile * 4 + d];
      if (n < 0) continue;
      if (d === 0 && m.redZone[tile] && g.fright <= 0 && g.state === 'active') continue;
      opts.push(d, n);
    }
    if (!opts.length) return OPP[g.dir];
    if (g.fright > 0 && g.state === 'active') return opts[2 * game.rng.int(opts.length / 2)];
    if (g.state === 'eaten') { // eyes always know the way home
      const f = game.homeField;
      let best = opts[0], bd = 1e9;
      for (let i = 0; i < opts.length; i += 2) { const v = f[opts[i + 1]]; if (v >= 0 && v < bd) { bd = v; best = opts[i]; } }
      return best;
    }
    const t = PM.ghostTarget(game, g);
    g.target = t;
    if (game.smart) { // Insane: real shortest paths instead of straight-line guesses
      const tx = PM.U.clamp(t[0], 0, W - 1), ty = PM.U.clamp(t[1], 0, H - 1);
      let goal = m.type[ty * W + tx] === PM.TILE.PATH ? ty * W + tx : m.nearestPath(tx, ty);
      m.bfs(goal, FIELD);
      let best = opts[0], bd = 1e9;
      for (let i = 0; i < opts.length; i += 2) { const v = FIELD[opts[i + 1]]; if (v >= 0 && v < bd) { bd = v; best = opts[i]; } }
      return best;
    }
    let best = opts[0], bd = Infinity;
    for (let i = 0; i < opts.length; i += 2) {
      const n = opts[i + 1];
      const dd = PM.U.dist2(n % W, (n / W) | 0, t[0], t[1]);
      if (dd < bd) { bd = dd; best = opts[i]; }
    }
    return best;
  };
  PM.DOOR_TILE = DOOR_TILE;

  /* ---------- the bot: plays like a person, not a solver ----------
     At every junction it scores each way it could go: dots and items it would
     reach soon (worth less the further they are), minus places a ghost would
     reach first. Skill sets how far it looks, how often it slips and how fast it
     reacts; personality sets what it cares about. */
  class Brain {
    constructor(skill, personality, rng) {
      this.skill = PM.BOT_SKILL[skill] || PM.BOT_SKILL.normal;
      this.pers = PM.PERSONALITIES[personality] || PM.PERSONALITIES.greedy;
      this.persId = personality;
      this.rng = rng || Math.random;
      this.buf = new Int16Array(W * H);
      this.minG = new Int16Array(W * H);
      this.q = new Int16Array(W * H);
      this.gpow = new Float32Array(64);
      for (let k = 0; k < 64; k++) this.gpow[k] = Math.pow(this.pers.gamma, k);
      this.t = 0;
      this.scaredT = 0;
      // rehearsal scratch space
      this.simRng = PM.rng(0x2545f491);
      this.simPac = { id: 99, x: 0, y: 0, dir: 1, nextDir: 1, moving: true, alive: true, brain: null };
      this.simPacs = [this.simPac];
      this.simGhosts = [0, 1, 2, 3].map(() => ({}));
      this.seen = new Int32Array(W * H);
      this.stamp = 0;
      const self = this;
      this.follower = { // drives the imagined pac: plan first, then the obvious way
        plan: null, i: 0,
        decide(sh, p) {
          const m = sh.maze, t = m.tileAt(p.x, p.y);
          if (this.i === 0) { this.i = 1; return this.plan[0]; }
          let exits = 0;
          for (let e = 0; e < 4; e++) if (e !== OPP[p.dir] && m.adj[t * 4 + e] >= 0) exits++;
          if (exits > 1 && this.i < this.plan.length) { const d = this.plan[this.i++]; if (m.adj[t * 4 + d] >= 0) return d; }
          if (m.adj[t * 4 + p.dir] >= 0) return p.dir;
          let best = p.dir, bd = -1;
          for (let e = 0; e < 4; e++) {
            const n = m.adj[t * 4 + e];
            if (e === OPP[p.dir] || n < 0) continue;
            if (self.minG[n] > bd) { bd = self.minG[n]; best = e; }
          }
          return best;
        }
      };
      this.simPac.brain = this.follower;
    }

    /* follow a corridor from `from` going `dir` until the next junction.
       slack = how many tiles ahead of the nearest ghost we stay along the way */
    walk(m, from, dir, k0, minG, r, dots) {
      let t = from, d = dir, k = k0, slack = 999;
      for (let steps = 0; steps < 40; steps++) {
        const nx = m.adj[t * 4 + d];
        if (nx < 0) break;
        t = nx; k++;
        const sl = minG[t] - k * r;
        if (sl < slack) slack = sl;
        if (dots && dots[t] === 2 && slack > 0) return { tile: t, dir: d, k, slack: 40 }; // an energizer turns the tables
        // count exits other than the way back
        let exits = 0, only = -1;
        for (let e = 0; e < 4; e++) if (e !== OPP[d] && m.adj[t * 4 + e] >= 0) { exits++; only = e; }
        if (exits !== 1) break; // junction (or wrap-around end)
        d = only;
      }
      return { tile: t, dir: d, k, slack };
    }
    /* ---- mental rehearsal ----
       Replays the ghosts' real rules (they are deterministic) for a moment along one
       route plan: [first direction, turn at the next junction]. Returns what happens. */
    rehearse(game, pac, plan, horizon) {
      const sh = this.shadow || (this.shadow = Object.create(PM.Game.prototype));
      sh.maze = game.maze; sh.smart = false; sh.homeField = game.homeField; sh.spec = game.spec; sh.diff = game.diff;
      sh.director = game.director; sh.event = game.event; sh.phaseIdx = game.phaseIdx; sh.freezeT = 0; sh.rng = this.simRng;
      const sp = this.simPac;
      sp.x = pac.x; sp.y = pac.y; sp.dir = plan[0]; sp.nextDir = plan[0]; sp.moving = true; sp.alive = true;
      this.follower.plan = plan; this.follower.i = 0;
      sh.pacs = this.simPacs;
      const gs = this.simGhosts;
      sh.ghosts = gs;
      for (let i = 0; i < 4; i++) {
        const g = game.ghosts[i], c = gs[i];
        c.id = g.id; c.corner = g.corner; c.x = g.x; c.y = g.y; c.dir = g.dir; c.state = g.state; c.fright = g.fright;
        c.elroy = g.elroy; c.moving = g.moving; c.reverse = false; c.target = null;
        if (c.state === 'leaving') { c.state = 'active'; c.x = 14; c.y = 11.5; c.dir = 1; c.moving = true; }
      }
      const m = game.maze, dt = 1 / 30, steps = Math.round(horizon / dt);
      const pSp = PM.TPS * (game.frightT > 0 ? game.spec.pacFright : game.spec.pac) * (pac.turbo > 0 ? 1.35 : 1);
      const stamp = ++this.stamp;
      let stall = 0, dots = 0, prey = 0;
      for (let s = 1; s <= steps; s++) {
        const now = s * dt;
        if (stall > 0) stall -= dt;
        else {
          sh.move(sp, pSp * dt, true);
          const t = m.tileAt(sp.x, sp.y);
          if (this.seen[t] !== stamp) {
            this.seen[t] = stamp;
            const dv = game.dots[t];
            if (dv === 2) return { dead: false, t: now, dots, prey, energ: true, safe: 8 };
            if (dv === 1) { dots++; stall = 1 / 60; }
            if (game.items[t]) dots += 3;
          }
        }
        const frozen = game.freezeT > now;
        for (const c of gs) {
          if (c.state !== 'active') continue;
          if (!frozen) { if (c.fright > 0) c.fright = Math.max(0, c.fright - dt); sh.move(c, sh.ghostSpeed(c) * dt, false); }
          const dx = PM.U.wrapDx(c.x, sp.x), dy = c.y - sp.y;
          if (dx * dx + dy * dy < 0.6) {
            if (c.fright > 0 || frozen || pac.phase > now) { if (pac.phase <= now) { prey++; c.state = 'eaten'; } }
            else return { dead: true, t: now, dots, prey };
          }
        }
      }
      let md = 99;
      for (const c of gs) if (c.state === 'active' && c.fright <= 0) md = Math.min(md, Math.abs(PM.U.wrapDx(c.x, sp.x)) + Math.abs(c.y - sp.y));
      return { dead: false, t: horizon, dots, prey, energ: false, safe: Math.min(md, 8) };
    }

    decide(game, pac) {
      const m = game.maze, here = m.tileAt(pac.x, pac.y);
      const sk = this.skill, ps = this.pers;
      const threats = pac.phase > 0 ? [] : game.threatsFor(pac);
      const preys = game.preysFor(pac);
      const dotField = game.getDotField();
      // earliest time any threat can reach each tile
      const minG = this.minG.fill(999);
      for (const th of threats) {
        const f = th.field;
        for (let t = 0; t < N; t++) { const v = f[t]; if (v >= 0 && v < minG[t]) minG[t] = v; }
      }
      const margin = pac.shield > 0 ? -1 : sk.margin + (ps.danger > 1.2 ? 0.5 : 0);
      const r = game.threatRatio(pac);
      const minThreat = minG[here];
      const energ = minThreat < 8 ? 30 * ps.hunt : ps.hunt > 1.4 && minThreat < 14 ? 6 : 0.6;
      const dw = sk.danger * ps.danger;
      // when a ghost is within reach, imagine the next moments along every route
      const look = threats.length > 0 && minThreat < 13;
      const ahead = [-1e9, -1e9, -1e9, -1e9];
      if (look) {
        for (let d = 0; d < 4; d++) {
          if (m.adj[here * 4 + d] < 0) continue;
          const a = this.walk(m, here, d, 0, minG, 1, null);
          const plans = [];
          if (a.k <= 12) for (let e = 0; e < 4; e++) if (e !== OPP[a.dir] && m.adj[a.tile * 4 + e] >= 0) plans.push([d, e]);
          if (!plans.length) plans.push([d]);
          for (const pl of plans) {
            const res = this.rehearse(game, pac, pl, sk.horizon);
            const sc = res.dead ? -2000 + 500 * res.t
              : res.dots * ps.dot * 1.5 + res.prey * 25 * ps.hunt + (res.energ ? 20 * ps.hunt + (minThreat < 8 ? 25 : 0) : 0) + res.safe * 4 * dw;
            if (sc > ahead[d]) ahead[d] = sc;
          }
        }
      }
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const n = m.adj[here * 4 + d];
        if (n < 0) continue;
        let v = 0;
        // dots and items along the way, ignoring tiles a ghost gets to first
        const dist = this.buf.fill(-1);
        let h = 0, tl = 0;
        this.q[tl++] = n; dist[n] = 1;
        while (h < tl) {
          const u = this.q[h++], du = dist[u];
          if (du * r < minG[u] - margin) {
            const w = this.gpow[du - 1];
            const dot = game.dots[u];
            if (dot === 1) v += ps.dot * w; else if (dot === 2) v += energ * w;
            const it = game.items[u];
            if (it) v += (it.kind === 'fruit' ? 14 : it.kind === 'power' ? 9 * ps.pow : 5) * w;
          }
          if (du >= sk.depth) continue;
          for (let e = 0; e < 4; e++) {
            const x = m.adj[u * 4 + e];
            if (x < 0 || x === here || dist[x] >= 0) continue;
            dist[x] = du + 1; this.q[tl++] = x;
          }
        }
        const df = dotField[n];
        if (df >= 0) v += 6 / (1 + df);
        if (look) v += ahead[d];
        else if (threats.length && this.walk(m, here, d, 0, minG, r, null).slack < margin) v -= 150 * dw; // the corridor is being cut off
        for (const pr of preys) {
          const k = dist[pr.tile];
          if (k >= 0 && pr.time * 7 > k) v += pr.value * this.gpow[Math.min(63, k)];
        }
        if (d === pac.dir) v += 1.5; else if (d === OPP[pac.dir]) v -= 3;
        if (minG[n] <= 1) v -= 500;
        opts.push([d, v]);
      }
      if (!opts.length) return pac.dir;
      opts.sort((a, b) => b[1] - a[1]);
      this.last = opts;
      if (opts.length > 1 && opts[1][1] > opts[0][1] - 40 && this.rng() < sk.mistake) return opts[1][0];
      if (minThreat <= 4 && this.scaredT <= 0) { game.emote(pac, 'scared'); this.scaredT = 4; }
      return opts[0][0];
    }

    // between junctions: turn around if a ghost is coming straight at us
    tick(game, pac, dt) {
      this.scaredT -= dt;
      this.t += dt;
      if (this.t < this.skill.react || pac.phase > 0) return;
      this.t = 0;
      const m = game.maze, here = m.tileAt(pac.x, pac.y);
      const ahead = m.adj[here * 4 + pac.dir];
      if (ahead < 0) return;
      for (const th of game.threatsFor(pac)) {
        const fh = th.field[here], fa = th.field[ahead];
        if (fh >= 0 && fh <= 3 && fa >= 0 && fa < fh) {
          const back = m.adj[here * 4 + OPP[pac.dir]];
          if (back >= 0 && !(th.field[back] >= 0 && th.field[back] <= 1)) game.setDir(pac, OPP[pac.dir]);
          return;
        }
      }
    }
  }
  PM.Brain = Brain;
})(window.PM = window.PM || {});
