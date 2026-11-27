/* =========================================================
 * 게임 세션: 타이밍 판정, 점수, 목숨, 음악 스케줄링
 * ========================================================= */

const JUDGE = { perfect: 0.042, great: 0.08, good: 0.12 };
const EARLY_RANGE = 0.12; // 판정 창보다 이만큼 더 일찍 누르면 "너무 빨라!" (콤보 끊김)

const GRADE_INFO = {
  perfect: { label: 'Purrfect!', score: 300, color: '#ff5f9e' },
  great:   { label: 'Nice!',     score: 200, color: '#4aaeff' },
  good:    { label: 'Good',      score: 100, color: '#62c66e' },
  miss:    { label: 'Miss…',     score: 0,   color: '#a69fb3' },
};

class Session {
  /**
   * @param level  LEVELS 항목
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
    this.maxLives = level.lives || 9;

    this.judged = 0;
    this.lives = this.maxLives;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, early: 0 };
    this.scoreSum = 0;
    this.tileState = new Array(this.chart.tiles.length).fill(null);
    this.tileState[0] = { grade: 'start', time: 0 };
    this.events = [];
    this.lastJudgeTime = -99;
    this.earlyFlag = -1;

    this.started = false;
    this.paused = false;
    this.ended = false;
    this.result = null;
    this.evPtr = 0;
  }

  get totalNotes() { return this.chart.tiles.length - 1; }

  start() {
    const lead = this.chart.timeAt(0) - this.chart.timeAt(-COUNT_IN);
    if (this.audio) {
      this.audio.ensure();
      this.mix = this.audio.createMix(60 / this.level.song.bpm);
      this.audioStart = this.audio.now + 0.4 + lead;
    } else {
      this.perfStart = performance.now() / 1000 + 0.4 + lead;
    }
    this.started = true;
  }

  stop() {
    if (this.mix) {
      const bus = this.mix.bus;
      bus.gain.setTargetAtTime(0, this.audio.now, 0.06);
      setTimeout(() => bus.disconnect(), 500);
      this.mix = null;
    }
  }

  songTime() {
    if (!this.started) return -99;
    if (this.audio) return this.audio.now - this.audioStart;
    const now = this.paused ? this.pausedAt : performance.now() / 1000;
    return now - this.perfStart;
  }

  /** 판정/화면용 시간 (싱크 보정 적용) */
  t() { return this.songTime() - this.offset; }
  beatNow() { return this.chart.beatAt(this.t()); }

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

  win(idx) { return this.chart.tiles[idx].win || 1; }

  update() {
    if (!this.started || this.paused) return;
    const st = this.songTime();
    if (this.mix) this.scheduleMusic(st);
    if (this.ended) return;

    const t = st - this.offset;
    const tiles = this.chart.tiles;
    while (this.judged < tiles.length - 1 && !this.ended) {
      const idx = this.judged + 1;
      const next = tiles[idx];
      if (this.auto && t >= next.time) { this.hit(0, next.time); continue; }
      if (t > next.time + JUDGE.good * this.win(idx)) { this.miss(t); continue; }
      break;
    }
    if (!this.ended && this.judged === tiles.length - 1 && t > this.chart.endTime + 1.2) this.finish(true);
  }

  /** 플레이어 입력 */
  press() {
    if (!this.started || this.paused || this.ended || this.auto) return;
    const tiles = this.chart.tiles;
    if (this.judged >= tiles.length - 1) return;
    const t = this.t();
    const idx = this.judged + 1;
    const w = this.win(idx);
    const dt = t - tiles[idx].time;
    if (dt < -JUDGE.good * w) {
      if (dt > -JUDGE.good * w - EARLY_RANGE && this.earlyFlag !== idx && t > 0) {
        this.earlyFlag = idx;
        this.combo = 0;
        this.counts.early++;
        this.events.push({ type: 'early', tile: idx });
      }
      return;
    }
    this.hit(dt, t);
  }

  hit(dt, t) {
    const idx = ++this.judged;
    const w = this.win(idx);
    const a = Math.abs(dt);
    const grade = a <= JUDGE.perfect * w ? 'perfect' : a <= JUDGE.great * w ? 'great' : 'good';
    this.counts[grade]++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.scoreSum += GRADE_INFO[grade].score;
    this.tileState[idx] = { grade, time: t, dt };
    this.lastJudgeTime = t;
    this.events.push({ type: 'hit', tile: idx, grade, dt });
    if (this.audio && !this.demo) this.audio.tap(this.audio.now, grade);
  }

  miss(t) {
    const idx = ++this.judged;
    this.counts.miss++;
    this.combo = 0;
    this.lives--;
    this.tileState[idx] = { grade: 'miss', time: t };
    this.lastJudgeTime = t;
    this.events.push({ type: 'miss', tile: idx });
    if (this.audio && !this.demo) this.audio.missSfx(this.audio.now);
    if (this.lives <= 0) this.finish(false);
  }

  finish(cleared) {
    if (this.ended) return;
    this.ended = true;
    this.endTime = this.t();
    const done = Math.max(1, this.judged);
    const accuracy = this.scoreSum / (300 * (cleared ? this.totalNotes : done));
    const fullCombo = cleared && this.counts.miss === 0 && this.counts.early === 0;
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
      progress: this.judged / this.totalNotes,
    };
    if (!cleared && this.mix) {
      // 실패하면 음악이 축 늘어지며 꺼짐
      this.mix.bus.gain.setTargetAtTime(0, this.audio.now + 0.1, 0.4);
    }
    if (this.audio && cleared && !this.demo) this.audio.meow(this.audio.now + 0.15, 1);
    if (this.onEnd) this.onEnd(this.result);
  }

  /* ---------- 음악 ---------- */
  scheduleMusic(st) {
    const ev = this.chart.events;
    const look = 0.15;
    const A = this.audio, m = this.mix;
    const pump = this.level.song.pump;
    while (this.evPtr < ev.length) {
      const e = ev[this.evPtr];
      const et = this.chart.timeAt(e.beat);
      if (et > st + look) break;
      this.evPtr++;
      const at = this.audioStart + et;
      if (at < A.now - 0.03) continue;
      const bsec = 60 / this.chart.tempo.bpmAt(Math.max(0, e.beat));
      const dsec = (e.dur || 0) * bsec;
      switch (e.type) {
        case 'tick': if (!this.demo) A.tick(at, e.accent, m.bus); break;
        case 'k': A.kick(at, e.vel, m); if (pump) A.duck(at, bsec, m); break;
        case 's': A.snare(at, e.vel, m); break;
        case 'c': A.clap(at, e.vel, m); break;
        case 'h': A.hat(at, e.vel, m); break;
        case 'o': A.openHat(at, e.vel, m); break;
        case 'crash': A.crash(at, e.vel, m); break;
        case 'pad': A.pad(at, e.notes, dsec, m); break;
        case 'bass': A.bass(at, e.midi, dsec, m); break;
        case 'arp': A.inst(e.inst, at, e.midi, dsec, e.vel, m, m.arp); break;
        case 'lead': A.inst(this.level.song.lead, at, e.midi, dsec, e.vel, m, m.lead); break;
        case 'final':
          A.kick(at, 1, m); A.crash(at, 1, m);
          A.pad(at, e.notes, bsec * 4, m);
          A.bass(at, e.notes[0] - 24, bsec * 3, m);
          break;
      }
    }
  }
}
