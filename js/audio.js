/* =========================================================
 * 오디오 엔진: Web Audio로 음악/효과음을 전부 합성
 * (외부 음원 파일 없이 동작. 나중에 음원 파일로 교체 가능)
 * ========================================================= */

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function degreeToMidi(root, deg) {
  const o = Math.floor(deg / 7);
  const d = ((deg % 7) + 7) % 7;
  return root + o * 12 + MAJOR[d];
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  createBus() {
    const g = this.ctx.createGain();
    g.connect(this.master);
    return g;
  }

  _env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(t, freq, dur, { type = 'triangle', vol = 0.2, attack = 0.005, out } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    this._env(g, t, vol, attack, dur);
    o.connect(g);
    g.connect(out || this.master);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  _noise(t, dur, filterType, freq, q, vol, out) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this._env(g, t, vol, 0.002, dur);
    s.connect(f); f.connect(g); g.connect(out || this.master);
    s.start(t, Math.random() * 0.5, dur + 0.05);
  }

  kick(t, out) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    this._env(g, t, 0.75, 0.003, 0.2);
    o.connect(g); g.connect(out || this.master);
    o.start(t); o.stop(t + 0.3);
  }

  hat(t, out) { this._noise(t, 0.04, 'highpass', 8000, 0.7, 0.09, out); }
  clap(t, out) { this._noise(t, 0.11, 'bandpass', 1500, 0.9, 0.22, out); }

  tick(t, accent, out) {
    this.tone(t, accent ? 1760 : 1320, 0.06, { type: 'sine', vol: 0.18, out });
  }

  bass(t, freq, dur, out) {
    this.tone(t, freq, dur, { type: 'triangle', vol: 0.22, out });
    this.tone(t, freq / 2, dur, { type: 'sine', vol: 0.18, out });
  }

  pad(t, freqs, dur, out) {
    for (const f of freqs) this.tone(t, f, dur, { type: 'sine', vol: 0.035, attack: 0.08, out });
  }

  /* 칸을 밟을 때 나는 말랑한 소리 */
  pluck(t, freq, out) {
    this.tone(t, freq, 0.32, { type: 'triangle', vol: 0.22, out });
    this.tone(t, freq * 2, 0.16, { type: 'sine', vol: 0.07, out });
  }

  missSfx(t, out) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(130, t + 0.18);
    this._env(g, t, 0.16, 0.005, 0.2);
    o.connect(g); g.connect(out || this.master);
    o.start(t); o.stop(t + 0.3);
  }

  /* 야옹~ (톱니파 + 밴드패스로 흉내) */
  meow(t, pitch = 1, out) {
    const c = this.ctx;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480 * pitch, t);
    o.frequency.linearRampToValueAtTime(820 * pitch, t + 0.09);
    o.frequency.linearRampToValueAtTime(430 * pitch, t + 0.38);
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1600, t + 0.1);
    f.frequency.linearRampToValueAtTime(700, t + 0.38);
    this._env(g, t, 0.22, 0.04, 0.36);
    o.connect(f); f.connect(g); g.connect(out || this.master);
    o.start(t); o.stop(t + 0.5);
  }

  uiBlip() {
    if (!this.ctx) return;
    this.tone(this.now, 880, 0.08, { type: 'sine', vol: 0.12 });
  }
}
