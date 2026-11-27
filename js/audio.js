/* =========================================================
 * 오디오 엔진: Web Audio로 악기/드럼을 실시간 합성
 *   (외부 음원 없음. 나중에 실제 음원 파일로 교체 가능)
 * ========================================================= */

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.8;
    this.sfxVol = 0.7;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = (this.ctx = new AC({ latencyHint: 'interactive' }));
      this.master = c.createGain();
      this.master.gain.value = 0.8;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 8;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master.connect(comp);
      comp.connect(c.destination);

      this.sfx = c.createGain();
      this.sfx.gain.value = this.sfxVol;
      this.sfx.connect(this.master);

      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      // 리버브 임펄스 (스테레오 감쇠 노이즈)
      const rl = Math.floor(c.sampleRate * 2.4);
      this.impulse = c.createBuffer(2, rl, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const a = this.impulse.getChannelData(ch);
        for (let i = 0; i < rl; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2);
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setMusicVolume(v) { this.musicVol = v; }
  setSfxVolume(v) { this.sfxVol = v; if (this.sfx) this.sfx.gain.value = v; }

  /* 곡 하나를 위한 믹서 (세션마다 새로 만들고 끝나면 통째로 끊음) */
  createMix(beatSec) {
    const c = this.ctx;
    const g = (v = 1) => { const n = c.createGain(); n.gain.value = v; return n; };
    const m = { bus: g(this.musicVol) };
    m.bus.connect(this.master);
    m.drums = g(1); m.drums.connect(m.bus);
    m.duck = g(1); m.duck.connect(m.bus);           // 패드/아르페지오 (사이드체인용)
    m.pad = g(1); m.pad.connect(m.duck);
    m.arp = c.createStereoPanner ? c.createStereoPanner() : g(1);
    if (m.arp.pan) m.arp.pan.value = 0.22;
    m.arp.connect(m.duck);
    m.lead = g(1); m.lead.connect(m.bus);
    m.bass = g(1); m.bass.connect(m.bus);

    m.rev = g(1);
    const conv = c.createConvolver();
    conv.buffer = this.impulse;
    const revOut = g(0.32);
    m.rev.connect(conv); conv.connect(revOut); revOut.connect(m.bus);

    m.dly = g(1);
    const delay = c.createDelay(2);
    delay.delayTime.value = Math.min(1.9, beatSec * 0.75);
    const fb = g(0.32);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2800;
    const dOut = g(0.28);
    m.dly.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(dOut); dOut.connect(m.bus);
    return m;
  }

  /* ---------- 기본 부품 ---------- */
  _gain(t, peak, a, d, out) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(out);
    return g;
  }

  _adsr(t, dur, peak, a, d, s, r, out) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, d / 3);
    const end = Math.max(t + a, t + dur);
    g.gain.setTargetAtTime(0, end, r / 3);
    g.connect(out);
    return { g, stop: end + r + 0.05 };
  }

  _osc(type, freq, t, stop, dest, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  }

  _noise(t, dur, type, freq, q, vol, out) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f);
    f.connect(this._gain(t, vol, 0.001, dur, out));
    s.start(t, Math.random() * 0.4, dur + 0.05);
  }

  _send(node, m, rev = 0, dly = 0) {
    if (rev) { const g = this.ctx.createGain(); g.gain.value = rev; node.connect(g); g.connect(m.rev); }
    if (dly) { const g = this.ctx.createGain(); g.gain.value = dly; node.connect(g); g.connect(m.dly); }
  }

  /* ---------- 드럼 ---------- */
  kick(t, vel, m) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    o.connect(this._gain(t, 0.85 * vel, 0.002, 0.24, m.drums));
    o.start(t); o.stop(t + 0.3);
    this._noise(t, 0.012, 'highpass', 3000, 0.7, 0.18 * vel, m.drums);
  }

  snare(t, vel, m) {
    this._noise(t, 0.15, 'bandpass', 2000, 0.6, 0.38 * vel, m.drums);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const g = this._gain(t, 0.28 * vel, 0.002, 0.09, m.drums);
    o.connect(g); o.start(t); o.stop(t + 0.15);
    this._send(g, m, 0.25);
  }

  clap(t, vel, m) {
    for (let i = 0; i < 3; i++) this._noise(t + i * 0.011, 0.02, 'bandpass', 1300, 0.9, 0.3 * vel, m.drums);
    this._noise(t + 0.033, 0.14, 'bandpass', 1200, 0.8, 0.26 * vel, m.drums);
  }

  hat(t, vel, m) { this._noise(t, 0.035, 'highpass', 8500, 0.8, 0.12 * vel, m.drums); }
  openHat(t, vel, m) { this._noise(t, 0.22, 'highpass', 7500, 0.8, 0.09 * vel, m.drums); }

  crash(t, vel, m) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 4200;
    const g = this._gain(t, 0.16 * vel, 0.003, 1.6, m.drums);
    s.connect(f); f.connect(g);
    this._send(g, m, 0.3);
    s.start(t); s.stop(t + 1.7);
  }

  /* ---------- 악기 ---------- */
  inst(name, t, midi, dur, vel, m, out) {
    const f = mtof(midi);
    const dest = out || m.lead;
    switch (name) {
      case 'bell': return this.bell(t, f, dur, vel, m, dest);
      case 'pluck': return this.pluck(t, f, dur, vel, m, dest);
      case 'square': return this.squareLead(t, f, dur, vel, m, dest);
      case 'chip': return this.chip(t, f, dur, vel, m, dest);
      default: return this.pluck(t, f, dur, vel, m, dest);
    }
  }

  // 오르골 같은 FM 벨
  bell(t, f, dur, vel, m, dest) {
    const c = this.ctx;
    const len = Math.max(0.6, Math.min(1.6, dur + 0.6));
    const g = this._gain(t, 0.2 * vel, 0.004, len, dest);
    const car = this._osc('sine', f, t, t + len + 0.1, g);
    const mod = c.createOscillator();
    mod.frequency.value = f * 3.5;
    const mg = c.createGain();
    mg.gain.setValueAtTime(f * 1.6, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 0.5);
    mod.connect(mg); mg.connect(car.frequency);
    mod.start(t); mod.stop(t + len + 0.1);
    this._osc('sine', f * 2, t, t + 0.4, this._gain(t, 0.05 * vel, 0.002, 0.3, dest));
    this._send(g, m, 0.45, 0.15);
  }

  // 통통 튀는 플럭
  pluck(t, f, dur, vel, m, dest) {
    const c = this.ctx;
    const len = Math.min(0.45, dur + 0.15);
    const g = this._gain(t, 0.16 * vel, 0.003, len, dest);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(5200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + len);
    lp.connect(g);
    this._osc('square', f, t, t + len + 0.05, lp);
    this._osc('triangle', f * 2, t, t + len + 0.05, lp, 4);
    this._send(g, m, 0.2, 0.25);
  }

  // 반짝이는 스퀘어 리드 (비브라토)
  squareLead(t, f, dur, vel, m, dest) {
    const c = this.ctx;
    const { g, stop } = this._adsr(t, dur * 0.95, 0.075 * vel, 0.008, 0.12, 0.65, 0.12, dest);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 1;
    lp.connect(g);
    const o1 = this._osc('square', f, t, stop, lp, -6);
    const o2 = this._osc('sawtooth', f, t, stop, lp, 7);
    if (dur > 0.3) {
      const lfo = c.createOscillator();
      lfo.frequency.value = 5.5;
      const lg = c.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(14, t + 0.35);
      lfo.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune);
      lfo.start(t); lfo.stop(stop);
    }
    this._send(g, m, 0.28, 0.3);
  }

  // 8비트 칩튠
  chip(t, f, dur, vel, m, dest) {
    const { g, stop } = this._adsr(t, Math.min(dur * 0.85, 0.5), 0.06 * vel, 0.002, 0.08, 0.7, 0.05, dest);
    this._osc('square', f, t, stop, g);
    this._osc('square', f * 2, t, stop, this._gain(t, 0.015 * vel, 0.002, 0.08, dest));
    this._send(g, m, 0.15, 0.25);
  }

  pad(t, notes, dur, m) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.5;
    const { g, stop } = this._adsr(t, dur, 0.05, 0.35, 0.5, 0.85, 0.6, m.pad);
    lp.connect(g);
    for (const n of notes) {
      const f = mtof(n);
      this._osc('sawtooth', f, t, stop, lp, -9);
      this._osc('sawtooth', f, t, stop, lp, 9);
    }
    this._send(g, m, 0.6);
  }

  bass(t, midi, dur, m) {
    const c = this.ctx;
    const f = mtof(midi);
    const { g, stop } = this._adsr(t, dur, 0.22, 0.004, 0.15, 0.7, 0.05, m.bass);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    lp.connect(g);
    this._osc('sawtooth', f, t, stop, lp);
    this._osc('sine', f, t, stop, g);
  }

  duck(t, beatSec, m) {
    const p = m.duck.gain;
    p.setValueAtTime(0.35, t);
    p.linearRampToValueAtTime(1, t + beatSec * 0.6);
  }

  /* ---------- 효과음 ---------- */
  tick(t, accent, out) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = accent ? 1760 : 1320;
    o.connect(this._gain(t, 0.22, 0.002, 0.06, out || this.sfx));
    o.start(t); o.stop(t + 0.1);
  }

  /* 발판 밟는 소리: 톡! */
  tap(t, grade) {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    const f = grade === 'perfect' ? 1500 : 1200;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.04);
    o.connect(this._gain(t, 0.3, 0.001, 0.06, this.sfx));
    o.start(t); o.stop(t + 0.1);
    this._noise(t, 0.01, 'highpass', 5000, 0.7, 0.12, this.sfx);
  }

  missSfx(t) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.2);
    o.connect(this._gain(t, 0.22, 0.004, 0.22, this.sfx));
    o.start(t); o.stop(t + 0.3);
  }

  /* 야옹~ */
  meow(t, pitch = 1) {
    const c = this.ctx;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480 * pitch, t);
    o.frequency.linearRampToValueAtTime(820 * pitch, t + 0.09);
    o.frequency.linearRampToValueAtTime(430 * pitch, t + 0.38);
    f.type = 'bandpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1600, t + 0.1);
    f.frequency.linearRampToValueAtTime(700, t + 0.38);
    o.connect(f); f.connect(this._gain(t, 0.25, 0.04, 0.36, this.sfx));
    o.start(t); o.stop(t + 0.5);
  }

  uiBlip() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 880;
    o.connect(this._gain(this.now, 0.12, 0.002, 0.08, this.sfx));
    o.start(); o.stop(this.now + 0.12);
  }
}
