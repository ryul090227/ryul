/* =========================================================
 * 게임 세션: 타이밍 판정, 점수, 목숨, 음악 스케줄링
 * ========================================================= */

const JUDGE = { perfect: 0.045, great: 0.09, good: 0.14 };
const EARLY_IGNORE = 0.3; // 이보다 더 일찍 누르면 무시
const MAX_LIVES = 9;      // 고양이는 목숨이 아홉 개!

const GRADE_INFO = {
  perfect: { label: 'Purrfect!', score: 300, color: '#ff6fa8' },
  great:   { label: 'Nice!',     score: 200, color: '#56b8ff' },
  good:    { label: 'Good',      score: 100, color: '#7fd37f' },
  miss:    { label: 'Miss…',     score: 0,   color: '#a69fb3' },
};

class Session {
  /**
   * @param level  LEVELS의 항목
   * @param opts   { audio, demo, auto, offsetMs, onEnd }
   */
  constructor(level, opts = {}) {
    this.level = level;
    this.chart = buildChart(level);
    this.audio = opts.audio || null;
    this.demo = !!opts.demo;
    this.auto = !!opts.auto;
    this.offset = (opts.offsetMs || 0) / 1000;
    this.onEnd = opts.onEnd || null;

    this.judged = 0; // 마지막으로 판정이 끝난 칸
    this.lives = MAX_LIVES;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.scoreSum = 0;
    this.tileState = new Array(this.chart.tiles.length).fill(null);
    this.tileState[0] = { grade: 'start', time: 0 };
    this.events = [];
    this.earlyFlag = -1;

    this.started = false;
    this.paused = false;
    this.ended = false;
    this.result = null;
    this.beatPtr = 0;
    this.visBeatPtr = 0;
  }

  get totalNotes() { return this.chart.tiles.length - 1; }

  start() {
    const lead = (COUNT_IN * 60) / this.level.bpm;
    if (this.audio) {
      this.audio.ensure();
      this.bus = this.audio.createBus();
      this.audioStart = this.audio.now + 0.35 + lead;
    } else {
      this.perfStart = performance.now() / 1000 + (this.demo ? 0.8 : 0.35 + lead);
    }
    this.started = true;
  }

  stop() {
    if (this.bus) {
      const g = this.bus.gain;
      g.setTargetAtTime(0, this.audio.now, 0.05);
      const bus = this.bus;
      setTimeout(() => bus.disconnect(), 400);
      this.bus = null;
    }
  }

  songTime() {
    if (!this.started) return -10;
    if (this.audio) return this.audio.now - this.audioStart;
    const now = this.paused ? this.pausedAt : performance.now() / 1000;
    return now - this.perfStart;
  }

  /** 판정/화면에 쓰는 시간 (오프셋 보정 적용) */
  t() { return this.songTime() - this.offset; }

  pause() {
    if (this.paused || this.ended) return;
    this.paused = true;
    this.pausedAt = performance.now() / 1000;
    if (this.audio) this.audio.ctx.suspend();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.audio) this.audio.ctx.resume();
    else this.perfStart += performance.now() / 1000 - this.pausedAt;
  }

  update() {
    if (!this.started || this.paused) return;
    const st = this.songTime();
    if (this.audio && this.bus) this.scheduleMusic(st);
    if (this.ended) return;

    const t = st - this.offset;
    const tiles = this.chart.tiles;
    while (this.judged < tiles.length - 1 && !this.ended) {
      const next = tiles[this.judged + 1];
      if (this.auto && t >= next.time) { this.hit(0, next.time); continue; }
      if (t > next.time + JUDGE.good) { this.miss(t); continue; }
      break;
    }
    if (!this.ended && this.judged === tiles.length - 1 && t > this.chart.endTime + 0.6) {
      this.finish(true);
    }
  }

  /** 플레이어 입력 */
  press() {
    if (!this.started || this.paused || this.ended || this.auto) return;
    const tiles = this.chart.tiles;
    if (this.judged >= tiles.length - 1) return;
    const t = this.t();
    const idx = this.judged + 1;
    const dt = t - tiles[idx].time;
    if (dt < -JUDGE.good) {
      if (dt > -EARLY_IGNORE && this.earlyFlag !== idx) {
        this.earlyFlag = idx;
        this.events.push({ type: 'early', tile: idx });
      }
      return;
    }
    this.hit(dt, t);
  }

  hit(dt, t) {
    const a = Math.abs(dt);
    const grade = a <= JUDGE.perfect ? 'perfect' : a <= JUDGE.great ? 'great' : 'good';
    const idx = ++this.judged;
    this.counts[grade]++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.scoreSum += GRADE_INFO[grade].score;
    this.tileState[idx] = { grade, time: t, dt };
    this.events.push({ type: 'hit', tile: idx, grade, dt });
    if (this.audio && this.bus) this.audio.pluck(this.audio.now, this.noteFreq(idx), this.bus);
  }

  miss(t) {
    const idx = ++this.judged;
    this.counts.miss++;
    this.combo = 0;
    this.lives--;
    this.tileState[idx] = { grade: 'miss', time: t };
    this.events.push({ type: 'miss', tile: idx });
    if (this.audio && this.bus) this.audio.missSfx(this.audio.now, this.bus);
    if (this.lives <= 0) this.finish(false);
  }

  finish(cleared) {
    if (this.ended) return;
    this.ended = true;
    const done = Math.max(1, this.judged);
    const accuracy = this.scoreSum / (300 * (cleared ? this.totalNotes : done));
    const fullCombo = cleared && this.counts.miss === 0;
    const allPerfect = fullCombo && this.counts.perfect === this.totalNotes;
    let rank = 'D';
    if (!cleared) rank = 'F';
    else if (accuracy >= 0.95) rank = 'S';
    else if (accuracy >= 0.88) rank = 'A';
    else if (accuracy >= 0.75) rank = 'B';
    else if (accuracy >= 0.6) rank = 'C';
    this.result = {
      cleared, accuracy, rank, fullCombo, allPerfect,
      counts: { ...this.counts }, maxCombo: this.maxCombo, lives: this.lives,
    };
    if (this.audio && this.bus && cleared) this.audio.meow(this.audio.now + 0.05, 1, this.bus);
    if (this.onEnd) this.onEnd(this.result);
  }

  /* ---------- 음악 ---------- */
  noteFreq(idx) {
    const mel = this.level.melody;
    const deg = mel[(idx - 1) % mel.length];
    return mtof(degreeToMidi(this.level.key + 12, deg));
  }

  scheduleMusic(st) {
    const beats = this.chart.beats;
    const look = 0.12;
    while (this.beatPtr < beats.length && beats[this.beatPtr].time < st + look) {
      const b = beats[this.beatPtr++];
      const at = this.audioStart + b.time;
      if (at < this.audio.now - 0.02) continue;
      this.playBeat(b, at);
    }
  }

  playBeat(b, at) {
    const A = this.audio, out = this.bus;
    const m = this.level.music || {};
    if (b.index < 0) { A.tick(at, b.index === -COUNT_IN, out); return; }
    const inBar = b.index % 4;
    const bar = Math.floor(b.index / 4);
    const prog = this.level.progression;
    const deg = prog[bar % prog.length];
    const root = this.level.key;

    if (m.four || inBar === 0 || inBar === 2) A.kick(at, out);
    if (m.clap && (inBar === 1 || inBar === 3)) A.clap(at, out);
    if (m.hats !== false) A.hat(at + b.dur / 2, out);
    if (inBar === 0) {
      const chord = [deg, deg + 2, deg + 4].map((d) => mtof(degreeToMidi(root, d)));
      A.pad(at, chord, b.dur * 4, out);
    }
    if (inBar === 0 || inBar === 2 || inBar === 3) {
      A.bass(at, mtof(degreeToMidi(root - 24, deg)), b.dur * 0.8, out);
    }
  }

  /** 현재 박자의 진행도 (0 = 정박 직후, 1 = 다음 박 직전) — 화면 펄스용 */
  beatInfo(t) {
    const beats = this.chart.beats;
    let p = this.visBeatPtr;
    while (p < beats.length - 1 && beats[p + 1].time <= t) p++;
    while (p > 0 && beats[p].time > t) p--;
    this.visBeatPtr = p;
    const b = beats[p];
    if (!b || t < b.time) return { index: -99, phase: 1 };
    return { index: b.index, phase: Math.min(1, (t - b.time) / b.dur) };
  }
}
