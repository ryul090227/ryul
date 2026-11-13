/* =========================================================
 * 렌더러: 캔버스에 배경, 발판, 고양이, 이펙트를 그림
 * ========================================================= */

const GAP = 84;  // 칸 사이 거리 (월드 px)
const TS = 48;   // 발판 크기

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s, y - s * 0.4, x, y + s * 0.35);
  ctx.closePath();
}

function drawPaw(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.25, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [[-0.42, -0.2], [-0.15, -0.45], [0.15, -0.45], [0.42, -0.2]];
  for (const [tx, ty] of toes) {
    ctx.beginPath();
    ctx.ellipse(x + tx * s, y + ty * s, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------------------------------------------------
 * 고양이 그리기 (원점 = 발 밑 중앙, 키 약 60px)
 * o: { face, sx, sy, lift, t, mood: 'normal'|'happy'|'dizzy'|'blink' }
 * --------------------------------------------------------- */
function drawCat(ctx, skin, o) {
  const t = o.t || 0;
  ctx.save();

  // 그림자
  const sh = clamp(1 - (o.lift || 0) / 60, 0.4, 1);
  ctx.fillStyle = 'rgba(40,20,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 19 * sh, 5 * sh, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -(o.lift || 0));
  ctx.scale((o.face || 1) * (o.sx || 1), o.sy || 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = skin.line;
  ctx.lineWidth = 2.4;

  // 꼬리
  const sway = Math.sin(t * 3.2) * 6;
  ctx.beginPath();
  ctx.moveTo(-13, -10);
  ctx.bezierCurveTo(-30, -10, -30 + sway * 0.3, -30, -22 + sway, -38);
  ctx.lineWidth = 9.5;
  ctx.strokeStyle = skin.line;
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = skin.body;
  ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = skin.line;

  // 몸통
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.ellipse(0, -13, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  if (skin.bodyPatches) {
    ctx.save(); ctx.clip();
    for (const p of skin.bodyPatches) {
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(0, -13, 18, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = skin.belly;
  ctx.beginPath();
  ctx.ellipse(3, -10, 9, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 앞발
  ctx.fillStyle = skin.belly;
  for (const px of [-5, 9]) {
    ctx.beginPath();
    ctx.ellipse(px, -1.5, 5.2, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 귀
  const ew = Math.sin(t * 7) * (o.mood === 'happy' ? 1.5 : 0.4);
  const ears = [
    [[-12, -41], [-12 - ew, -59], [-1, -50]],
    [[7, -50], [17 + ew, -59], [18, -41]],
  ];
  for (const e of ears) {
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.moveTo(...e[0]); ctx.lineTo(...e[1]); ctx.lineTo(...e[2]); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = skin.ear;
    const cx = (e[0][0] + e[1][0] + e[2][0]) / 3, cy = (e[0][1] + e[1][1] + e[2][1]) / 3;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const px = lerp(cx, e[i][0], 0.55), py = lerp(cy, e[i][1], 0.55);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  // 머리
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.ellipse(3, -35, 18.5, 16.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (skin.patches) {
    ctx.save(); ctx.clip();
    for (const p of skin.patches) {
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(3, -35, 18.5, 16.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (skin.stripe) {
    ctx.strokeStyle = skin.stripe;
    ctx.lineWidth = 2.6;
    for (const sx of [-1, 3, 7]) {
      ctx.beginPath(); ctx.moveTo(sx, -50); ctx.lineTo(sx, -44); ctx.stroke();
    }
    ctx.strokeStyle = skin.line;
    ctx.lineWidth = 2.4;
  }

  // 볼터치
  ctx.fillStyle = 'rgba(255,120,150,0.38)';
  ctx.beginPath(); ctx.ellipse(-8, -29, 4.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, -29, 4.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();

  // 눈
  const eyes = [-3, 10];
  if (o.mood === 'happy' || o.mood === 'blink') {
    ctx.strokeStyle = skin.pupil || skin.eye;
    ctx.lineWidth = 2.4;
    for (const ex of eyes) {
      ctx.beginPath();
      if (o.mood === 'happy') ctx.arc(ex, -33, 3.2, Math.PI * 1.15, Math.PI * 1.85);
      else { ctx.moveTo(ex - 3, -34); ctx.lineTo(ex + 3, -34); }
      ctx.stroke();
    }
  } else if (o.mood === 'dizzy') {
    ctx.strokeStyle = skin.pupil || skin.eye;
    ctx.lineWidth = 2;
    for (const ex of eyes) {
      ctx.beginPath();
      ctx.moveTo(ex - 2.6, -36.6); ctx.lineTo(ex + 2.6, -31.4);
      ctx.moveTo(ex + 2.6, -36.6); ctx.lineTo(ex - 2.6, -31.4);
      ctx.stroke();
    }
  } else {
    for (const ex of eyes) {
      ctx.fillStyle = skin.eye;
      ctx.beginPath(); ctx.ellipse(ex, -34, 3, 3.8, 0, 0, Math.PI * 2); ctx.fill();
      if (skin.pupil) {
        ctx.fillStyle = skin.pupil;
        ctx.beginPath(); ctx.ellipse(ex + 0.5, -34, 1.2, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex + 1, -35.5, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 코 + ω 입
  ctx.fillStyle = '#ff8fa8';
  ctx.beginPath();
  ctx.moveTo(1.8, -31); ctx.lineTo(5.2, -31); ctx.lineTo(3.5, -29.2); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = skin.line;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(1.6, -28.6, 1.9, 0, Math.PI);
  ctx.arc(5.4, -28.6, 1.9, 0, Math.PI);
  ctx.stroke();

  // 수염
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = 0.7;
  for (const [x1, x2, dy] of [[-10, -21, -1.5], [-10, -21, 1.5], [17, 28, -1.5], [17, 28, 1.5]]) {
    ctx.beginPath(); ctx.moveTo(x1, -30); ctx.lineTo(x2, -30 + dy * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* --------------------------------------------------------- */

class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 1, shake: 0 };
    this.particles = [];
    this.popups = [];
    this.bokeh = [];
    for (let i = 0; i < 34; i++) {
      this.bokeh.push({
        x: Math.random(), y: Math.random(),
        r: 4 + Math.random() * 16, depth: 0.2 + Math.random() * 0.8,
        sp: 0.006 + Math.random() * 0.018, ci: i, tw: Math.random() * 6,
      });
    }
    this.session = null;
    this.skin = SKINS[0];
    this.face = 1;
    this.poseIdx = 0;
    this.time = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.c.width = Math.round(this.w * this.dpr);
    this.c.height = Math.round(this.h * this.dpr);
    this.c.style.width = this.w + 'px';
    this.c.style.height = this.h + 'px';
  }

  attach(session) {
    this.session = session;
    this.particles = [];
    this.popups = [];
    this.evPtr = 0;
    this.poseIdx = 0;
    this.face = 1;
    this.lastMissAt = -99;
    this.lastHappyAt = -99;
    this.cam.x = 0; this.cam.y = 0;
  }

  /* 고양이 위치/자세 계산 — 시간만으로 결정되는 순수 함수 */
  catPose(t) {
    const tiles = this.session.chart.tiles;
    const n = tiles.length;
    let k = this.poseIdx;
    while (k < n - 1 && tiles[k + 1].time <= t) k++;
    while (k > 0 && tiles[k].time > t) k--;
    this.poseIdx = k;
    const cur = tiles[k];
    const pose = { x: cur.x * GAP, y: cur.y * GAP, lift: 0, sx: 1, sy: 1, k, air: false };

    // 착지 직후 찌그러짐
    const since = t - cur.time;
    if (k > 0 && since >= 0 && since < 0.16) {
      const q = 1 - since / 0.16;
      pose.sy = 1 - 0.24 * q;
      pose.sx = 1 + 0.2 * q;
    }
    if (k >= n - 1) return pose;

    const nx = tiles[k + 1];
    const dx = nx.x - cur.x;
    if (Math.abs(dx) > 0.01) this.face = Math.sign(dx);

    const hd = Math.min(nx.stepDur * 0.82, 0.3);
    const hs = nx.time - hd;
    if (t >= hs) {
      const p = clamp((t - hs) / hd, 0, 1);
      const e = easeInOut(p);
      pose.x = lerp(cur.x, nx.x, e) * GAP;
      pose.y = lerp(cur.y, nx.y, e) * GAP;
      pose.lift = Math.sin(Math.PI * p) * 34;
      pose.sx = 0.9;
      pose.sy = 1.12;
      pose.air = true;
    } else {
      const pre = hs - t;
      if (pre < 0.09) { // 점프 직전 웅크리기
        const q = 1 - pre / 0.09;
        pose.sy *= 1 - 0.14 * q;
        pose.sx *= 1 + 0.1 * q;
      }
    }
    return pose;
  }

  spawnBurst(x, y, color, count, kind) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const sp = 90 + Math.random() * 120;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0, max: 0.6 + Math.random() * 0.3,
        size: 5 + Math.random() * 5, color, kind,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
      });
    }
  }

  consumeEvents(t) {
    const s = this.session;
    const tiles = s.chart.tiles;
    while (this.evPtr < s.events.length) {
      const ev = s.events[this.evPtr++];
      const tile = tiles[ev.tile];
      const x = tile.x * GAP, y = tile.y * GAP;
      if (ev.type === 'hit') {
        const info = GRADE_INFO[ev.grade];
        this.spawnBurst(x, y, info.color, ev.grade === 'perfect' ? 10 : 6, ev.grade === 'perfect' ? 'heart' : 'dot');
        this.particles.push({ x, y, life: 0, max: 0.35, kind: 'ring', color: info.color });
        if (!s.demo) {
          const timing = ev.grade !== 'perfect' ? (ev.dt < 0 ? '빨라요' : '느려요') : '';
          this.popups.push({ x, y: y - 40, text: info.label, sub: timing, color: info.color, life: 0, max: 0.7 });
        }
        if (ev.grade === 'perfect') this.lastHappyAt = t;
        if (tile.bpmChange && !s.demo) {
          this.popups.push({ x, y: y - 74, text: '속도 UP!', color: s.level.theme.accent, life: 0, max: 1.1 });
        }
      } else if (ev.type === 'miss') {
        this.popups.push({ x, y: y - 40, text: GRADE_INFO.miss.label, color: GRADE_INFO.miss.color, life: 0, max: 0.8 });
        this.spawnBurst(x, y, '#c9c2d4', 5, 'dot');
        this.cam.shake = 7;
        this.lastMissAt = t;
      } else if (ev.type === 'early') {
        this.popups.push({ x, y: y - 30, text: '앗, 너무 빨라!', color: '#b9a8c9', life: 0, max: 0.5, small: true });
      }
    }
  }

  draw(dt) {
    const s = this.session;
    if (!s) return;
    this.time += dt;
    const ctx = this.ctx;
    const th = s.level.theme;
    const t = s.t();
    const beat = s.beatInfo(t);
    const pulse = beat.index >= 0 ? Math.exp(-beat.phase * 5) : 0;

    this.consumeEvents(t);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    /* ---------- 배경 ---------- */
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, th.bgTop);
    g.addColorStop(1, th.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    for (const b of this.bokeh) {
      b.y -= b.sp * dt;
      if (b.y < -0.1) { b.y = 1.1; b.x = Math.random(); }
      const px = ((b.x * this.w - this.cam.x * b.depth * 0.25) % this.w + this.w) % this.w;
      const py = b.y * this.h;
      const col = th.bokeh[b.ci % th.bokeh.length];
      if (th.night && b.ci % 3 === 0) {
        const tw = 0.5 + 0.5 * Math.sin(this.time * 2 + b.tw);
        ctx.globalAlpha = 0.4 + 0.6 * tw;
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath(); ctx.arc(px, py, 1.6 + b.depth * 1.4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = (th.night ? 0.18 : 0.38) * b.depth;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px, py, b.r * (1 + pulse * 0.12 * b.depth), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (th.night) {
      // 달
      const mx = this.w * 0.82, my = this.h * 0.18;
      ctx.fillStyle = 'rgba(255,240,200,0.12)';
      ctx.beginPath(); ctx.arc(mx, my, 70 + pulse * 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff1c4';
      ctx.beginPath(); ctx.arc(mx, my, 38, 0, Math.PI * 2); ctx.fill();
    }

    /* ---------- 카메라 ---------- */
    const pose = this.catPose(t);
    const tiles = s.chart.tiles;
    const ahead = tiles[Math.min(pose.k + 1, tiles.length - 1)];
    const tx = lerp(pose.x, ahead.x * GAP, 0.35);
    const ty = lerp(pose.y, ahead.y * GAP, 0.35);
    const f = 1 - Math.exp(-dt * 4.5);
    this.cam.x = lerp(this.cam.x, tx, f);
    this.cam.y = lerp(this.cam.y, ty, f);
    this.cam.zoom = clamp(Math.min(this.w, this.h) / 600, 0.82, 1.6);
    this.cam.shake *= Math.exp(-dt * 12);
    const shx = (Math.random() - 0.5) * this.cam.shake;
    const shy = (Math.random() - 0.5) * this.cam.shake;

    ctx.save();
    ctx.translate(this.w / 2 + shx, this.h / 2 + shy + (s.demo ? this.h * 0.3 : 0));
    const z = this.cam.zoom * (1 + pulse * 0.012);
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);

    const judged = s.judged;
    const viewR = (Math.max(this.w, this.h) / z) * 0.75;
    const visible = (tl) => Math.abs(tl.x * GAP - this.cam.x) < viewR && Math.abs(tl.y * GAP - this.cam.y) < viewR;
    const revealAlpha = (i) => clamp(1 - (i - (judged + 14)) / 6, 0, 1);

    /* ---------- 길 ---------- */
    ctx.strokeStyle = th.line;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 14]);
    for (let i = 0; i < tiles.length - 1; i++) {
      const a = tiles[i], b = tiles[i + 1];
      const al = revealAlpha(i + 1);
      if (al <= 0 || (!visible(a) && !visible(b))) continue;
      ctx.globalAlpha = al * 0.9;
      ctx.beginPath(); ctx.moveTo(a.x * GAP, a.y * GAP); ctx.lineTo(b.x * GAP, b.y * GAP); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    /* ---------- 발판 ---------- */
    for (let i = 0; i < tiles.length; i++) {
      const tl = tiles[i];
      const al = revealAlpha(i);
      if (al <= 0 || !visible(tl)) continue;
      const st = s.tileState[i];
      const x = tl.x * GAP, y = tl.y * GAP;
      let scale = 1;
      if (st && st.grade !== 'start') {
        const since = t - st.time;
        if (since >= 0 && since < 0.3) scale = 1 + 0.18 * (1 - easeOutBack(since / 0.3));
      }
      if (i === judged + 1) scale *= 1 + pulse * 0.06;
      if (i === tiles.length - 1) scale *= 1.15;
      const sz = TS * scale;

      ctx.globalAlpha = al;
      ctx.fillStyle = th.tileShadow;
      roundRect(ctx, x - sz / 2, y - sz / 2 + 6, sz, sz, 15);
      ctx.fill();
      let fill = th.tile;
      if (st && GRADE_INFO[st.grade]) fill = mixColor(th.tile, GRADE_INFO[st.grade].color, 0.35);
      ctx.fillStyle = fill;
      roundRect(ctx, x - sz / 2, y - sz / 2, sz, sz, 15);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      roundRect(ctx, x - sz / 2 + 6, y - sz / 2 + 4, sz - 12, 7, 4);
      ctx.fill();

      if (st && GRADE_INFO[st.grade]) {
        drawPaw(ctx, x, y + 2, 14 * scale, st.grade === 'miss' ? 'rgba(120,110,130,0.45)' : GRADE_INFO[st.grade].color);
      } else if (i === tiles.length - 1) {
        // 도착 칸: 생선 아이콘
        drawFish(ctx, x, y + 1, th.accent);
      } else if (i > 0) {
        ctx.fillStyle = th.line;
        ctx.globalAlpha = al * 0.55;
        ctx.beginPath(); ctx.arc(x, y + 1, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = al;
      }

      // 박자 길이 표시
      if (i > 0 && tl.beats !== 1 && !st) {
        ctx.font = '700 13px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = th.accent;
        ctx.fillText(tl.beats === 0.5 ? '½' : '×' + tl.beats, x + sz / 2 - 2, y - sz / 2 + 2);
      }
      if (tl.bpmChange && !st) {
        ctx.font = '700 15px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = th.accent;
        ctx.fillText('»', x - sz / 2 + 4, y - sz / 2 + 4);
      }
    }
    ctx.globalAlpha = 1;

    /* ---------- 다가오는 박자 링 ---------- */
    for (let i = judged + 1; i <= Math.min(judged + 4, tiles.length - 1); i++) {
      const tl = tiles[i];
      const ad = Math.max(tl.stepDur, 60 / tl.bpm);
      const remain = tl.time - t;
      if (remain > ad || remain < -JUDGE.good) continue;
      const p = clamp(remain / ad, 0, 1);
      const r = lerp(TS * 0.58, TS * 1.7, p);
      ctx.globalAlpha = (1 - p) * (i === judged + 1 ? 0.95 : 0.4);
      ctx.strokeStyle = th.accent;
      ctx.lineWidth = 3.5;
      roundRect(ctx, tl.x * GAP - r, tl.y * GAP - r, r * 2, r * 2, r * 0.45);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* ---------- 파티클 (발판 위) ---------- */
    this.drawParticles(ctx, dt);

    /* ---------- 고양이 ---------- */
    let mood = 'normal';
    if (t - this.lastMissAt < 0.6) mood = 'dizzy';
    else if (pose.air || t - this.lastHappyAt < 0.25) mood = 'happy';
    else if ((this.time % 3.2) < 0.13) mood = 'blink';
    if (s.ended && s.result && s.result.cleared) mood = 'happy';
    ctx.save();
    ctx.translate(pose.x, pose.y + 12);
    const bob = pose.air ? 1 : 1 - pulse * 0.05;
    drawCat(ctx, this.skin, {
      face: this.face, sx: pose.sx, sy: pose.sy * bob, lift: pose.lift, t: this.time, mood,
    });
    ctx.restore();

    /* ---------- 판정 텍스트 ---------- */
    ctx.textAlign = 'center';
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life += dt;
      if (p.life >= p.max) { this.popups.splice(i, 1); continue; }
      const k = p.life / p.max;
      const sc = k < 0.2 ? easeOutBack(k / 0.2) : 1;
      ctx.save();
      ctx.translate(p.x, p.y - k * 22);
      ctx.scale(sc, sc);
      ctx.globalAlpha = 1 - Math.pow(k, 3);
      ctx.font = `${p.small ? 15 : 24}px Jua, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      if (p.sub) {
        ctx.font = '13px Jua, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeText(p.sub, 0, 17);
        ctx.fillStyle = '#9a8aa6';
        ctx.fillText(p.sub, 0, 17);
      }
      ctx.restore();
    }
    ctx.restore();

    /* ---------- 카운트다운 ---------- */
    if (!s.demo && s.started && beat.index >= -3 && beat.index <= 0 && t < 0.6) {
      const label = beat.index === 0 ? '냥!' : String(-beat.index);
      const sc = 1 + 0.5 * Math.exp(-beat.phase * 7);
      ctx.save();
      ctx.translate(this.w / 2, this.h * 0.3);
      ctx.scale(sc, sc);
      ctx.globalAlpha = 1 - beat.phase * 0.6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '72px Jua, sans-serif';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = th.accent;
      ctx.fillText(label, 0, 0);
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    }
  }

  drawParticles(ctx, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      const k = p.life / p.max;
      ctx.globalAlpha = 1 - k;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * (1 - k);
        const r = TS * (0.55 + k * 0.9);
        roundRect(ctx, p.x - r, p.y - r, r * 2, r * 2, r * 0.4);
        ctx.stroke();
        continue;
      }
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.fillStyle = p.color;
      if (p.kind === 'heart') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.2);
        heartPath(ctx, 0, 0, p.size); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.55 * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawFish(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(15, -7); ctx.lineTo(15, 7); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-7, -1.5, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function mixColor(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, k));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, k));
  const bl = Math.round(lerp(pa & 255, pb & 255, k));
  return `rgb(${r},${g},${bl})`;
}
