/* PAC-MAN 2027* — keyboard, swipe, on-screen D-pad and gamepad */
(function (PM) {
  'use strict';
  const KEYS = { ArrowUp: 0, KeyW: 0, ArrowLeft: 1, KeyA: 1, ArrowDown: 2, KeyS: 2, ArrowRight: 3, KeyD: 3 };
  const Input = {
    onDir: null, onKey: null,
    touch: false,
    init(swipeEl) {
      this.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      addEventListener('keydown', e => {
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.code in KEYS) { e.preventDefault(); this.onDir && this.onDir(KEYS[e.code]); }
        else if (this.onKey) this.onKey(e.code, e);
      });
      // swipe anywhere on the play area; turns register as soon as the finger moves
      let sx = 0, sy = 0, active = false;
      swipeEl.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; active = true; sx = e.clientX; sy = e.clientY; }, { passive: true });
      swipeEl.addEventListener('pointermove', e => {
        if (!active) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
        const d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 0 : 2);
        this.onDir && this.onDir(d);
        sx = e.clientX; sy = e.clientY;
      }, { passive: true });
      const end = () => { active = false; };
      swipeEl.addEventListener('pointerup', end); swipeEl.addEventListener('pointercancel', end);
    },
    bindPad(el) {
      el.querySelectorAll('[data-d]').forEach(b => {
        const d = Number(b.dataset.d);
        const press = e => { e.preventDefault(); b.classList.add('on'); this.onDir && this.onDir(d); };
        b.addEventListener('pointerdown', press);
        b.addEventListener('pointerenter', e => { if (e.buttons) press(e); });
        const up = () => b.classList.remove('on');
        b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
      });
    },
    padPrev: -1, startPrev: false,
    pollGamepad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (!p) continue;
        let d = -1;
        const b = i => p.buttons[i] && p.buttons[i].pressed;
        if (b(12)) d = 0; else if (b(14)) d = 1; else if (b(13)) d = 2; else if (b(15)) d = 3;
        else if (Math.abs(p.axes[0]) > 0.5 || Math.abs(p.axes[1]) > 0.5) d = Math.abs(p.axes[0]) > Math.abs(p.axes[1]) ? (p.axes[0] < 0 ? 1 : 3) : (p.axes[1] < 0 ? 0 : 2);
        if (d >= 0 && d !== this.padPrev) this.onDir && this.onDir(d);
        this.padPrev = d;
        const start = b(9);
        if (start && !this.startPrev && this.onKey) this.onKey('Escape', {});
        this.startPrev = start;
        return;
      }
    }
  };
  PM.Input = Input;
})(window.PM = window.PM || {});
