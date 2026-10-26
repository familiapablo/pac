/* PAC-MAN 2027* — app: menus, HUD, progression, shop, missions, results */
(function (PM) {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = PM.U.fmt, esc = PM.U.esc;
  const STEP = 1 / 60;

  /* ================= saved profile (this browser only) ================= */
  const KEY = 'pm2027.v1';
  const DEFAULT = () => ({
    name: 'PLAYER', xp: 0, coins: 0,
    owned: { color: ['yellow'], hat: ['none'], trail: ['none'], theme: ['retro', 'neon'] },
    equip: { color: 'yellow', hat: 'none', trail: 'none', theme: 'retro' },
    mode: 'x27', difficulty: 'normal', bots: 3, botSkill: 'normal',
    settings: { sound: true, music: true, volume: 0.7, controls: 'auto', targets: false, motion: true },
    stats: { games: 0, dots: 0, ghosts: 0, fruits: 0, levels: 0, deaths: 0, powerups: 0, battles: 0, battleWins: 0, bestLevel: 0, bestCombo: 0, perfectLevels: 0, time: 0 },
    scores: { classic: [], x27: [], battle: [], daily: [] },
    ach: {},
    missions: { date: '', list: [], seen: '' },
    daily: { last: '', streak: 0, history: {} }
  });
  function merge(base, extra) {
    for (const k in extra) {
      const v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], v);
      else if (v !== undefined) base[k] = v;
    }
    return base;
  }
  PM.Store = {
    load() { try { const raw = localStorage.getItem(KEY); if (raw) return merge(DEFAULT(), JSON.parse(raw)); } catch (e) { /* private mode */ } return DEFAULT(); },
    save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } },
    reset() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } return DEFAULT(); }
  };

  PM.levelOf = xp => Math.floor(Math.sqrt(xp / 300)) + 1;
  PM.xpFor = lvl => (lvl - 1) * (lvl - 1) * 300;
  const TITLES = ['Rookie', 'Dot Muncher', 'Maze Runner', 'Ghost Dodger', 'Power Player', 'Arcade Ace', 'Neon Legend', 'Ghost Hunter', 'Grand Master', 'PAC Legend'];
  PM.titleOf = lvl => TITLES[Math.min(TITLES.length - 1, Math.floor((lvl - 1) / 3))];

  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return PM.dateKey(d); };

  /* ================= app ================= */
  const App = {
    state: 'menu', paused: false, game: null, demo: null, last: 0, acc: 0, hud: {}, ambKey: '',

    boot() {
      this.p = PM.Store.load();
      this.ensureMissions();
      this.r = new PM.Renderer($('cv'));
      PM.Input.init($('stage'));
      PM.Input.onDir = d => this.onDir(d);
      PM.Input.onKey = (code, e) => this.onKey(code, e);
      PM.Input.bindPad($('dpad'));
      this.applySettings();
      const unlock = () => { PM.Audio.init(); if (this.state === 'menu') PM.Audio.startMusic(); };
      addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
      this.bind();
      this.renderMenu();
      this.renderProfile();
      this.newDemo();
      addEventListener('resize', () => this.layout());
      this.layout();
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'game' && !this.paused && !this.ended) this.pause(); });
      requestAnimationFrame(t => this.loop(t));
    },
    save() { PM.Store.save(this.p); },

    applySettings() {
      const s = this.p.settings;
      PM.Audio.on = s.sound; PM.Audio.musicOn = s.music; PM.Audio.setVolume(s.volume);
      if (!s.music) PM.Audio.stopMusic(); else if (this.state === 'menu') PM.Audio.startMusic();
      this.r.showTargets = s.targets;
      this.r.reduced = !s.motion;
      this.layout();
    },

    bind() {
      $('modes').addEventListener('click', e => {
        const b = e.target.closest('.mode'); if (!b) return;
        PM.Audio.sfx('click');
        if (this.p.mode === b.dataset.mode) { this.start(); return; }
        this.p.mode = b.dataset.mode; this.save(); this.renderMenu();
      });
      $('opts').addEventListener('click', e => {
        const b = e.target.closest('button[data-k]'); if (!b || b.disabled) return;
        PM.Audio.sfx('click');
        const v = b.dataset.v;
        if (b.dataset.k === 'theme') this.p.equip.theme = v; else this.p[b.dataset.k] = isNaN(v) ? v : Number(v);
        this.save(); this.renderMenu();
      });
      $('play').addEventListener('click', () => this.start());
      $('pause-btn').addEventListener('click', () => this.pause());
      $('resume').addEventListener('click', () => this.resume());
      $('restart').addEventListener('click', () => { $('pause').classList.add('hidden'); this.start(this.game.mode); });
      $('quit').addEventListener('click', () => this.toMenu());
      $('profile').addEventListener('click', () => this.open('profile'));
      $('fs-btn').addEventListener('click', () => this.fullscreen());
      document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => this.open(b.dataset.open)));
      $('modal').addEventListener('click', e => { if (e.target === $('modal') || e.target.closest('.close')) this.closeModal(); });
      if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) $('fs-btn').classList.add('hidden');
      if (PM.Input.touch) $('key-hint').textContent = 'Swipe anywhere to steer';
    },

    onDir(d) {
      if (this.state === 'game' && !this.paused && this.game) this.game.setDir(this.game.player, d);
    },
    onKey(code, e) {
      if (code === 'Escape' || code === 'KeyP') {
        if (!$('modal').classList.contains('hidden')) { this.closeModal(); return; }
        if (this.state === 'game' && !this.ended) { if (this.paused) this.resume(); else this.pause(); }
      } else if ((code === 'Enter' || code === 'Space') && this.state === 'menu' && $('modal').classList.contains('hidden')) {
        if (e.preventDefault) e.preventDefault();
        this.start();
      } else if (code === 'KeyM') {
        this.p.settings.sound = !this.p.settings.sound; this.save(); this.applySettings();
        this.toast(this.p.settings.sound ? '🔊 Sound on' : '🔇 Sound off');
      }
    },

    layout() {
      if (!this.r) return;
      const s = this.p.settings, touch = PM.Input.touch, portrait = innerHeight > innerWidth;
      const inGame = this.state === 'game';
      const roomBelow = innerHeight - (innerWidth * 31 / 28) - 100;
      const pad = inGame && touch && (s.controls === 'dpad' || (s.controls === 'auto' && portrait && roomBelow > 170));
      $('dpad').classList.toggle('hidden', !pad);
      $('dpad').classList.toggle('side', pad && !portrait);
      const bw = $('board-wrap');
      if (inGame) {
        // size the board from the space the HUD and D-pad leave, then hug it so nothing floats
        const st = $('stage'), cs = getComputedStyle(st);
        let h = st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - $('hud-top').offsetHeight - $('hud-bot').offsetHeight;
        if (pad && portrait) h -= 174;
        bw.style.flex = 'none';
        this.r.resize(bw.clientWidth, Math.max(120, h - 4));
        bw.style.height = this.r.cv.style.height;
      } else {
        bw.style.flex = ''; bw.style.height = '';
        this.r.resize(bw.clientWidth, bw.clientHeight);
      }
      document.documentElement.style.setProperty('--board-w', Math.max(280, parseFloat(this.r.cv.style.width)) + 'px');
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try {
        if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      } catch (e) { /* blocked by the embedding page */ }
    },

    /* ---------------- menu ---------------- */
    renderMenu() {
      const p = this.p, today = PM.dateKey(), done = p.daily.history[today];
      $('modes').innerHTML = PM.MODE_ORDER.map(id => {
        const m = PM.MODES[id];
        const badge = id === 'daily' ? `<span class="badge">${done ? '✓ ' + fmt(done.score) : 'NEW TODAY'}</span>` : '';
        return `<button class="mode${p.mode === id ? ' sel' : ''}" data-mode="${id}"><span class="ic">${m.icon}</span><b>${m.name.toUpperCase()}</b><small>${m.tag}</small>${badge}</button>`;
      }).join('');
      $('mode-desc').textContent = PM.MODES[p.mode].desc;
      const seg = (k, list, cur) => `<span class="seg">${list.map(([v, label, dis]) => `<button data-k="${k}" data-v="${v}" class="${String(cur) === String(v) ? 'sel' : ''}"${dis ? ' disabled' : ''}>${label}</button>`).join('')}</span>`;
      let html = '';
      if (p.mode === 'classic') {
        html = `<span class="opt">MAZE ${seg('theme', PM.CATALOG.theme.filter(t => p.owned.theme.includes(t.id)).map(t => [t.id, t.name]), p.equip.theme)}</span>`;
      } else if (p.mode === 'x27') {
        html = `<span class="opt">DIFFICULTY ${seg('difficulty', Object.keys(PM.DIFFICULTY).map(k => [k, PM.DIFFICULTY[k].name]), p.difficulty)}</span>`;
      } else if (p.mode === 'battle') {
        html = `<span class="opt">RIVALS ${seg('bots', [[1, '1'], [2, '2'], [3, '3']], p.bots)}</span>` +
          `<span class="opt">AI ${seg('botSkill', Object.keys(PM.BOT_SKILL).map(k => [k, PM.BOT_SKILL[k].name]), p.botSkill)}</span>`;
      } else {
        html = `<span class="opt">${today} · ${done ? 'Played: ' + fmt(done.score) + ' · replays are practice' : 'One counted run today'} · Streak ${p.daily.streak} 🔥</span>`;
      }
      $('opts').innerHTML = html;
      $('mission-dot').classList.toggle('hidden', p.missions.seen === today);
    },
    renderProfile() {
      const p = this.p, lvl = PM.levelOf(p.xp), a = PM.xpFor(lvl), b = PM.xpFor(lvl + 1);
      $('p-name').textContent = p.name || 'PLAYER';
      $('p-level').textContent = 'Lv ' + lvl + ' · ' + PM.titleOf(lvl);
      $('p-xp').style.width = Math.round((p.xp - a) / (b - a) * 100) + '%';
      $('coins').textContent = '🪙 ' + fmt(p.coins);
      this.drawPacPreview($('avatar'), 64, this.equipColor(), p.equip.hat);
    },
    equipColor(id) { const c = PM.CATALOG.color.find(x => x.id === (id || this.p.equip.color)); return c ? c.value : '#ffe14d'; },
    drawPacPreview(cv, px, color, hat, trail, theme) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = px * dpr; cv.height = px * dpr;
      const g = cv.getContext('2d');
      g.setTransform(px * dpr / 4, 0, 0, px * dpr / 4, 0, 0);
      g.clearRect(0, 0, 4, 4);
      if (theme) {
        const th = PM.THEMES[theme];
        const bg = g.createLinearGradient(0, 0, 0, 4); bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
        g.fillStyle = bg; g.fillRect(0, 0, 4, 4);
        g.strokeStyle = th.wall; g.lineWidth = 0.12; g.shadowColor = th.glow; g.shadowBlur = px * dpr * 0.06;
        g.strokeRect(0.35, 0.35, 3.3, 3.3); g.strokeRect(1.3, 1.3, 1.4, 1.4);
        g.shadowBlur = 0; g.fillStyle = th.dot;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0.85 + i * 0.77, 0.85, 0.09, 0, Math.PI * 2); g.fill(); }
        g.beginPath(); g.arc(0.85, 3.15, 0.2, 0, Math.PI * 2); g.fill();
        return;
      }
      if (trail && trail !== 'none') {
        const cols = { sparkle: ['#ffffff', '#fff3a0'], hearts: ['#ff5ec8'], fire: ['#ff7a1a', '#ffd23a'], pixels: [PM.Draw.pacColor(color, 0)], rainbow: ['#ff3b5c', '#ffd23a', '#5dff9e', '#4ef2ff', '#b58cff'] }[trail];
        for (let i = 0; i < 7; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.25 + i * 0.1; g.beginPath(); g.arc(0.25 + i * 0.22, 2.2 + Math.sin(i) * 0.15, 0.07 + i * 0.015, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 1;
      }
      PM.Draw.pac(g, { x: 2.2, y: 2.25, r: 1.15, dir: 3, color, hat, mouth: 0.55, t: performance.now() / 1000 });
    },

    /* ---------------- demo behind the menu ---------------- */
    newDemo() {
      const hats = ['none', 'cap', 'crown', 'antenna'];
      this.demo = new PM.Game({ mode: 'x27', demo: true, autopilot: true, name: 'DEMO', color: '#ffe14d', hat: hats[Math.floor(Math.random() * hats.length)] });
    },

    /* ---------------- game flow ---------------- */
    start(mode) {
      mode = mode || this.p.mode;
      PM.Audio.init();
      const p = this.p, eq = p.equip, today = PM.dateKey();
      const opts = { mode, name: (p.name || 'YOU').slice(0, 10), color: this.equipColor(), hat: eq.hat, trail: eq.trail, theme: eq.theme, difficulty: p.difficulty, bots: p.bots, botSkill: p.botSkill };
      this.practice = false;
      if (mode === 'daily') { opts.seed = PM.hash('pm2027-daily-' + today); this.practice = !!p.daily.history[today]; }
      this.game = new PM.Game(opts);
      this.state = 'game'; this.paused = false; this.ended = false;
      this.levelsCleared = 0; this.perfectLevels = 0; this.insaneClear = false; this.shock3 = false;
      this.hud = {}; this.ambKey = '';
      this.r.fx.clear();
      $('menu').classList.add('hidden'); $('pause').classList.add('hidden'); this.closeModal(true);
      $('hud-top').classList.remove('hidden'); $('hud-bot').classList.remove('hidden');
      $('h-lives').classList.toggle('hidden', mode === 'battle');
      PM.Audio.stopMusic();
      this.layout();
      this.handleAll(this.game.drain());
    },
    toMenu() {
      this.state = 'menu'; this.paused = false; this.game = null;
      PM.Audio.setAmbient(null);
      $('pause').classList.add('hidden'); $('banner').classList.add('hidden');
      $('hud-top').classList.add('hidden'); $('hud-bot').classList.add('hidden');
      $('menu').classList.remove('hidden');
      this.closeModal(true);
      this.renderMenu(); this.renderProfile();
      this.layout();
      PM.Audio.startMusic();
    },
    pause() {
      if (this.state !== 'game' || this.ended) return;
      this.paused = true;
      PM.Audio.setAmbient(null);
      $('pause').classList.remove('hidden');
      setTimeout(() => $('resume').focus(), 30);
    },
    resume() {
      this.paused = false; this.acc = 0;
      $('pause').classList.add('hidden');
      this.closeModal(true);
    },

    loop(ts) {
      const dt = Math.min(0.05, (ts - this.last) / 1000 || STEP);
      this.last = ts;
      PM.Input.pollGamepad();
      const inGame = this.state === 'game';
      const g = inGame ? this.game : this.demo;
      if (g && !(inGame && this.paused)) {
        this.acc += dt;
        let n = 0;
        while (this.acc >= STEP && n < 5) { g.step(STEP); this.acc -= STEP; n++; }
        if (n === 5) this.acc = 0;
        const evs = g.drain();
        if (inGame) this.handleAll(evs);
        else {
          for (const e of evs) this.r.onEvent(e, g);
          if (g.state === 'over' || g.time > 150) this.newDemo();
        }
      }
      if (g) this.r.draw(g, inGame && this.paused ? 0 : dt, { paused: inGame && this.paused });
      if (inGame) { this.updateHud(); this.updateAmbient(); }
      requestAnimationFrame(t => this.loop(t));
    },

    handleAll(evs) { for (const e of evs) this.handle(e); },
    handle(e) {
      const g = this.game, A = PM.Audio;
      this.r.onEvent(e, g);
      switch (e.type) {
        case 'levelStart':
          if (g.battle) { A.sfx('event'); this.banner('BATTLE!', 'Most points in 2:30 wins. Energizers let you eat rivals.', 2.6); break; }
          if (e.first) A.jingle();
          if (g.mode === 'classic') { if (e.level > 1) this.banner('LEVEL ' + e.level, '', 1.6); break; }
          if (e.event !== 'none') { A.sfx('event'); this.banner('LEVEL ' + e.level + ' · ' + PM.EVENTS[e.event].name, PM.EVENTS[e.event].desc, 2.6); }
          else this.banner('LEVEL ' + e.level, PM.THEMES[e.theme].name + (g.mode === 'daily' ? ' · Daily Run' : ''), 1.8);
          break;
        case 'dot': if (e.player) A.sfx('waka'); break;
        case 'energizer': if (e.player) A.sfx('energizer'); break;
        case 'ghostEaten': if (e.player) A.sfx('ghost'); break;
        case 'fruitEaten': if (e.player) A.sfx('fruit'); break;
        case 'power':
          if (e.player) { A.sfx('power', e.what); if (e.what === 'shock' && e.hit >= 3) this.shock3 = true; }
          break;
        case 'powerSpawn': A.sfx('spawn'); break;
        case 'coin': if (e.player) A.sfx('coin'); break;
        case 'combo': if (e.player) A.sfx('combo', e.mult); break;
        case 'death': if (e.player) { A.sfx(g.battle ? 'hurt' : 'death'); A.setAmbient(null); this.ambKey = ''; } break;
        case 'rivalEaten': if (e.player || e.victim) A.sfx('rival'); break;
        case 'shieldBlock': if (e.player) A.sfx('shield'); break;
        case 'extraLife': A.sfx('extraLife'); this.toast('⭐ Extra life!', 'gold'); break;
        case 'levelClear':
          A.sfx('clear'); this.levelsCleared++;
          if (e.perfect) this.perfectLevels++;
          if (g.diffId === 'insane') this.insaneClear = true;
          break;
        case 'refill': this.banner('ROUND ' + e.round, 'The maze is full again!', 1.4); break;
        case 'gameOver': setTimeout(() => this.finish(), 1700); break;
        case 'battleEnd': setTimeout(() => this.finish(), 1200); break;
      }
    },

    banner(title, sub, secs) {
      $('banner-title').textContent = title;
      $('banner-sub').textContent = sub || '';
      $('banner-sub').classList.toggle('hidden', !sub);
      const b = $('banner');
      b.classList.remove('hidden');
      b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
      clearTimeout(this.bannerT);
      this.bannerT = setTimeout(() => b.classList.add('hidden'), (secs || 2) * 1000);
    },
    toast(msg, cls) {
      const t = document.createElement('div');
      t.className = 'toast' + (cls ? ' ' + cls : '');
      t.textContent = msg;
      $('toasts').appendChild(t);
      setTimeout(() => t.remove(), 2600);
    },

    /* ---------------- HUD ---------------- */
    set(id, v) { if (this.hud[id] !== v) { this.hud[id] = v; $(id).innerHTML = v; } },
    bestFor(mode) {
      const list = (this.p.scores[mode] || []).map(s => s.score).concat(PM.CPU_SCORES[mode].map(c => c[1]));
      return Math.max(0, ...list);
    },
    updateHud() {
      const g = this.game, me = g.player;
      this.set('h-score', fmt(me.score));
      if (g.battle) {
        const t = Math.max(0, Math.ceil(g.battleT));
        this.set('h-mid-label', 'TIME');
        this.set('h-mid', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'));
        const rank = g.pacs.slice().sort((a, b) => b.score - a.score);
        this.set('h-right-label', 'RANK');
        this.set('h-right', '#' + (rank.indexOf(me) + 1) + '/' + g.pacs.length);
        this.set('h-fruits', rank.map(p => `<span class="rchip${p.isPlayer ? ' me' : ''}"><i style="background:${PM.Draw.pacColor(p.color, 0)}"></i>${p.isPlayer ? 'YOU' : esc(p.name)} ${fmt(p.score)}</span>`).join(''));
      } else {
        this.set('h-mid-label', this.r.T * 28 < 380 ? 'BEST' : 'HIGH SCORE');
        this.set('h-mid', fmt(Math.max(this.bestFor(g.mode), me.score)));
        this.set('h-right-label', g.mode === 'daily' ? 'DAILY LV' : 'LEVEL');
        this.set('h-right', String(g.level));
        const icon = this.r.icon('pac', this.equipColor(), 44);
        this.set('h-lives', Array.from({ length: Math.min(g.lives, 6) }, () => `<img src="${icon}" alt="">`).join(''));
        const fr = [];
        for (let l = Math.max(1, g.level - 6); l <= g.level; l++) fr.push(PM.fruitFor(l).id);
        this.set('h-fruits', fr.map(f => `<img src="${this.r.icon('fruit', f, 48)}" alt="">`).join(''));
      }
      const pw = [];
      const add = (type, t) => { if (t > 0) pw.push(`<span class="pchip"><img src="${this.r.icon('power', type, 44)}" alt="">${Math.ceil(t)}</span>`); };
      add('turbo', me.turbo); add('magnet', me.magnet); add('shield', me.shield); add('phase', me.phase); add('double', me.dbl); add('freeze', g.freezeT);
      if (g.battle && me.power > 0) pw.unshift(`<span class="pchip" style="color:#fff">⚡ POWER ${Math.ceil(me.power)}</span>`);
      this.set('h-powers', pw.join(''));
      const showCombo = g.features && me.combo >= 10;
      if (this.hud.comboOn !== showCombo) { this.hud.comboOn = showCombo; $('h-combo').classList.toggle('hidden', !showCombo); }
      if (showCombo) {
        this.set('h-combo-x', 'x' + (1 + Math.min(3, Math.floor(me.combo / 20))) + ' <small style="font-size:10px;opacity:.7">' + me.combo + '</small>');
        $('h-combo-bar').style.width = (me.combo >= 60 ? 100 : (me.combo % 20) * 5) + '%';
      }
    },
    updateAmbient() {
      const g = this.game;
      let kind = null, prog = 0;
      if (!this.paused && g.state === 'play') {
        const eyes = g.ghosts.some(x => x.state === 'eaten' || x.state === 'entering');
        const fr = g.ghosts.some(x => x.fright > 0 && x.state !== 'house');
        kind = eyes ? 'eyes' : fr ? 'fright' : 'siren';
        prog = 1 - g.dotsLeft / Math.max(1, g.dotsTotal);
      }
      const key = kind + Math.round(prog * 20);
      if (key !== this.ambKey) { this.ambKey = key; PM.Audio.setAmbient(kind, prog); }
    },

    /* ---------------- results & rewards ---------------- */
    ensureMissions() {
      const today = PM.dateKey(), m = this.p.missions;
      if (m.date === today && m.list.length) return;
      const r = PM.rng(PM.hash('pm2027-missions-' + today));
      const pick = PM.shuffle(PM.MISSIONS.slice(), r).slice(0, 3);
      m.date = today;
      m.list = pick.map(d => ({ id: d.id, n: d.n[r.int(d.n.length)], reward: d.reward, progress: 0, done: false }));
      this.save();
    },
    missionText(m) { const d = PM.MISSIONS.find(x => x.id === m.id); return d.text.replace('{n}', fmt(m.n)); },

    finish() {
      if (this.ended || !this.game) return;
      this.ended = true;
      PM.Audio.setAmbient(null);
      const g = this.game, me = g.player, p = this.p, st = p.stats, s = me.stats, today = PM.dateKey();
      const score = me.score;
      const rank = g.pacs.slice().sort((a, b) => b.score - a.score);
      const place = rank.indexOf(me) + 1, win = g.battle && place === 1;
      // lifetime stats
      st.games++; st.dots += s.dots; st.ghosts += s.ghosts; st.fruits += s.fruits; st.levels += this.levelsCleared;
      st.deaths += s.deaths; st.powerups += s.powerups; st.bestLevel = Math.max(st.bestLevel, g.level);
      st.bestCombo = Math.max(st.bestCombo, me.bestCombo); st.perfectLevels += this.perfectLevels; st.time += Math.round(g.time);
      if (g.battle) { st.battles++; if (win) st.battleWins++; }
      // rewards
      let xp = Math.round(score / 100) + this.levelsCleared * 25 + (win ? 120 : 0) + (g.battle ? (4 - place) * 15 : 0);
      let coins = Math.floor(score / 400) + me.coins + (win ? 40 : g.battle && place === 2 ? 15 : 0);
      if (this.practice) { xp = Math.round(xp / 4); coins = Math.floor(coins / 4); }
      // daily
      if (g.mode === 'daily' && !this.practice) {
        const d = p.daily;
        d.streak = d.last === yesterday() ? d.streak + 1 : d.last === today ? d.streak : 1;
        d.last = today;
        d.history[today] = { score, level: g.level };
      }
      // high score table
      let tablePos = 0, best = false;
      if (!this.practice) {
        const list = p.scores[g.mode];
        const prevBest = list.length ? list[0].score : 0;
        list.push({ name: p.name || 'PLAYER', score, level: g.level, date: today });
        list.sort((a, b) => b.score - a.score);
        list.length = Math.min(list.length, 10);
        best = score > prevBest && score > 0;
        const all = list.map(x => x.score).concat(PM.CPU_SCORES[g.mode].map(c => c[1])).sort((a, b) => b - a);
        tablePos = all.indexOf(score) + 1;
      }
      // missions
      const ms = p.missions, finished = [];
      if (ms.date !== today) this.ensureMissions();
      for (const m of ms.list) {
        if (m.done) continue;
        switch (m.id) {
          case 'ghosts': m.progress += s.ghosts; break;
          case 'fruits': m.progress += s.fruits; break;
          case 'levels': m.progress += this.levelsCleared; break;
          case 'score': m.progress = Math.max(m.progress, score); break;
          case 'powerups': m.progress += s.powerups; break;
          case 'battle': m.progress += win ? 1 : 0; break;
          case 'dots': m.progress += s.dots; break;
          case 'combo': m.progress = Math.max(m.progress, me.bestCombo); break;
        }
        if (m.progress >= m.n) { m.done = true; coins += m.reward; finished.push(m); }
      }
      // achievements
      const got = [];
      const award = (id, cond) => { if (cond && !p.ach[id]) { p.ach[id] = Date.now(); got.push(PM.ACHIEVEMENTS.find(a => a.id === id)); } };
      award('first', true);
      award('level5', !g.battle && g.level >= 5);
      award('level10', !g.battle && g.level >= 10);
      award('ghost4', s.ghost4 > 0);
      award('ghosts100', st.ghosts >= 100);
      award('fruit10', st.fruits >= 10);
      award('score50k', !g.battle && score >= 50000);
      award('score100k', !g.battle && score >= 100000);
      award('perfect', this.perfectLevels > 0);
      award('battle_win', win);
      award('battle_hard', win && g.pacs.length === 4 && p.botSkill === 'hard');
      award('combo50', me.bestCombo >= 50);
      award('power20', st.powerups >= 20);
      award('shock3', this.shock3);
      award('insane', this.insaneClear);
      award('daily3', p.daily.streak >= 3);
      const lvlBefore = PM.levelOf(p.xp);
      p.xp += xp; p.coins += coins;
      this.save();
      this.renderProfile();
      const lvl = PM.levelOf(p.xp), a = PM.xpFor(lvl), b = PM.xpFor(lvl + 1);
      if (win || best) PM.Audio.sfx('extraLife');

      const title = g.battle ? (win ? 'VICTORY!' : ['', '1ST', '2ND', '3RD', '4TH'][place] + ' PLACE')
        : g.mode === 'daily' ? 'DAILY RUN OVER' : 'GAME OVER';
      const sub = [PM.MODES[g.mode].name + (g.mode === 'x27' ? ' · ' + PM.DIFFICULTY[g.diffId].name : '') + (g.battle ? ' · ' + PM.BOT_SKILL[p.botSkill].name + ' AI' : ' · Level ' + g.level)];
      if (best) sub.push('🎉 New personal best!');
      if (tablePos && tablePos <= 10) sub.push('#' + tablePos + ' on the high score table');
      if (this.practice) sub.push('Practice run (today\'s Daily already counted)');
      const kpis = g.battle
        ? [[fmt(s.dots), 'Dots'], [s.ghosts, 'Ghosts'], [s.rivals, 'Rivals eaten'], [s.deaths, 'Times caught']]
        : [[g.level, 'Level'], [fmt(s.dots), 'Dots'], [s.ghosts, 'Ghosts'], [g.features ? me.bestCombo : s.fruits, g.features ? 'Best combo' : 'Fruits']];
      const table = g.battle ? `<table class="table"><tr><th>#</th><th>PLAYER</th><th class="num">SCORE</th></tr>${rank.map((q, i) =>
        `<tr class="${q.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><span class="swatch" style="background:${PM.Draw.pacColor(q.color, 0)}"></span>${q.isPlayer ? esc(p.name || 'YOU') : esc(q.name) + ' <small style="opacity:.6">' + PM.PERSONALITIES[q.persId].name + '</small>'}</td><td class="num">${fmt(q.score)}</td></tr>`).join('')}</table>` : '';
      const rewards = [`<span>+${xp} XP</span>`, `<span class="gold">+${coins} 🪙</span>`]
        .concat(finished.map(m => `<span class="green">✓ ${esc(this.missionText(m))} +${m.reward}🪙</span>`))
        .concat(got.map(x => `<span class="gold">${x.icon} ${esc(x.name)}</span>`));
      this.showModal(`
        <p class="res-title">${title}</p>
        <div class="big-score">${fmt(score)}</div>
        <p class="res-sub">${sub.map(esc).join(' · ')}</p>
        ${table}
        <div class="kpis">${kpis.map(k => `<div class="kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('')}</div>
        <div class="rewards">${rewards.join('')}</div>
        <div class="lvl"><span>Lv ${lvl}</span><span class="xpbar"><i style="width:${Math.round((p.xp - a) / (b - a) * 100)}%"></i></span><span>${lvl > lvlBefore ? '⬆ LEVEL UP!' : PM.titleOf(lvl)}</span></div>
        <div class="row-btns">
          ${g.mode === 'daily' ? '<button class="btn cyan" id="r-share">📋 Share</button>' : ''}
          <button class="btn play" id="r-again">PLAY AGAIN</button>
          <button class="btn" id="r-menu">Menu</button>
        </div>`, () => this.toMenu());
      $('r-again').onclick = () => { this.closeModal(true); this.start(g.mode); };
      $('r-menu').onclick = () => this.closeModal();
      if ($('r-share')) $('r-share').onclick = () => this.share(score, g);
      setTimeout(() => $('r-again') && $('r-again').focus(), 60);
      for (const x of got) this.toast(x.icon + ' Achievement: ' + x.name, 'gold');
    },
    share(score, g) {
      const s = g.player.stats;
      const text = `PAC-MAN 2027* Daily Run ${PM.dateKey()}\n🟡 ${fmt(score)} pts · Level ${g.level}\n👻 ${s.ghosts} ghosts · 🍒 ${s.fruits} fruits · ⚡ ${s.powerups} power-ups` +
        (/^https?:/.test(location.href) ? '\n' + location.href.split('#')[0] : '');
      const done = () => this.toast('📋 Copied! Paste it anywhere.');
      const fallback = () => {
        const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); done(); } catch (e) { this.toast('Could not copy'); }
        t.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    },

    /* ---------------- modals ---------------- */
    showModal(html, onClose) {
      $('modal-body').innerHTML = html;
      $('modal').classList.remove('hidden');
      $('modal').querySelector('.sheet').scrollTop = 0;
      this.onClose = onClose || null;
    },
    closeModal(silent) {
      if ($('modal').classList.contains('hidden')) return;
      $('modal').classList.add('hidden');
      const cb = this.onClose; this.onClose = null;
      if (this.garageTimer) { clearInterval(this.garageTimer); this.garageTimer = null; }
      if (cb && !silent) cb();
    },
    open(which) {
      PM.Audio.sfx('click');
      const p = this.p;
      if (which === 'help') {
        const pu = PM.POWERUP_ORDER.map(k => `<div class="pu"><img src="${this.r.icon('power', k, 60)}" alt=""><span><b>${PM.POWERUPS[k].name}</b><small>${PM.POWERUPS[k].desc}</small></span></div>`).join('');
        const gh = PM.GHOSTS.map((g, i) => `<div class="gh"><i style="background:${g.color}"></i><span><b>${g.name}</b> — ${['chases you directly and speeds up when few dots are left', 'aims four tiles ahead of you to cut you off', 'works with Blinky to trap you from the other side', 'chases you, but runs to his corner when he gets close'][i]}</span></div>`).join('');
        this.showModal(`
          <h2>How to play</h2>
          <p>Eat every dot to clear the maze. Avoid the ghosts. Eat an <b>energizer</b> to turn them blue, then eat them for 200, 400, 800 and 1,600 points. Bonus fruit appears twice per level.</p>
          <p><b>Keyboard:</b> arrows or WASD · P or Esc to pause · M to mute. <b>Touch:</b> swipe anywhere (or turn on the D-pad in Settings). <b>Gamepad:</b> D-pad or stick, Start to pause. Press a turn early and Pac-Man takes the corner the moment he can.</p>
          <h3>Modes</h3>
          <ul>${PM.MODE_ORDER.map(k => `<li><b>${PM.MODES[k].name}:</b> ${PM.MODES[k].desc}</li>`).join('')}</ul>
          <h3>2027 power-ups</h3><div class="pu-list">${pu}</div>
          <p>Eating dots without stopping builds a <b>combo</b>: every 20 dots raises the dot multiplier, up to x4.</p>
          <h3>Level events</h3>
          <ul>${Object.keys(PM.EVENTS).filter(k => k !== 'none').map(k => `<li><b>${PM.EVENTS[k].name}:</b> ${PM.EVENTS[k].desc}</li>`).join('')}</ul>
          <h3>Know your ghosts</h3>${gh}
          <p>Tip: turn on <b>Show ghost targets</b> in Settings to see where each ghost is heading.</p>`);
      } else if (which === 'settings') {
        const s = p.settings;
        const sw = (id, on) => `<button class="switch${on ? ' on' : ''}" id="${id}" aria-pressed="${on}"></button>`;
        this.showModal(`
          <h2>Settings</h2>
          <div class="set" style="display:block">Name<input id="s-name" class="text-in" maxlength="10" value="${esc(p.name)}" style="margin-top:8px" autocomplete="off" spellcheck="false"></div>
          <div class="set">Sound effects${sw('s-sound', s.sound)}</div>
          <div class="set">Menu music${sw('s-music', s.music)}</div>
          <div class="set">Volume<input type="range" id="s-vol" min="0" max="1" step="0.05" value="${s.volume}"></div>
          <div class="set">Touch controls<span class="seg" id="s-ctrl">${[['auto', 'Auto'], ['swipe', 'Swipe'], ['dpad', 'D-pad']].map(([v, l]) => `<button data-v="${v}" class="${s.controls === v ? 'sel' : ''}">${l}</button>`).join('')}</span></div>
          <div class="set">Show ghost targets (training)${sw('s-targets', s.targets)}</div>
          <div class="set">Screen shake & particles${sw('s-motion', s.motion)}</div>
          <div class="set">Progress<button class="btn small ghost" id="s-reset">Reset everything</button></div>`);
        $('s-name').addEventListener('input', e => { p.name = e.target.value.toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 10); this.save(); this.renderProfile(); });
        const tog = (id, key) => { $(id).onclick = () => { s[key] = !s[key]; $(id).classList.toggle('on', s[key]); this.save(); this.applySettings(); }; };
        tog('s-sound', 'sound'); tog('s-music', 'music'); tog('s-targets', 'targets'); tog('s-motion', 'motion');
        $('s-vol').oninput = e => { s.volume = Number(e.target.value); PM.Audio.setVolume(s.volume); this.save(); };
        $('s-ctrl').onclick = e => { const b = e.target.closest('button'); if (!b) return; s.controls = b.dataset.v; $('s-ctrl').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); this.save(); this.layout(); };
        let armed = false;
        $('s-reset').onclick = e => {
          if (!armed) { armed = true; e.target.textContent = 'Tap again to confirm'; return; }
          this.p = PM.Store.reset(); this.ensureMissions(); this.save(); this.applySettings(); this.renderMenu(); this.renderProfile(); this.closeModal(true); this.toast('Progress reset');
        };
      } else if (which === 'scores') {
        this.scoresTab = this.scoresTab || p.mode;
        const render = () => {
          const mode = this.scoresTab;
          const rows = p.scores[mode].map(x => ({ name: x.name, score: x.score, level: x.level, me: true }))
            .concat(PM.CPU_SCORES[mode].map(([n, sc]) => ({ name: n, score: sc, cpu: true })))
            .sort((a, b) => b.score - a.score).slice(0, 10);
          $('sc-body').innerHTML = `<table class="table"><tr><th>#</th><th>NAME</th><th class="num">LEVEL</th><th class="num">SCORE</th></tr>${rows.map((r, i) =>
            `<tr class="${r.me ? 'me' : 'cpu'}"><td>${i + 1}</td><td>${esc(r.name)}${r.cpu ? ' <small>🤖 CPU</small>' : ''}</td><td class="num">${r.level || '–'}</td><td class="num">${fmt(r.score)}</td></tr>`).join('')}</table>`;
          $('sc-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.m === mode));
        };
        this.showModal(`<h2>High scores</h2><div class="tabs" id="sc-tabs">${PM.MODE_ORDER.map(m => `<button data-m="${m}">${PM.MODES[m].name}</button>`).join('')}</div><div id="sc-body"></div>
          <p style="font-size:12px">Scores are saved in this browser. 🤖 CPU entries are arcade legends to beat.</p>`);
        $('sc-tabs').onclick = e => { const b = e.target.closest('button'); if (b) { this.scoresTab = b.dataset.m; render(); } };
        render();
      } else if (which === 'missions') {
        this.ensureMissions();
        p.missions.seen = PM.dateKey(); this.save(); this.renderMenu();
        const ms = p.missions.list;
        this.showModal(`<h2>Daily missions</h2>
          ${ms.map(m => `<div class="mission${m.done ? ' done' : ''}"><span style="font-size:22px">${m.done ? '✅' : '🎯'}</span><span class="mtxt"><b>${esc(this.missionText(m))}</b><span class="bar"><i style="width:${Math.min(100, m.progress / m.n * 100)}%"></i></span></span><span class="rw">${m.done ? 'DONE' : '+' + m.reward + '🪙'}</span></div>`).join('')}
          <p>New missions every day. Progress counts in every mode; coins are added automatically when a mission is done.</p>
          <h3>Daily Run</h3><p>Streak: <b>${p.daily.streak} day${p.daily.streak === 1 ? '' : 's'}</b> 🔥 · Today: ${p.daily.history[PM.dateKey()] ? fmt(p.daily.history[PM.dateKey()].score) + ' points' : 'not played yet'}</p>`);
      } else if (which === 'profile') {
        const s = p.stats, lvl = PM.levelOf(p.xp);
        this.showModal(`<h2>${esc(p.name || 'PLAYER')}</h2>
          <div class="lvl"><span>Lv ${lvl} · ${PM.titleOf(lvl)}</span><span class="xpbar"><i style="width:${Math.round((p.xp - PM.xpFor(lvl)) / (PM.xpFor(lvl + 1) - PM.xpFor(lvl)) * 100)}%"></i></span><span>${fmt(p.xp)} XP</span></div>
          <div class="kpis">
            ${[[s.games, 'Games'], [fmt(s.dots), 'Dots'], [fmt(s.ghosts), 'Ghosts'], [s.fruits, 'Fruits'], [s.levels, 'Levels cleared'], [s.bestLevel, 'Best level'], [s.battleWins + '/' + s.battles, 'Battles won'], [Math.round(s.time / 60) + 'm', 'Play time']]
              .map(k => `<div class="kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('')}
          </div>
          <h3>Achievements · ${Object.keys(p.ach).length}/${PM.ACHIEVEMENTS.length}</h3>
          <div class="ach-grid">${PM.ACHIEVEMENTS.map(a => `<div class="ach${p.ach[a.id] ? ' got' : ''}"><span class="i">${a.icon}</span><span><b>${a.name}</b><small>${a.desc}</small></span></div>`).join('')}</div>
          <div class="row-btns"><button class="btn" data-open2="settings">Change name</button></div>`);
        $('modal-body').querySelector('[data-open2]').onclick = () => this.open('settings');
      } else if (which === 'garage') this.openGarage();
    },

    /* ---------------- garage & shop ---------------- */
    unlockState(cat, item) {
      const p = this.p;
      if (p.owned[cat].includes(item.id)) return { owned: true };
      if (!item.unlock) return { owned: true };
      if (item.unlock.coins) return { price: item.unlock.coins };
      const a = PM.ACHIEVEMENTS.find(x => x.id === item.unlock.ach);
      if (p.ach[item.unlock.ach]) { p.owned[cat].push(item.id); return { owned: true }; }
      return { ach: a };
    },
    openGarage() {
      this.garageTab = this.garageTab || 'color';
      this.showModal(`<h2>Garage</h2>
        <div class="garage-top"><canvas id="g-prev" width="120" height="120"></canvas>
          <div><p style="margin:0">Spend coins from games and missions. Some items unlock with achievements.</p><p class="coins" style="display:inline-block;margin:8px 0 0" id="g-coins"></p></div></div>
        <div class="tabs" id="g-tabs">${PM.GARAGE_TABS.map(([k, l]) => `<button data-t="${k}">${l}</button>`).join('')}</div>
        <div class="items" id="g-items"></div>`);
      $('g-tabs').onclick = e => { const b = e.target.closest('button'); if (b) { this.garageTab = b.dataset.t; this.renderGarage(); } };
      $('g-items').onclick = e => { const b = e.target.closest('.item'); if (b) this.garageClick(b); };
      this.renderGarage();
      this.garageTimer = setInterval(() => { if ($('g-prev')) this.drawPacPreview($('g-prev'), 120, this.equipColor(), this.p.equip.hat, this.p.equip.trail); }, 100);
    },
    renderGarage() {
      const p = this.p, cat = this.garageTab;
      $('g-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.t === cat));
      $('g-coins').textContent = '🪙 ' + fmt(p.coins);
      $('g-items').innerHTML = PM.CATALOG[cat].map(it => {
        const st = this.unlockState(cat, it), eq = p.equip[cat] === it.id;
        const tag = st.owned ? (eq ? 'Equipped' : 'Owned') : st.price ? `<small class="price">🪙 ${fmt(st.price)}</small>` : `<small>🏆 ${esc(st.ach.name)}</small>`;
        return `<button class="item${eq ? ' eq' : ''}${st.owned ? '' : ' locked'}" data-id="${it.id}"><canvas data-c="${cat}" data-i="${it.id}"></canvas>${esc(it.name)}${st.owned ? `<small>${tag}</small>` : tag}</button>`;
      }).join('');
      $('g-items').querySelectorAll('canvas').forEach(c => {
        const i = c.dataset.i;
        if (cat === 'color') this.drawPacPreview(c, 54, this.equipColor(i), 'none');
        else if (cat === 'hat') this.drawPacPreview(c, 54, this.equipColor(), i);
        else if (cat === 'trail') this.drawPacPreview(c, 54, this.equipColor(), 'none', i);
        else this.drawPacPreview(c, 54, null, null, null, i);
      });
      this.drawPacPreview($('g-prev'), 120, this.equipColor(), p.equip.hat, p.equip.trail);
      this.renderProfile();
    },
    garageClick(btn) {
      const p = this.p, cat = this.garageTab, it = PM.CATALOG[cat].find(x => x.id === btn.dataset.id);
      const st = this.unlockState(cat, it);
      if (st.owned) { p.equip[cat] = it.id; PM.Audio.sfx('click'); }
      else if (st.price) {
        if (p.coins < st.price) { this.nope(btn, 'Need ' + fmt(st.price - p.coins) + ' more coins'); return; }
        p.coins -= st.price; p.owned[cat].push(it.id); p.equip[cat] = it.id;
        PM.Audio.sfx('coin'); this.toast('Unlocked ' + it.name + '!', 'gold');
      } else { this.nope(btn, 'Unlock: ' + st.ach.desc); return; }
      this.save(); this.renderGarage(); this.renderMenu();
    },
    nope(btn, msg) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); PM.Audio.sfx('hurt'); this.toast(msg); }
  };

  PM.App = App;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.boot());
  else App.boot();
})(window.PM = window.PM || {});
