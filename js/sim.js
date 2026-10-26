/* PAC-MAN 2027* — game simulation (no DOM). Fixed 60 Hz steps.
   Positions are in tiles; a tile's centre is at (i + 0.5, j + 0.5). */
(function (PM) {
  'use strict';
  const W = PM.W, H = PM.H, DX = PM.DX, DY = PM.DY, OPP = PM.OPP, U = PM.U;
  const START = [14, 23.5], DOOR = [14, 11.5], HOUSE_Y = 14.5;
  const FRUIT_TILES = [17 * W + 13, 17 * W + 14];

  class Pac {
    constructor(o) {
      Object.assign(this, {
        id: 0, name: 'YOU', isPlayer: false, color: '#ffe14d', hat: 'none', trail: 'none', brain: null,
        x: START[0], y: START[1], dir: 1, nextDir: 1, moving: true, score: 0, alive: true, spawn: START.slice(),
        respawnT: 0, invuln: 0, stall: 0, power: 0, turbo: 0, magnet: 0, shield: 0, phase: 0, dbl: 0,
        combo: 0, comboT: 0, bestCombo: 0, chain: 0, mouth: 0, emote: '', emoteT: 0, deadT: 0, coins: 0,
        stats: { dots: 0, ghosts: 0, fruits: 0, powerups: 0, deaths: 0, rivals: 0, ghost4: 0 }
      }, o);
    }
  }

  class Ghost {
    constructor(id) {
      const d = PM.GHOSTS[id];
      Object.assign(this, { id, name: d.name, color: d.color, corner: d.corner, home: d.home, x: d.home[0], y: d.home[1],
        dir: 1, moving: true, state: 'house', fright: 0, reverse: false, target: null, elroy: 0, bob: 1 });
    }
  }

  class Game {
    constructor(o) {
      o = o || {};
      this.o = o;
      this.mode = o.mode || 'classic';
      this.battle = this.mode === 'battle';
      this.features = this.mode !== 'classic'; // power-ups, combos, events
      this.demo = !!o.demo;
      this.seed = o.seed !== undefined ? o.seed >>> 0 : (Math.random() * 4294967295) >>> 0;
      this.rng = PM.rng(this.seed ^ 0x5bd1e995);
      this.diffId = this.mode === 'x27' ? (o.difficulty || 'normal') : 'normal';
      this.diff = PM.DIFFICULTY[this.diffId];
      this.smart = this.diff.smart;
      this.events = [];
      this.level = 1;
      this.lives = this.battle ? 0 : 2;
      this.nextLife = 10000;
      this.time = 0;
      this.frame = 0;
      this.director = 1;
      this.round = 1;
      this.battleT = PM.BATTLE_TIME;
      this.items = new Array(W * H).fill(null);
      this.homeField = new Int16Array(W * H);
      this.dotField = new Int16Array(W * H);
      this.fieldCache = new Map();

      const me = new Pac({ id: 0, name: o.name || 'YOU', isPlayer: true, color: o.color || '#ffe14d', hat: o.hat || 'none', trail: o.trail || 'none' });
      if (o.autopilot) me.brain = new PM.Brain('hard', 'cautious', this.rng);
      this.pacs = [me];
      if (this.battle) {
        const roster = PM.shuffle(PM.BOTS.slice(), this.rng);
        const pers = PM.shuffle(Object.keys(PM.PERSONALITIES), this.rng);
        const n = U.clamp(o.bots === undefined ? 3 : o.bots, 1, 3);
        for (let i = 0; i < n; i++) {
          const b = roster[i];
          const p = new Pac({ id: i + 1, name: b.name, color: b.color, hat: b.hat, trail: 'none', skill: o.botSkill || 'normal', persId: pers[i] });
          p.brain = new PM.Brain(o.botSkill || 'normal', pers[i], this.rng);
          this.pacs.push(p);
        }
      }
      this.player = me;
      this.ghosts = [0, 1, 2, 3].map(i => new Ghost(i));
      this.startLevel(true);
    }

    emit(type, data) { if (this.events.length < 400) this.events.push(Object.assign({}, data, { type })); }
    drain() { const e = this.events; this.events = []; return e; }
    emote(p, kind) { if (p.isPlayer && !p.brain) return; const l = PM.BOT_LINES[kind]; p.emote = l[this.rng.int(l.length)]; p.emoteT = 1.6; }

    /* ---------------- levels ---------------- */
    levelRng() { return PM.rng((this.seed + this.level * 2654435761) >>> 0); }
    startLevel(first) {
      const lr = this.levelRng();
      if (this.mode === 'classic') this.maze = PM.Maze.classic();
      else if (this.battle) this.maze = this.maze || PM.Maze.generate(this.seed);
      else this.maze = PM.Maze.generate((this.seed + this.level * 7919) >>> 0);
      if (this.mode === 'classic') this.theme = this.o.theme || 'retro';
      else if (this.battle) this.theme = PM.WORLD_THEMES[this.seed % PM.WORLD_THEMES.length];
      else this.theme = PM.WORLD_THEMES[(this.level - 1 + this.seed) % PM.WORLD_THEMES.length];
      this.event = this.features && !this.battle && this.level >= 2 ? lr.pick(PM.EVENT_POOL) : 'none';
      this.spec = PM.levelSpec(this.battle ? 3 : this.level);
      if (this.battle) this.spec.fright = 5;
      this.dots = Uint8Array.from(this.maze.dots0);
      this.items.fill(null);
      if (this.event === 'surge') this.scatterExtra(lr, 4, t => { this.dots[t] = 2; });
      if (this.event === 'gold') this.scatterExtra(lr, 12, t => { this.items[t] = { kind: 'coin', tiles: [t], x: t % W + 0.5, y: ((t / W) | 0) + 0.5, t: Infinity }; });
      this.dotsLeft = 0;
      for (let i = 0; i < W * H; i++) if (this.dots[i]) this.dotsLeft++;
      this.dotsTotal = this.dotsLeft;
      this.dotsEaten = 0;
      this.fruit = null;
      this.fruitsShown = 0;
      this.powerT = 7 + this.rng() * 4;
      this.levelTime = 0;
      this.deathsThisLevel = 0;
      this.dotFieldDirty = true;
      this.maze.bfs(PM.DOOR_TILE, this.homeField);
      // spawn points: you at the classic start, rivals in the corners
      const corners = [[1, 1], [26, 1], [26, 29], [1, 29]];
      this.pacs.forEach((p, i) => {
        if (i === 0) p.spawn = START.slice();
        else { const t = this.maze.nearestPath(corners[i - 1][0], corners[i - 1][1]); p.spawn = [t % W + 0.5, ((t / W) | 0) + 0.5]; }
      });
      this.resetActors(false, first);
      this.emit('levelStart', { level: this.level, event: this.event, theme: this.theme, first });
    }
    scatterExtra(r, n, fn) {
      const cands = this.maze.paths.filter(t => this.dots[t] === 1 && !this.items[t]);
      PM.shuffle(cands, r);
      for (let i = 0; i < n && i < cands.length; i++) fn(cands[i]);
    }

    resetActors(afterDeath, first) {
      for (const p of this.pacs) {
        p.x = p.spawn[0]; p.y = p.spawn[1]; p.dir = 1; p.nextDir = 1; p.moving = true; p.stall = 0;
        p.alive = true; p.deadT = 0; p.power = 0; p.turbo = 0; p.magnet = 0; p.phase = 0; p.dbl = 0; p.combo = 0; p.comboT = 0;
        p.invuln = this.battle ? 2 : 0;
        if (!this.battle) p.shield = 0;
      }
      for (const g of this.ghosts) {
        g.x = g.home[0]; g.y = g.home[1]; g.fright = 0; g.reverse = false; g.moving = true; g.target = null; g.bob = g.id % 2 ? 1 : -1;
        g.state = g.id === 0 ? 'active' : 'house';
        g.dir = g.id === 0 ? 1 : 0;
      }
      this.phaseIdx = 0; this.phaseT = 0; this.frightT = 0; this.freezeT = 0; this.hitstop = 0; this.hitGhost = null; this.flashDur = 2;
      this.counters = [0, 0, 0]; this.useGlobal = afterDeath; this.globalDots = 0; this.idleT = 0;
      this.state = 'ready';
      this.readyT = first && this.level === 1 ? 4.2 : this.battle ? 2.5 : 2;
      this.clearT = 0;
    }

    /* ---------------- helpers ---------------- */
    isScatter() { return this.phaseIdx % 2 === 0; }
    setDir(p, d) {
      p.nextDir = d;
      if (d === OPP[p.dir]) { p.dir = d; p.moving = true; }
    }
    targetPacFor(g) {
      let best = this.pacs[0], bd = Infinity;
      for (const p of this.pacs) {
        if (!p.alive) continue;
        const dd = PM.U.wrapDx(p.x, g.x) ** 2 + (p.y - g.y) ** 2;
        if (dd < bd) { bd = dd; best = p; }
      }
      return best;
    }
    fieldFor(key, tile, blocked) {
      let c = this.fieldCache.get(key);
      if (!c) { c = { frame: -1, field: new Int16Array(W * H) }; this.fieldCache.set(key, c); }
      if (c.frame !== this.frame) { this.maze.bfs(tile, c.field, blocked); c.frame = this.frame; }
      return c.field;
    }
    actorTile(a) {
      const t = this.maze.tileAt(a.x, a.y);
      return this.maze.type[t] === PM.TILE.PATH ? t : PM.DOOR_TILE;
    }
    threatsFor(p) {
      const out = [];
      if (this.freezeT <= 0) {
        for (const g of this.ghosts) {
          if ((g.state !== 'active' && g.state !== 'leaving') || g.fright > 0.6) continue;
          // ghosts never turn around on their own, so the tile behind one is not where it goes next
          const t = this.actorTile(g);
          const behind = g.state === 'active' ? this.maze.adj[t * 4 + OPP[g.dir]] : -1;
          out.push({ field: this.fieldFor('g' + g.id, t, behind), w: 1 });
        }
      }
      if (this.battle && p.power <= 0) {
        for (const r of this.pacs) if (r !== p && r.alive && r.power > 0.5) out.push({ field: this.fieldFor('p' + r.id, this.actorTile(r)), w: 1.2 });
      }
      return out;
    }
    // how much faster a ghost covers a tile than this pac (pacs pause a frame on every dot)
    threatRatio(p) {
      const pacSp = this.spec.pac * (p.turbo > 0 ? 1.35 : 1) * PM.TPS;
      const eff = pacSp / (1 + pacSp / 60);
      return U.clamp(PM.TPS * this.spec.ghost * this.diff.ghost * this.director * (this.event === 'rush' ? 1.1 : 1) / eff, 0.6, 1.6);
    }
    preysFor(p) {
      const out = [], hunt = p.brain ? p.brain.pers.hunt : 1;
      for (const g of this.ghosts) {
        if (g.state !== 'active') continue;
        if (g.fright > 1) out.push({ tile: this.actorTile(g), value: 25 * hunt, time: g.fright });
        else if (this.freezeT > 1) out.push({ tile: this.actorTile(g), value: 8, time: this.freezeT });
      }
      if (this.battle && p.power > 1) {
        for (const r of this.pacs) if (r !== p && r.alive && r.power <= 0 && r.invuln <= 0 && r.phase <= 0) out.push({ tile: this.actorTile(r), value: 30 * hunt, time: p.power });
      }
      return out;
    }
    getDotField() {
      if (this.dotFieldDirty) {
        const src = [];
        for (let i = 0; i < W * H; i++) if (this.dots[i]) src.push(i);
        this.maze.multiBfs(src, this.dotField);
        this.dotFieldDirty = false;
      }
      return this.dotField;
    }

    /* ---------------- main step ---------------- */
    step(dt) {
      this.frame++;
      for (const p of this.pacs) { p.emoteT -= dt; if (p.emoteT <= 0) p.emote = ''; }
      switch (this.state) {
        case 'ready':
          this.readyT -= dt;
          for (const g of this.ghosts) if (g.state === 'house') this.bob(g, dt);
          if (this.readyT <= 0) { this.state = 'play'; this.emit('go', {}); }
          return;
        case 'dying':
          this.dieT -= dt;
          this.player.deadT += dt;
          if (this.dieT <= 0) this.afterDeath();
          return;
        case 'clear':
          this.clearT -= dt;
          if (this.clearT <= 0) { this.level++; this.startLevel(false); }
          return;
        case 'over':
          return;
      }
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        if (this.hitstop <= 0) this.hitGhost = null;
        for (const g of this.ghosts) if (g.state === 'eaten' && g !== this.hitGhost) this.updateGhost(g, dt);
        return;
      }
      this.time += dt;
      this.levelTime += dt;
      if (this.battle) {
        this.battleT -= dt;
        if (this.battleT <= 0) { this.endBattle(); return; }
      }
      if (this.frightT > 0) this.frightT -= dt;
      if (this.freezeT > 0) this.freezeT -= dt;
      this.updatePhases(dt);
      this.updateRelease(dt);
      this.updateElroy();
      for (const p of this.pacs) this.updatePac(p, dt);
      for (const g of this.ghosts) this.updateGhost(g, dt);
      this.collisions();
      this.updateItems(dt);
      if (this.dotsLeft <= 0 && this.state === 'play') this.levelCleared();
    }

    updatePhases(dt) {
      if (this.frightT > 0) return;
      this.phaseT += dt;
      const ph = this.spec.phases;
      while (this.phaseIdx < ph.length - 1 && this.phaseT >= ph[this.phaseIdx]) {
        this.phaseT -= ph[this.phaseIdx];
        this.phaseIdx++;
        for (const g of this.ghosts) if (g.state === 'active') g.reverse = true;
      }
    }

    updateRelease(dt) {
      this.idleT += dt;
      const g = this.ghosts.find(x => x.id > 0 && x.state === 'house');
      if (!g) { this.useGlobal = false; return; }
      const limit = this.useGlobal ? [7, 17, 32][g.id - 1] : this.spec.dotLimits[g.id - 1];
      const count = this.useGlobal ? this.globalDots : this.counters[g.id - 1];
      if (count >= limit || this.idleT >= this.spec.idleRelease) { this.idleT = 0; g.state = 'leaving'; }
    }

    updateElroy() {
      const b = this.ghosts[0];
      if (this.battle) { b.elroy = 0; return; }
      const clydeHome = this.ghosts[3].state === 'house';
      const scale = this.maze.dotTotal / 244;
      b.elroy = clydeHome && this.useGlobal ? 0 : this.dotsLeft <= this.spec.elroyDots2 * scale ? 2 : this.dotsLeft <= this.spec.elroyDots1 * scale ? 1 : 0;
    }

    /* ---------------- movement ---------------- */
    advance(a, s) {
      a.x += DX[a.dir] * s; a.y += DY[a.dir] * s;
      if (a.x < 0) a.x += W; else if (a.x >= W) a.x -= W;
    }
    move(a, dist, isPac) {
      for (let guard = 0; guard < 12 && dist > 1e-9; guard++) {
        const cx = Math.floor(a.x) + 0.5, cy = Math.floor(a.y) + 0.5;
        if (Math.abs(a.x - cx) < 1e-6 && Math.abs(a.y - cy) < 1e-6) {
          a.x = cx; a.y = cy;
          if (isPac) this.pacAtCenter(a); else this.ghostAtCenter(a);
          if (!a.moving) return;
          const s = Math.min(dist, 0.999);
          this.advance(a, s);
          dist -= s;
          continue;
        }
        if (!a.moving) return;
        let to = DX[a.dir] ? (cx - a.x) * DX[a.dir] : (cy - a.y) * DY[a.dir];
        if (to <= 1e-9) to += 1;
        if (dist < to) { this.advance(a, dist); return; }
        const nx = a.x + DX[a.dir] * to, ny = a.y + DY[a.dir] * to;
        a.x = Math.round(nx - 0.5) + 0.5; a.y = Math.round(ny - 0.5) + 0.5;
        if (a.x < 0) a.x += W; else if (a.x >= W) a.x -= W;
        dist -= to;
      }
    }
    pacAtCenter(p) {
      const m = this.maze, t = m.tileAt(p.x, p.y);
      if (p.brain) p.nextDir = p.brain.decide(this, p);
      if (m.adj[t * 4 + p.nextDir] >= 0) { p.dir = p.nextDir; p.moving = true; }
      else p.moving = m.adj[t * 4 + p.dir] >= 0;
    }
    ghostAtCenter(g) {
      const m = this.maze, t = m.tileAt(g.x, g.y);
      if (g.state === 'eaten') {
        const tx = t % W, ty = (t / W) | 0;
        if (ty === 11 && (tx === 13 || tx === 14)) { g.state = 'entering'; g.x = DOOR[0]; g.y = DOOR[1]; g.moving = false; return; }
      }
      g.dir = PM.ghostChoose(this, g, t);
      g.moving = true;
    }

    updatePac(p, dt) {
      if (!p.alive) {
        p.deadT += dt;
        if (this.battle) { p.respawnT -= dt; if (p.respawnT <= 0) this.respawn(p); }
        return;
      }
      for (const k of ['invuln', 'power', 'turbo', 'magnet', 'shield', 'phase', 'dbl']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
      if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.combo = 0; }
      if (p.stall > 0) { p.stall -= dt; return; }
      if (p.brain) p.brain.tick(this, p, dt);
      // cornering: a turn pressed just before or after a junction is taken right away
      if (p.moving && p.nextDir !== p.dir && p.nextDir !== OPP[p.dir]) {
        const cx = Math.floor(p.x) + 0.5, cy = Math.floor(p.y) + 0.5;
        const off = DX[p.dir] ? (p.x - cx) * DX[p.dir] : (p.y - cy) * DY[p.dir];
        const t = this.maze.tileAt(p.x, p.y);
        if (Math.abs(off) < 0.3 && this.maze.adj[t * 4 + p.nextDir] >= 0) { p.x = cx; p.y = cy; p.dir = p.nextDir; }
      }
      const frightened = this.frightT > 0 || p.power > 0;
      let sp = PM.TPS * (frightened ? this.spec.pacFright : this.spec.pac);
      if (p.turbo > 0) sp *= 1.35;
      if (p.brain && !p.isPlayer) sp *= p.brain.skill.speed;
      const ox = p.x, oy = p.y;
      this.move(p, sp * dt, true);
      p.mouth += Math.abs(PM.U.wrapDx(p.x, ox)) + Math.abs(p.y - oy);
      const t = this.maze.tileAt(p.x, p.y);
      if (this.dots[t]) this.eatDot(p, t, false);
      if (p.magnet > 0) {
        const tx = Math.floor(p.x), ty = Math.floor(p.y);
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > 6.5 || ty + dy < 0 || ty + dy >= H) continue;
          const i = this.maze.idx(tx + dx, ty + dy);
          if (this.dots[i] === 1) this.eatDot(p, i, true);
        }
      }
      const it = this.items[t];
      if (it) this.pickup(p, it);
    }

    bob(g, dt) {
      g.y += g.bob * 1.6 * dt;
      if (g.y < HOUSE_Y - 0.5) { g.y = HOUSE_Y - 0.5; g.bob = 1; }
      if (g.y > HOUSE_Y + 0.5) { g.y = HOUSE_Y + 0.5; g.bob = -1; }
    }
    ghostSpeed(g) {
      const s = this.spec, t = this.maze.tileAt(g.x, g.y);
      if (g.fright > 0) return PM.TPS * s.ghostFright;
      if (this.maze.tunnel[t]) return PM.TPS * s.tunnel;
      let f = s.ghost;
      if (g.id === 0 && g.elroy === 2) f = s.elroy2; else if (g.id === 0 && g.elroy === 1) f = s.elroy1;
      return PM.TPS * f * this.diff.ghost * this.director * (this.event === 'rush' ? 1.1 : 1);
    }
    updateGhost(g, dt) {
      if (g.fright > 0) g.fright = Math.max(0, g.fright - dt);
      const frozen = this.freezeT > 0 && g.state !== 'eaten' && g.state !== 'entering';
      switch (g.state) {
        case 'house':
          if (!frozen) this.bob(g, dt);
          break;
        case 'leaving': {
          if (frozen) break;
          const s = 4 * dt;
          if (Math.abs(g.x - DOOR[0]) > 0.01) g.x += U.clamp(DOOR[0] - g.x, -s, s);
          else {
            g.x = DOOR[0];
            g.y -= s;
            if (g.y <= DOOR[1]) { g.y = DOOR[1]; g.state = 'active'; g.dir = 1; g.moving = true; g.reverse = false; }
          }
          break;
        }
        case 'entering':
          g.y += 8 * dt;
          if (g.y >= HOUSE_Y) { g.y = HOUSE_Y; g.state = 'leaving'; g.fright = 0; this.emit('revive', { ghost: g.id }); }
          break;
        case 'eaten':
          this.move(g, 15 * dt, false);
          break;
        default: // active
          if (frozen) break;
          if (g.reverse) { g.reverse = false; g.dir = OPP[g.dir]; g.moving = true; }
          this.move(g, this.ghostSpeed(g) * dt, false);
      }
    }

    /* ---------------- eating ---------------- */
    addScore(p, pts) {
      p.score += pts;
      if (!this.battle && p.isPlayer && p.score >= this.nextLife) {
        if (this.lives < 5) { this.lives++; this.emit('extraLife', {}); }
        this.nextLife = this.mode === 'classic' ? Infinity : this.nextLife + 40000;
      }
    }
    eatDot(p, t, magnet) {
      const kind = this.dots[t];
      this.dots[t] = 0;
      this.dotsLeft--; this.dotsEaten++;
      this.dotFieldDirty = true;
      this.idleT = 0;
      if (this.useGlobal) this.globalDots++;
      else { const g = this.ghosts.find(x => x.id > 0 && x.state === 'house'); if (g) this.counters[g.id - 1]++; }
      p.stats.dots++;
      let pts = kind === 2 ? 50 : 10;
      if (this.features) {
        p.combo = p.comboT > 0 ? p.combo + 1 : 1;
        p.comboT = 0.75;
        p.bestCombo = Math.max(p.bestCombo, p.combo);
        const mult = 1 + Math.min(3, Math.floor(p.combo / 20));
        if (kind === 1) pts *= mult;
        if (p.combo % 20 === 0 && mult > 1) this.emit('combo', { pac: p.id, mult, combo: p.combo, x: p.x, y: p.y });
      }
      if (p.dbl > 0) pts *= 2;
      this.addScore(p, pts);
      if (!magnet) p.stall = kind === 2 ? 3 / 60 : 1 / 60;
      this.emit('dot', { pac: p.id, kind, x: t % W + 0.5, y: ((t / W) | 0) + 0.5, magnet, player: p.isPlayer });
      if (kind === 2) this.energize(p);
      const scale = this.maze.dotTotal / 244;
      if ((this.dotsEaten === Math.round(70 * scale) || this.dotsEaten === Math.round(170 * scale)) && this.fruitsShown < 2) this.spawnFruit();
    }
    energize(p) {
      const secs = this.spec.fright * this.diff.fright;
      p.chain = 0;
      if (this.battle) { p.power = Math.max(secs, 3); this.emote(p, 'powered'); }
      this.frightT = secs;
      this.flashDur = Math.min(secs, this.spec.flashes * 0.4);
      for (const g of this.ghosts) {
        if (g.state === 'eaten' || g.state === 'entering') continue;
        if (g.state === 'active') g.reverse = true;
        if (secs > 0) g.fright = secs;
      }
      this.emit('energizer', { pac: p.id, secs, player: p.isPlayer });
    }
    eatGhost(p, g, shatter) {
      let pts;
      if (shatter) pts = 200;
      else { pts = 200 * Math.pow(2, Math.min(p.chain, 3)); p.chain++; }
      if (this.event === 'rush') pts *= 2;
      if (p.dbl > 0) pts *= 2;
      this.addScore(p, pts);
      g.state = 'eaten'; g.fright = 0; g.moving = true; g.reverse = false;
      p.stats.ghosts++;
      if (p.chain === 4 && !shatter) p.stats.ghost4++;
      this.emote(p, 'ate');
      this.emit('ghostEaten', { pac: p.id, ghost: g.id, pts, x: g.x, y: g.y, chain: p.chain, shatter, player: p.isPlayer });
      if (!this.battle) { this.hitstop = this.mode === 'classic' ? 0.6 : 0.35; this.hitGhost = g; this.hitPts = pts; }
    }
    spawnFruit() {
      const f = this.battle ? PM.FRUITS[this.rng.int(5)] : PM.fruitFor(this.level);
      this.fruitsShown++;
      const it = { kind: 'fruit', type: f.id, points: f.points, tiles: FRUIT_TILES, x: 14, y: 17.5, t: 9.4 + this.rng() * 0.6 };
      for (const t of FRUIT_TILES) this.items[t] = it;
      this.fruit = it;
      this.emit('fruitSpawn', { what: f.id });
    }
    removeItem(it) { for (const t of it.tiles) if (this.items[t] === it) this.items[t] = null; if (it === this.fruit) this.fruit = null; }
    pickup(p, it) {
      this.removeItem(it);
      if (it.kind === 'fruit') {
        const pts = it.points * (p.dbl > 0 ? 2 : 1);
        this.addScore(p, pts);
        p.stats.fruits++;
        this.emit('fruitEaten', { pac: p.id, what: it.type, pts, x: it.x, y: it.y, player: p.isPlayer });
      } else if (it.kind === 'coin') {
        this.addScore(p, 100);
        if (p.isPlayer) p.coins++;
        this.emit('coin', { pac: p.id, x: it.x, y: it.y, player: p.isPlayer });
      } else if (it.kind === 'power') this.applyPower(p, it.type, it);
    }
    applyPower(p, type, it) {
      p.stats.powerups++;
      const def = PM.POWERUPS[type];
      let hit = 0;
      switch (type) {
        case 'turbo': p.turbo = def.time; break;
        case 'magnet': p.magnet = def.time; break;
        case 'freeze': this.freezeT = def.time; break;
        case 'shield': p.shield = def.time; break;
        case 'phase': p.phase = def.time; break;
        case 'double': p.dbl = def.time; break;
        case 'shock':
          p.chain = 0;
          for (const g of this.ghosts) {
            if (g.state !== 'active' && g.state !== 'leaving') continue;
            if (PM.U.wrapDx(g.x, p.x) ** 2 + (g.y - p.y) ** 2 > 49) continue;
            g.fright = Math.max(g.fright, 4); if (g.state === 'active') g.reverse = true; hit++;
          }
          this.frightT = Math.max(this.frightT, 4);
          this.flashDur = 1.2;
          break;
      }
      if (this.battle && p.brain) this.emote(p, 'powered');
      this.emit('power', { pac: p.id, what: type, x: it ? it.x : p.x, y: it ? it.y : p.y, hit, player: p.isPlayer });
    }
    updateItems(dt) {
      if (this.fruit) { this.fruit.t -= dt; if (this.fruit.t <= 0) { this.removeItem(this.fruit); this.emit('fruitGone', {}); } }
      if (!this.features) return;
      for (const t of this.maze.paths) {
        const it = this.items[t];
        if (it && it.kind === 'power' && it.tiles[0] === t) { it.t -= dt; if (it.t <= 0) this.removeItem(it); }
      }
      this.powerT -= dt;
      if (this.powerT > 0) return;
      this.powerT = this.battle ? 6 + this.rng() * 4 : 9 + this.rng() * 6;
      let count = 0;
      for (const t of this.maze.paths) if (this.items[t] && this.items[t].kind === 'power') count++;
      if (count >= (this.battle ? 3 : 2)) return;
      const ok = this.maze.paths.filter(t => {
        const x = t % W, y = (t / W) | 0;
        if (this.items[t] || this.maze.tunnel[t] || (y >= 9 && y <= 19 && x >= 7 && x <= 20)) return false;
        return this.pacs.every(p => !p.alive || PM.U.wrapDx(p.x, x + 0.5) ** 2 + (p.y - y - 0.5) ** 2 > 36);
      });
      if (!ok.length) return;
      const t = ok[this.rng.int(ok.length)];
      const type = PM.POWERUP_ORDER[this.rng.int(PM.POWERUP_ORDER.length)];
      this.items[t] = { kind: 'power', type, tiles: [t], x: t % W + 0.5, y: ((t / W) | 0) + 0.5, t: 14 };
      this.emit('powerSpawn', { what: type });
    }

    /* ---------------- collisions & lives ---------------- */
    near(a, b) { return PM.U.wrapDx(a.x, b.x) ** 2 + (a.y - b.y) ** 2 < 0.5; }
    collisions() {
      for (const p of this.pacs) {
        if (!p.alive || this.state !== 'play') continue;
        for (const g of this.ghosts) {
          if ((g.state !== 'active' && g.state !== 'leaving') || !this.near(p, g)) continue;
          if (g.fright > 0) { this.eatGhost(p, g, false); continue; }
          if (this.freezeT > 0) { this.eatGhost(p, g, true); continue; }
          if (p.phase > 0 || p.invuln > 0) continue;
          if (p.shield > 0) {
            p.shield = 0; p.invuln = 1;
            g.state = 'eaten'; g.fright = 0; g.moving = true;
            this.emit('shieldBlock', { pac: p.id, x: p.x, y: p.y, player: p.isPlayer });
            continue;
          }
          this.killPac(p);
          break;
        }
      }
      if (!this.battle) return;
      for (let i = 0; i < this.pacs.length; i++) {
        for (let j = i + 1; j < this.pacs.length; j++) {
          const a = this.pacs[i], b = this.pacs[j];
          if (!a.alive || !b.alive || !this.near(a, b)) continue;
          if (a.power > 0 && b.power <= 0) this.eatRival(a, b);
          else if (b.power > 0 && a.power <= 0) this.eatRival(b, a);
        }
      }
    }
    eatRival(a, b) {
      if (b.invuln > 0 || b.phase > 0) return;
      if (b.shield > 0) { b.shield = 0; b.invuln = 1.2; this.emit('shieldBlock', { pac: b.id, x: b.x, y: b.y, player: b.isPlayer }); return; }
      const steal = Math.floor(b.score * 0.15 / 10) * 10;
      b.score -= steal;
      this.addScore(a, 1000 + steal);
      a.stats.rivals++;
      this.emote(a, 'ate');
      this.emit('rivalEaten', { by: a.id, pac: b.id, pts: 1000 + steal, x: b.x, y: b.y, player: a.isPlayer, victim: b.isPlayer });
      this.killPac(b, true);
    }
    killPac(p, byRival) {
      p.alive = false; p.deadT = 0; p.stats.deaths++;
      p.combo = 0; p.comboT = 0; p.power = 0;
      this.emote(p, 'died');
      this.emit('death', { pac: p.id, x: p.x, y: p.y, player: p.isPlayer, byRival: !!byRival });
      if (this.battle) {
        p.respawnT = 3;
        if (!byRival) { const loss = Math.floor(p.score * 0.1 / 10) * 10; p.score -= loss; }
        return;
      }
      this.state = 'dying';
      this.dieT = 2.6;
      this.deathsThisLevel++;
      if (this.mode === 'x27' && this.diffId === 'normal') this.director = Math.max(0.9, this.director - 0.04);
    }
    respawn(p) {
      p.alive = true; p.x = p.spawn[0]; p.y = p.spawn[1]; p.dir = 1; p.nextDir = 1; p.moving = true; p.invuln = 2; p.deadT = 0;
      this.emit('respawn', { pac: p.id, x: p.x, y: p.y });
    }
    afterDeath() {
      if (this.lives <= 0) { this.state = 'over'; this.emit('gameOver', { score: this.player.score, level: this.level }); return; }
      this.lives--;
      this.fruit && this.removeItem(this.fruit);
      this.resetActors(true, false);
      this.emit('lifeLost', { lives: this.lives });
    }
    levelCleared() {
      if (this.battle) {
        this.dots.set(this.maze.dots0);
        this.dotsLeft = this.dotsTotal = this.maze.dotTotal;
        this.dotsEaten = 0; this.fruitsShown = 0; this.round++; this.dotFieldDirty = true;
        this.emit('refill', { round: this.round });
        return;
      }
      let bonus = 0;
      if (this.event === 'speedrun') {
        const par = this.dotsTotal * 0.13 + 12;
        bonus = Math.max(0, Math.round((par - this.levelTime) * 10) * 10);
        if (bonus) this.addScore(this.player, bonus);
      }
      if (this.mode === 'x27' && this.diffId === 'normal' && !this.deathsThisLevel) this.director = Math.min(1.06, this.director + 0.02);
      this.state = 'clear';
      this.clearT = 2.4;
      this.frightT = 0;
      this.emit('levelClear', { level: this.level, perfect: this.deathsThisLevel === 0, bonus, time: this.levelTime });
    }
    endBattle() {
      this.state = 'over';
      const ranking = this.pacs.slice().sort((a, b) => b.score - a.score);
      this.emit('battleEnd', { ranking: ranking.map(p => p.id) });
    }
  }
  PM.Game = Game;
  PM.Pac = Pac;
})(window.PM = window.PM || {});
