/* =========================================================
 * 차트(채보) 빌더: 레벨 path 문자열 → 칸 좌표 + 타이밍
 * ========================================================= */

const DIRS = { R: 0, E: 45, U: 90, Q: 135, L: 180, Z: 225, D: 270, C: 315 };
const COUNT_IN = 4; // 시작 전 카운트 박자 수

function buildChart(level) {
  const tokens = level.path.trim().split(/\s+/);
  let bpm = level.bpm;
  let x = 0, y = 0, time = 0;
  let bpmMark = false;
  const tiles = [{ x: 0, y: 0, time: 0, beats: 0, stepDur: 0, bpm, angle: 0 }];
  const segments = [{ time: 0, bpm }];

  for (const raw of tokens) {
    const tok = raw.toUpperCase();
    if (tok[0] === '@') {
      bpm = parseFloat(tok.slice(1));
      segments.push({ time, bpm });
      bpmMark = true;
      continue;
    }
    const m = /^([RLUDQEZC])([\d.]+)?(?:\*(\d+))?$/.exec(tok);
    if (!m) { console.warn('[chart] 알 수 없는 토큰:', raw); continue; }
    const ang = (DIRS[m[1]] * Math.PI) / 180;
    const beats = m[2] ? parseFloat(m[2]) : 1;
    const rep = m[3] ? parseInt(m[3], 10) : 1;
    for (let r = 0; r < rep; r++) {
      x += Math.cos(ang);
      y -= Math.sin(ang); // 화면 좌표: 위쪽이 -y
      const dur = (beats * 60) / bpm;
      time += dur;
      tiles.push({
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        time, beats, stepDur: dur, bpm, angle: ang,
        bpmChange: bpmMark ? bpm : 0,
      });
      bpmMark = false;
    }
  }

  const endTime = time;
  const bpmAt = (t) => {
    let b = segments[0].bpm;
    for (const s of segments) if (s.time <= t + 1e-6) b = s.bpm;
    return b;
  };

  // 배경 음악용 박자 그리드 (카운트인 포함)
  const beats = [];
  let t = (-COUNT_IN * 60) / level.bpm;
  let idx = -COUNT_IN;
  const tail = endTime + (2 * 60) / bpmAt(endTime);
  while (t <= tail + 1e-6) {
    const dur = 60 / bpmAt(t);
    beats.push({ time: t, index: idx, dur });
    t += dur;
    idx++;
  }

  return { tiles, beats, endTime, bpmAt };
}
