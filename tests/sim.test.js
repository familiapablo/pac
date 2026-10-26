/* Headless checks: node tests/sim.test.js
   - the arcade maze and 300 generated mazes are valid (symmetric, connected, no dead ends)
   - full games run in every mode with the autopilot: no NaN, nobody inside walls, levels get cleared
   - the Daily Run is identical for everyone */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, Math, Date };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'config.js', 'maze.js', 'ai.js', 'sim.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
const PM = ctx.PM, W = PM.W, H = PM.H;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  FAIL ' + msg); } };

function validate(m, label) {
  const deg = i => { let n = 0; for (let d = 0; d < 4; d++) if (m.adj[i * 4 + d] >= 0) n++; return n; };
  const dead = m.paths.filter(i => deg(i) < 2);
  check(!dead.length, label + ': dead ends at ' + dead.slice(0, 3).map(i => (i % W) + ',' + ((i / W) | 0)));
  const f = new Int16Array(W * H);
  m.bfs(23 * W + 13, f);
  const lost = m.paths.filter(i => f[i] < 0);
  check(!lost.length, label + ': unreachable tiles ' + lost.length);
  let sym = true;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.type[y * W + x] !== m.type[y * W + (W - 1 - x)]) sym = false;
  check(sym, label + ': not symmetric');
  let e = 0; for (const v of m.dots0) if (v === 2) e++;
  check(e === 4, label + ': energizers ' + e);
}
const c = PM.Maze.classic();
check(c.dotTotal === 244, 'classic has 240 dots + 4 energizers, got ' + c.dotTotal);
validate(c, 'classic');
let minD = 1e9, maxD = 0;
for (let s = 1; s <= 300; s++) { const m = PM.Maze.generate(s * 977); check(m.kind === 'generated', 'seed ' + s + ' fell back'); validate(m, 'gen ' + s); minD = Math.min(minD, m.dotTotal); maxD = Math.max(maxD, m.dotTotal); }
console.log('generated mazes: dots ' + minD + '..' + maxD);

function run(opts, seconds) {
  const g = new PM.Game(Object.assign({ autopilot: true, seed: 1234 }, opts));
  const seen = {};
  const t0 = Date.now();
  let steps = 0;
  for (; steps < seconds * 60 && g.state !== 'over'; steps++) {
    g.step(1 / 60);
    for (const e of g.drain()) seen[e.type] = (seen[e.type] || 0) + 1;
    for (const a of g.pacs.concat(g.ghosts)) {
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) { check(false, 'NaN position'); return { g, seen }; }
    }
    for (const p of g.pacs) {
      if (!p.alive) continue;
      const t = g.maze.tileAt(p.x, p.y);
      if (g.maze.type[t] !== PM.TILE.PATH) { check(false, opts.mode + ': pac inside a wall at ' + p.x.toFixed(2) + ',' + p.y.toFixed(2)); return { g, seen }; }
    }
    for (const gh of g.ghosts) {
      if (gh.state !== 'active') continue;
      const t = g.maze.tileAt(gh.x, gh.y);
      if (g.maze.type[t] !== PM.TILE.PATH) { check(false, opts.mode + ': ghost inside a wall'); return { g, seen }; }
    }
  }
  const ms = Date.now() - t0;
  const p = g.player;
  console.log(`${(opts.mode + (opts.difficulty ? '/' + opts.difficulty : '')).padEnd(15)} ${(steps / 60).toFixed(0)}s sim in ${ms}ms  level ${g.level}  score ${p.score}  ghosts ${p.stats.ghosts}  deaths ${p.stats.deaths}  power-ups ${seen.power || 0}  state ${g.state}`);
  return { g, seen };
}
const cl = run({ mode: 'classic' }, 600);
check(cl.g.level >= 2 || cl.seen.levelClear, 'classic: autopilot should clear level 1');
check(cl.seen.ghostEaten > 0, 'classic: ghosts get eaten');
check(cl.seen.fruitSpawn > 0, 'classic: fruit appears');
const x = run({ mode: 'x27' }, 600);
check(x.seen.levelClear > 0, '2027: a level gets cleared');
check(x.seen.power > 0, '2027: power-ups get used');
run({ mode: 'x27', difficulty: 'insane' }, 300);
run({ mode: 'x27', difficulty: 'casual' }, 300);
const b = run({ mode: 'battle', bots: 3, botSkill: 'hard' }, 200);
check(b.g.state === 'over' && b.seen.battleEnd, 'battle ends on time');
check(b.g.pacs.every(p => p.score > 0), 'every battle pac scores');
console.log('battle: ' + b.g.pacs.map(p => p.name + ' ' + p.score + (p.brain && p.brain.persId ? ' (' + p.brain.persId + ')' : '')).join(', ') + '  rivals eaten ' + (b.seen.rivalEaten || 0));
// daily determinism
const d1 = new PM.Game({ mode: 'daily', seed: PM.hash('daily-2026-10-26') });
const d2 = new PM.Game({ mode: 'daily', seed: PM.hash('daily-2026-10-26') });
check(d1.maze.rows.join() === d2.maze.rows.join() && d1.theme === d2.theme, 'daily maze is deterministic');
console.log(fails ? fails + ' FAILURES' : 'All checks passed');
process.exit(fails ? 1 : 0);
