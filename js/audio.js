/* PAC-MAN 2027* — every sound is synthesized (no audio files, no requests).
   Kept soft on purpose: triangle/sine voices through a gentle low-pass. */
(function (PM) {
  'use strict';
  const A = {
    ctx: null, on: true, musicOn: true, volume: 0.7,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.volume;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 5200; this.lp.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.lp);
      this.musicBus = c.createGain(); this.musicBus.gain.value = 0.5; this.musicBus.connect(this.lp);
      this.ambBus = c.createGain(); this.ambBus.gain.value = 0; this.ambBus.connect(this.lp);
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startAmbient();
      if (this.wantMusic) this.startMusic();
    },
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; },
    now() { return this.ctx.currentTime; },

    tone(f, dur, o) {
      if (!this.ctx || !this.on) return;
      o = o || {};
      const c = this.ctx, t = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'triangle';
      osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
      if (o.detune) osc.detune.value = o.detune;
      const v = (o.vol || 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.008));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(o.bus || this.sfxBus);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    hiss(dur, o) {
      if (!this.ctx || !this.on) return;
      o = o || {};
      const c = this.ctx, t = c.currentTime + (o.delay || 0);
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.Q.value = o.q || 1.2;
      f.frequency.setValueAtTime(o.from || 1200, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxBus);
      src.start(t); src.stop(t + dur + 0.05);
    },

    /* ---------- effects ---------- */
    wakaFlip: false, lastWaka: 0,
    sfx(name, arg) {
      if (!this.ctx || !this.on) return;
      const now = this.ctx.currentTime;
      switch (name) {
        case 'waka':
          if (now - this.lastWaka < 0.06) return;
          this.lastWaka = now;
          this.wakaFlip = !this.wakaFlip;
          this.tone(this.wakaFlip ? 420 : 300, 0.09, { to: this.wakaFlip ? 280 : 430, vol: 0.07 });
          break;
        case 'energizer': this.tone(220, 0.25, { to: 660, vol: 0.1 }); this.tone(330, 0.3, { to: 990, vol: 0.05, delay: 0.04, type: 'sine' }); break;
        case 'ghost': this.tone(240, 0.38, { to: 1150, vol: 0.12 }); this.tone(480, 0.3, { to: 1600, vol: 0.04, type: 'sine', delay: 0.05 }); break;
        case 'fruit': [784, 988, 1319].forEach((f, i) => this.tone(f, 0.12, { vol: 0.09, delay: i * 0.06, type: 'sine' })); break;
        case 'coin': this.tone(1319, 0.08, { vol: 0.07, type: 'sine' }); this.tone(1760, 0.16, { vol: 0.07, type: 'sine', delay: 0.06 }); break;
        case 'combo': this.tone(660 + (arg || 1) * 110, 0.14, { vol: 0.08, type: 'sine' }); this.tone(990 + (arg || 1) * 165, 0.18, { vol: 0.05, type: 'sine', delay: 0.05 }); break;
        case 'death':
          this.tone(760, 1.25, { to: 140, vol: 0.12, slide: 1.2 });
          this.tone(380, 1.25, { to: 70, vol: 0.05, slide: 1.2, type: 'sine', detune: 8 });
          this.tone(330, 0.09, { vol: 0.1, delay: 1.35 }); this.tone(330, 0.09, { vol: 0.1, delay: 1.5 });
          break;
        case 'hurt': this.tone(500, 0.35, { to: 150, vol: 0.1 }); break;
        case 'extraLife': [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.25, { vol: 0.07, delay: i * 0.08, type: 'sine' })); break;
        case 'clear': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, { vol: 0.09, delay: i * 0.07 })); break;
        case 'shield': this.tone(1200, 0.4, { to: 900, vol: 0.08, type: 'sine' }); this.tone(1800, 0.3, { vol: 0.04, type: 'sine', delay: 0.02 }); break;
        case 'rival': this.tone(300, 0.3, { to: 900, vol: 0.1 }); this.tone(900, 0.25, { to: 1400, vol: 0.06, delay: 0.12, type: 'sine' }); break;
        case 'spawn': this.tone(880, 0.08, { vol: 0.04, type: 'sine' }); this.tone(1320, 0.12, { vol: 0.04, type: 'sine', delay: 0.07 }); break;
        case 'click': this.tone(900, 0.04, { vol: 0.04, type: 'sine' }); break;
        case 'event': [392, 523, 659].forEach((f, i) => this.tone(f, 0.3, { vol: 0.07, delay: i * 0.1 })); break;
        case 'power':
          switch (arg) {
            case 'turbo': this.hiss(0.45, { from: 400, to: 3000, vol: 0.09 }); this.tone(300, 0.3, { to: 900, vol: 0.06 }); break;
            case 'magnet': this.tone(200, 0.5, { to: 420, vol: 0.09, type: 'sine' }); this.tone(203, 0.5, { to: 425, vol: 0.06, type: 'sine', detune: 15 }); break;
            case 'freeze': [1760, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.25, { vol: 0.04, delay: i * 0.05, type: 'sine' })); break;
            case 'shield': this.sfx('shield'); break;
            case 'shock': this.tone(110, 0.6, { to: 45, vol: 0.18, type: 'sine' }); this.hiss(0.5, { from: 800, to: 120, vol: 0.12, filter: 'lowpass' }); break;
            case 'phase': this.tone(600, 0.6, { to: 300, vol: 0.06, type: 'sine' }); this.tone(900, 0.6, { to: 450, vol: 0.04, type: 'sine', delay: 0.05 }); break;
            case 'double': this.tone(988, 0.1, { vol: 0.08 }); this.tone(1319, 0.2, { vol: 0.08, delay: 0.09 }); break;
          }
          break;
      }
    },

    // original start-up jingle (two voices, ~3.9 s)
    jingle() {
      if (!this.ctx || !this.on) return;
      const N = { G2: 98, C3: 131, D3: 147, E3: 165, F2: 87, A2: 110, G3: 196, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A4: 440, A5: 880, B5: 988, C6: 1047 };
      const e = 0.18;
      const lead = ['C5', 'E5', 'G5', 'C6', 'B4', 'D5', 'G5', 'B5', 'A4', 'C5', 'E5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5', null, 'G5', null, 'C6'];
      const bass = ['C3', null, 'G2', null, 'G2', null, 'D3', null, 'A2', null, 'E3', null, 'F2', null, 'G2', null, 'C3', null, 'G2', null, 'C3'];
      lead.forEach((n, i) => { if (n) this.tone(N[n], i === lead.length - 1 ? 0.6 : e * 0.95, { delay: i * e, vol: 0.08 }); });
      bass.forEach((n, i) => { if (n) this.tone(N[n], e * 1.8, { delay: i * e, vol: 0.09, type: 'sine' }); });
    },

    /* ---------- background loop (siren / frightened / eyes) ---------- */
    startAmbient() {
      const c = this.ctx;
      this.amb = c.createOscillator(); this.amb.type = 'triangle'; this.amb.frequency.value = 300;
      this.lfo = c.createOscillator(); this.lfo.frequency.value = 3;
      this.lfoGain = c.createGain(); this.lfoGain.gain.value = 40;
      this.lfo.connect(this.lfoGain); this.lfoGain.connect(this.amb.frequency);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      this.amb.connect(f); f.connect(this.ambBus);
      this.amb.start(); this.lfo.start();
      this.ambKind = null;
    },
    setAmbient(kind, progress) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const target = !this.on || !kind ? 0 : kind === 'siren' ? 0.022 : kind === 'fright' ? 0.03 : 0.022;
      this.ambBus.gain.setTargetAtTime(target, t, 0.08);
      if (!kind) { this.ambKind = null; return; }
      if (kind === 'siren') {
        const base = 260 + (progress || 0) * 200;
        this.amb.frequency.setTargetAtTime(base, t, 0.3);
        this.lfo.frequency.setTargetAtTime(2.6 + (progress || 0) * 2.4, t, 0.3);
        this.lfoGain.gain.setTargetAtTime(base * 0.16, t, 0.3);
      } else if (kind === 'fright') {
        this.amb.frequency.setTargetAtTime(190, t, 0.05);
        this.lfo.frequency.setTargetAtTime(9, t, 0.05);
        this.lfoGain.gain.setTargetAtTime(45, t, 0.05);
      } else if (kind === 'eyes') {
        this.amb.frequency.setTargetAtTime(820, t, 0.05);
        this.lfo.frequency.setTargetAtTime(11, t, 0.05);
        this.lfoGain.gain.setTargetAtTime(260, t, 0.05);
      }
      this.ambKind = kind;
    },

    /* ---------- menu music: a calm synthwave loop (original) ---------- */
    startMusic() {
      this.wantMusic = true;
      if (!this.ctx || this.musicTimer || !this.musicOn) return;
      const bpm = 104, step = 60 / bpm / 2;
      const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
      const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
      let i = 0, next = this.ctx.currentTime + 0.1;
      const tick = () => {
        if (!this.ctx) return;
        while (next < this.ctx.currentTime + 0.25) {
          const bar = Math.floor(i / 8) % 4, ch = chords[bar], s = i % 8;
          const arp = ch[[0, 1, 2, 1, 0, 2, 1, 2][s]] + 12;
          const d = Math.max(0, next - this.ctx.currentTime);
          if (this.on && this.musicOn) {
            this.tone(mtof(arp), step * 0.9, { delay: d, vol: 0.035, bus: this.musicBus, type: 'triangle' });
            if (s === 0) this.tone(mtof(ch[0] - 12), step * 7.5, { delay: d, vol: 0.05, bus: this.musicBus, type: 'sine', attack: 0.05 });
            if (s === 0 || s === 4) ch.forEach(n => this.tone(mtof(n), step * 3.6, { delay: d, vol: 0.012, bus: this.musicBus, type: 'sine', attack: 0.12 }));
          }
          next += step; i++;
        }
      };
      this.musicTimer = setInterval(tick, 90);
      tick();
    },
    stopMusic() {
      this.wantMusic = false;
      if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    }
  };
  PM.Audio = A;
})(window.PM = window.PM || {});
