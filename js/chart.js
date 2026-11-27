/* =========================================================
 * 차트 빌더
 *   노래 → (1) 음악 이벤트  (2) 발판을 밟을 박자 목록
 *   박자 목록 → 발판 좌표 (각도 = 타이밍)
 *
 * 핵심 규칙: 고양이의 움직이는 쪽 끝은 1박에 180°씩 일정하게 돈다.
 *   직진 = 1박, 안쪽 90° 꺾임 = ½박, 바깥쪽 90° = 1½박,
 *   135° 꺾임 = ¼박, 120° = ⅓박(셋잇단), 60° = ⅔박 ...
 * 그래서 맵 모양만 보고도 리듬을 미리 읽을 수 있다.
 * ========================================================= */

const COUNT_IN = 4;          // 시작 전 카운트 박자 수
const DEG_PER_BEAT = 180;    // 1박에 도는 각도

const NOTE_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CHORD_TYPES = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6],
};

function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('음 이름 오류: ' + name);
  let s = NOTE_SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 12 * (parseInt(m[3], 10) + 1) + s;
}

function parseChord(sym) {
  const m = /^([A-G])([#b]?)(maj7|m7|sus4|sus2|dim|m|7)?$/.exec(sym);
  if (!m) throw new Error('코드 오류: ' + sym);
  const semi = (NOTE_SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const iv = CHORD_TYPES[m[3] || ''];
  let padRoot = 48 + semi;
  if (padRoot < 53) padRoot += 12;
  let bassRoot = 36 + semi;
  if (semi >= 7) bassRoot -= 12;
  return { semi, iv, pad: iv.map((i) => padRoot + i), bass: bassRoot };
}

function parseDur(s) {
  if (s.includes('/')) { const [a, b] = s.split('/'); return parseFloat(a) / parseFloat(b); }
  return parseFloat(s);
}

function parseMelody(str) {
  const out = [];
  let beat = 0;
  for (const tok of str.replace(/\|/g, ' ').trim().split(/\s+/)) {
    if (!tok) continue;
    const [n, d] = tok.split(':');
    const dur = parseDur(d);
    if (n !== 'r') out.push({ beat, midi: noteToMidi(n), dur });
    beat += dur;
  }
  return { notes: out, length: beat };
}

/* 간단한 시드 난수 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 템포 맵 ---------------- */
function makeTempo(points) {
  // points: [{beat, bpm}] 정렬됨
  let time = 0;
  const pts = points.map((p, i) => {
    if (i > 0) time += ((p.beat - points[i - 1].beat) * 60) / points[i - 1].bpm;
    return { beat: p.beat, bpm: p.bpm, time };
  });
  const seg = (b) => { let s = pts[0]; for (const p of pts) if (p.beat <= b + 1e-9) s = p; return s; };
  const segT = (t) => { let s = pts[0]; for (const p of pts) if (p.time <= t + 1e-9) s = p; return s; };
  return {
    points: pts,
    timeAt(b) { const s = seg(b); return s.time + ((b - s.beat) * 60) / s.bpm; },
    beatAt(t) { const s = segT(t); return s.beat + ((t - s.time) * s.bpm) / 60; },
    bpmAt(b) { return seg(b).bpm; },
  };
}

/* ---------------- 노래 컴파일 ---------------- */
function compileSong(song) {
  const events = [];
  const hits = [];       // { beat, sec }
  const sections = [];
  const tempoPts = [{ beat: 0, bpm: song.bpm }];
  let beat = 0;

  for (const item of song.order) {
    const name = typeof item === 'string' ? item : item.s;
    const sec = song.sections[name];
    if (!sec) throw new Error('섹션 없음: ' + name);
    if (item.bpm) tempoPts.push({ beat, bpm: item.bpm });
    const start = beat, end = beat + sec.bars * 4;
    sections.push({ name, sec, start, end });

    for (let bar = 0; bar < sec.bars; bar++) {
      const b0 = start + bar * 4;
      const chord = parseChord(sec.chords[bar % sec.chords.length]);
      if (sec.pad) events.push({ beat: b0, type: 'pad', notes: chord.pad, dur: 4 });

      // 드럼
      const dk = bar === sec.bars - 1 && sec.fill ? sec.fill : sec.drums;
      const dp = dk && DRUMS[dk];
      if (dp) {
        for (const inst of Object.keys(dp)) {
          const pat = dp[inst];
          const step = 4 / pat.length;
          for (let i = 0; i < pat.length; i++) {
            const c = pat[i];
            if (c === '.') continue;
            events.push({ beat: b0 + i * step, type: inst, vel: c === 'X' ? 1 : c === 'g' ? 0.45 : 0.8 });
          }
        }
      }
      if (bar === 0 && sec.crash) events.push({ beat: b0, type: 'crash', vel: 1 });

      // 베이스
      const bp = sec.bass && BASS[sec.bass];
      if (bp) {
        const step = 4 / bp.length;
        for (let i = 0; i < bp.length; i++) {
          const c = bp[i];
          if (c === '.' || c === '-') continue;
          let j = i + 1;
          while (j < bp.length && bp[j] === '.') j++;
          let midi = chord.bass;
          if (c === 'O') midi += 12;
          else if (c === '5') midi += 7;
          else if (c === '3') midi += chord.iv[1];
          else if (c === '7') midi += chord.iv[3] || 10;
          events.push({ beat: b0 + i * step, type: 'bass', midi, dur: (j - i) * step * 0.92 });
        }
      }

      // 아르페지오
      if (sec.arp) {
        const tones = [...chord.pad, ...chord.pad.map((n) => n + 12)];
        const seq = [...tones, ...tones.slice(1, -1).reverse()];
        const r = sec.arp.rate;
        const n = Math.round(4 / r);
        for (let i = 0; i < n; i++) {
          events.push({
            beat: b0 + i * r, type: 'arp', inst: sec.arp.inst,
            midi: seq[i % seq.length] + 12, dur: r * 0.9, vel: sec.arp.vel ?? 0.4,
          });
        }
      }
    }

    // 멜로디
    let lead = null;
    if (sec.lead) {
      lead = parseMelody(sec.lead);
      if (Math.abs(lead.length - sec.bars * 4) > 1e-6) {
        console.warn(`[song] ${song.title}/${name}: 멜로디 길이 ${lead.length}박 ≠ ${sec.bars * 4}박`);
      }
      const oct = (song.leadOctave || 0) * 12;
      for (const n of lead.notes) {
        events.push({ beat: start + n.beat, type: 'lead', midi: n.midi + oct, dur: n.dur, vel: song.leadVel ?? 1 });
      }
    }

    // 채보 박자
    const mode = sec.map || 'beat';
    const add = (b) => hits.push({ beat: b, sec });
    if (mode === 'lead' && lead) lead.notes.forEach((n) => add(start + n.beat));
    else if (mode === 'eighth') for (let b = start; b < end - 1e-6; b += 0.5) add(b);
    else if (mode.startsWith('every:')) { const k = parseFloat(mode.slice(6)); for (let b = start; b < end - 1e-6; b += k) add(b); }
    else if (mode.startsWith('pat:')) {
      const pat = mode.slice(4).trim().split(/\s+/).map(parseDur);
      for (let b = start, i = 0; b < end - 1e-6; b += pat[i++ % pat.length]) add(b);
    } else for (let b = start; b < end - 1e-6; b += 1) add(b);

    beat = end;
  }

  const total = beat;
  const last = sections[sections.length - 1].sec;
  hits.push({ beat: total, sec: last });
  events.push({ beat: total, type: 'final', notes: parseChord(song.finalChord || 'C').pad });
  for (let i = -COUNT_IN; i < 0; i++) events.push({ beat: i, type: 'tick', accent: i === -COUNT_IN });
  events.sort((a, b) => a.beat - b.beat);

  return { events, hits, sections, total, tempo: makeTempo(tempoPts) };
}

/* ---------------- 박자 목록 정리 (간격 2박 이상 처리) ---------------- */
function normalizeHits(rawHits) {
  rawHits.sort((a, b) => a.beat - b.beat);
  const hs = [];
  for (const h of rawHits) {
    if (h.beat <= 1e-3) continue;
    if (hs.length && Math.abs(hs[hs.length - 1].beat - h.beat) < 0.02) continue;
    hs.push(h);
  }
  const out = [];
  let prev = { beat: 0, sec: hs[0] ? hs[0].sec : null };
  for (const h of hs) {
    const gap = h.beat - prev.beat;
    if (gap >= 2 - 1e-6) {
      const fill = (prev.sec && prev.sec.fill) === 'loop' ? 'loop' : 'beat';
      if (fill === 'beat') {
        for (let ib = Math.floor(prev.beat) + 1; ib < h.beat - 0.3; ib++) {
          if (ib > prev.beat + 0.3) out.push({ beat: ib, sec: prev.sec });
        }
      } else {
        const loops = Math.floor(gap / 2);
        if (gap - loops * 2 < 0.1) out.push({ beat: prev.beat + 1, sec: prev.sec });
      }
    }
    out.push(h);
    prev = h;
  }
  return out;
}

/* ---------------- 발판 배치 ---------------- */
function layoutTiles(hits, seed) {
  const rng = mulberry32(seed || 1);
  const n = hits.length;
  // 각 칸으로 가는 간격 → (기본 각도, 추가 바퀴)
  const steps = hits.map((h, i) => {
    const gap = h.beat - (i ? hits[i - 1].beat : 0);
    let loops = gap >= 2 - 1e-6 ? Math.floor(gap / 2) : 0;
    let base = gap - loops * 2;
    if (base < 0.05) { loops -= 1; base += 2; }
    return { gap, base, loops, twirlProb: (h.sec && h.sec.twirl) || 0 };
  });

  const pos = [{ x: 0, y: 0 }];
  const heading = [0];      // 각 칸에 들어온 방향 (도, 수학 좌표계)
  const rotIn = [-1];       // 이 칸에서 출발할 때의 회전 방향(트월 전)
  const rot = [];           // 실제 출발 회전 방향 (-1 시계, +1 반시계)
  const twirl = [];
  const opts = [];
  const ptr = [];
  const grid = new Map();
  const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  const gridAdd = (p, i) => { const k = key(p.x, p.y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); };
  const gridDel = (p, i) => { const a = grid.get(key(p.x, p.y)); if (a) a.splice(a.indexOf(i), 1); };
  const collides = (p, from) => {
    const cx = Math.round(p.x), cy = Math.round(p.y);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = grid.get(`${cx + dx},${cy + dy}`);
      if (!a) continue;
      for (const j of a) {
        if (j === from) continue;
        if (Math.hypot(pos[j].x - p.x, pos[j].y - p.y) < 0.72) return true;
      }
    }
    return false;
  };
  gridAdd(pos[0], 0);

  const place = (i, tw) => {
    const r = tw ? -rotIn[i] : rotIn[i];
    const target = heading[i] + 180 + r * steps[i].base * DEG_PER_BEAT;
    const rad = (target * Math.PI) / 180;
    return { r, target, p: { x: pos[i].x + Math.cos(rad), y: pos[i].y - Math.sin(rad) } };
  };
  const accept = (i, tw, c) => {
    twirl[i] = tw;
    rot[i] = c.r;
    pos[i + 1] = c.p;
    heading[i + 1] = ((c.target % 360) + 360) % 360;
    rotIn[i + 1] = c.r;
    gridAdd(c.p, i + 1);
  };

  // 깊이 우선 탐색 + 되돌아가기: 발판이 서로 겹치지 않도록 회전 방향(트월)을 고른다
  let i = 0, iter = 0, greedy = false;
  while (i < n) {
    if (++iter > 300000) greedy = true;
    if (!opts[i]) {
      const st = steps[i];
      const straight = Math.abs(st.base - 1) < 1e-6;
      opts[i] = straight || i === 0 ? [false] : rng() < st.twirlProb ? [true, false] : [false, true];
      ptr[i] = 0;
    }
    let placed = false;
    while (ptr[i] < opts[i].length) {
      const tw = opts[i][ptr[i]];
      const c = place(i, tw);
      if (greedy || !collides(c.p, i)) { accept(i, tw, c); placed = true; break; }
      ptr[i]++;
    }
    if (placed) { i++; continue; }
    if (i === 0) { greedy = true; ptr[0] = 0; continue; }
    opts[i] = null;
    i--;
    gridDel(pos[i + 1], i + 1);
    ptr[i]++;
  }
  if (greedy) console.warn('[chart] 발판 배치: 일부 겹침 허용');

  return { pos, heading, rot, twirl, steps };
}

/* ---------------- 레벨 → 차트 ---------------- */
function buildChart(level) {
  const song = compileSong(level.song);
  const hits = normalizeHits(song.hits);
  const lay = layoutTiles(hits, level.seed);
  const T = song.tempo;

  const tiles = [];
  for (let k = 0; k <= hits.length; k++) {
    const beat = k === 0 ? 0 : hits[k - 1].beat;
    const st = k === 0 ? null : lay.steps[k - 1];
    tiles.push({
      x: lay.pos[k].x, y: lay.pos[k].y,
      beat, time: T.timeAt(beat),
      heading: lay.heading[k],
      rot: k < hits.length ? lay.rot[k] : lay.rot[k - 1] || -1,
      twirl: k < hits.length ? !!lay.twirl[k] : false,
      loops: st ? st.loops : 0,
      gap: st ? st.gap : 0,
      bpm: T.bpmAt(beat),
      bpmChange: 0,
    });
  }
  // BPM 변경 표시 (변경 지점 이후 첫 발판)
  for (const p of T.points.slice(1)) {
    const t = tiles.find((tl) => tl.beat >= p.beat - 1e-6);
    if (t) t.bpmChange = p.bpm > T.bpmAt(p.beat - 0.01) ? 1 : -1;
  }
  // 판정 창 크기: 촘촘한 구간에서는 좁힘
  for (let k = 1; k < tiles.length; k++) {
    const gp = tiles[k].time - tiles[k - 1].time;
    const gn = k + 1 < tiles.length ? tiles[k + 1].time - tiles[k].time : 1;
    tiles[k].win = clampNum(Math.min(gp, gn) / (2 * 0.12), 0.5, 1);
  }

  const endTime = tiles[tiles.length - 1].time;
  return {
    tiles, events: song.events, tempo: T, endTime, totalBeats: song.total,
    timeAt: (b) => T.timeAt(b), beatAt: (t) => T.beatAt(t),
  };
}

function clampNum(v, a, b) { return Math.max(a, Math.min(b, v)); }
