/* =========================================================
 * 렌더러: 캔버스에 배경, 발판, 고양이, 이펙트를 그림
 * ========================================================= */

const GAP = 84;  // 칸 사이 거리 (월드 px)
const TS = 46;   // 발판 크기

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

  drawCatHead(ctx, skin, o.mood, t);
  ctx.restore();
}


/* 고양이 머리 (원래 좌표계 기준, 머리 중심 = (3,-35)) */
function drawCatHead(ctx, skin, mood, t) {
  const o = { mood };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = skin.line;
  ctx.lineWidth = 2.4;
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
}

/* ---------------------------------------------------------
 * 쭈욱 늘어나는 고양이
 *   B = 엉덩이 끝, H = 머리 끝 (월드 좌표)
 *   bend = 몸통 휘어짐 (회전 반대쪽으로 살짝 끌려오는 느낌)
 * --------------------------------------------------------- */
function drawStretchCat(ctx, skin, o) {
  const { B, H, t } = o;
  const dx = H.x - B.x, dy = H.y - B.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const mx = (B.x + H.x) / 2 + nx * o.bend, my = (B.y + H.y) / 2 + ny * o.bend;
  const N = 18;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, v = 1 - u;
    pts.push({ x: v * v * B.x + 2 * v * u * mx + u * u * H.x, y: v * v * B.y + 2 * v * u * my + u * u * H.y });
  }
  const poly = (from, to) => {
    ctx.beginPath();
    const a = Math.round(from * N), b = Math.round(to * N);
    for (let i = a; i <= b; i++) i === a ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 그림자 (움직이는 끝)
  const S = o.swingIsHead ? H : B;
  ctx.fillStyle = 'rgba(40,20,40,0.13)';
  ctx.beginPath(); ctx.ellipse(S.x, S.y + 16, 16, 5, 0, 0, Math.PI * 2); ctx.fill();

  // 꼬리 방향: 엉덩이에서 몸통 반대쪽
  let tx = B.x - pts[3].x, ty = B.y - pts[3].y;
  const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const wag = Math.sin(t * 7) * 8;
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(B.x + tx * 6, B.y + ty * 6);
    ctx.quadraticCurveTo(B.x + tx * 24 - ty * wag, B.y + ty * 24 + tx * wag - 6, B.x + tx * 26 + ty * wag * 0.6, B.y + ty * 26 - 18);
  };

  // 1) 외곽선
  ctx.strokeStyle = skin.line;
  tail(); ctx.lineWidth = 10; ctx.stroke();
  poly(0, 1); ctx.lineWidth = 25; ctx.stroke();
  ctx.fillStyle = skin.line;
  ctx.beginPath(); ctx.arc(B.x, B.y, 15, 0, Math.PI * 2); ctx.fill();

  // 2) 채우기
  ctx.strokeStyle = skin.body;
  tail(); ctx.lineWidth = 6; ctx.stroke();
  poly(0, 1); ctx.lineWidth = 20; ctx.stroke();
  ctx.fillStyle = skin.body;
  ctx.beginPath(); ctx.arc(B.x, B.y, 12.6, 0, Math.PI * 2); ctx.fill();

  // 3) 무늬
  if (skin.stretchPatches) {
    for (const p of skin.stretchPatches) { ctx.strokeStyle = p.c; poly(p.from, p.to); ctx.lineWidth = 17; ctx.stroke(); }
  }
  if (skin.stripe && len > 30) {
    ctx.strokeStyle = skin.stripe;
    ctx.lineWidth = 3.4;
    for (const f of [0.3, 0.45, 0.6, 0.75]) {
      const i = Math.round(f * N);
      const p = pts[i], q = pts[i + 1] || pts[i - 1];
      let ux = q.x - p.x, uy = q.y - p.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      ctx.beginPath(); ctx.moveTo(p.x - uy * 7, p.y + ux * 7); ctx.lineTo(p.x + uy * 7, p.y - ux * 7); ctx.stroke();
    }
  }
  // 배 (가운데 밝은 줄)
  ctx.strokeStyle = skin.belly; ctx.globalAlpha = 0.55;
  poly(0.25, 0.75); ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = 1;

  // 4) 발 (엉덩이 쪽, 머리 쪽)
  ctx.fillStyle = skin.belly; ctx.strokeStyle = skin.line; ctx.lineWidth = 2;
  for (const P of [B, H]) {
    for (const ox of [-7, 7]) {
      ctx.beginPath(); ctx.ellipse(P.x + ox, P.y + 11, 5, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  // 5) 머리 (항상 똑바로, 몸 방향을 바라봄)
  ctx.save();
  ctx.translate(H.x, H.y - 6);
  ctx.scale(o.face || 1, 1);
  ctx.translate(-3, 35);
  drawCatHead(ctx, skin, o.mood, t);
  ctx.restore();
}

function drawSpiral(ctx, x, y, r, color, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir < 0 ? -1 : 1, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 3.2;
    const rr = (i / 40) * r;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFish(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(-2, 0, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(15, -7); ctx.lineTo(15, 7); ctx.closePath(); ctx.fill();
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
    this.time = 0;
    this.yShift = 0;
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
    this.lastMissAt = -99;
    this.lastHappyAt = -99;
    this.cam.x = 0; this.cam.y = 0;
    this.face = 1;
  }

  /* 고양이 상태: 시간만으로 계산 */
  catState(t) {
    const s = this.session;
    const tiles = s.chart.tiles;
    const k = s.judged;
    const piv = tiles[k];
    const P = { x: piv.x * GAP, y: piv.y * GAP };
    const beat = s.chart.beatAt(t);
    const phi = ((piv.heading + 180 + piv.rot * DEG_PER_BEAT * (beat - piv.beat)) * Math.PI) / 180;

    // 몸 길이 (시작 전엔 웅크림 → 카운트 첫 박 동안 쭉 늘어남, 끝나면 다시 웅크림)
    let L = 1;
    const startBeat = -COUNT_IN;
    if (beat < startBeat) L = 0;
    else if (beat < startBeat + 1) L = easeInOut(beat - startBeat);
    if (k === tiles.length - 1 || (s.ended && s.result && !s.result.cleared)) {
      const since = t - (s.lastJudgeTime > -90 ? s.lastJudgeTime : t);
      L = clamp(1 - since / 0.35, 0, 1);
    }
    const S = { x: P.x + Math.cos(phi) * GAP * L, y: P.y - Math.sin(phi) * GAP * L };
    return { P, S, L, k, phi, rot: piv.rot, pivotIsHead: k % 2 === 1 };
  }

  spawnBurst(x, y, color, count, kind) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const sp = 90 + Math.random() * 120;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0, max: 0.55 + Math.random() * 0.3,
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
        const pf = ev.grade === 'perfect';
        this.spawnBurst(x, y, info.color, pf ? 8 : 5, pf ? 'heart' : 'dot');
        this.particles.push({ x, y, life: 0, max: 0.35, kind: 'ring', color: info.color });
        if (!s.demo && (!pf || t - (this.lastPopAt || -9) > 0.28)) {
          this.lastPopAt = t;
          const timing = pf ? '' : ev.dt < 0 ? '빨라요' : '느려요';
          this.popups.push({ x, y: y - 46, text: info.label, sub: timing, color: info.color, life: 0, max: 0.6 });
        }
        if (pf) this.lastHappyAt = t;
        if (tile.bpmChange && !s.demo) {
          this.popups.push({ x, y: y - 84, text: tile.bpmChange > 0 ? '빨라진다냥!' : '느려진다냥', color: s.level.theme.accent, life: 0, max: 1.2 });
        }
      } else if (ev.type === 'miss') {
        this.popups.push({ x, y: y - 46, text: GRADE_INFO.miss.label, color: GRADE_INFO.miss.color, life: 0, max: 0.8 });
        this.spawnBurst(x, y, '#c9c2d4', 5, 'dot');
        this.cam.shake = 8;
        this.lastMissAt = t;
      } else if (ev.type === 'early') {
        this.popups.push({ x, y: y - 34, text: '앗, 너무 빨라!', color: '#b48ac9', life: 0, max: 0.55, small: true });
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
    const beat = s.chart.beatAt(t);
    const bi = Math.floor(beat);
    const phase = beat - bi;
    const pulse = s.started && beat >= 0 && !s.ended ? Math.exp(-phase * 5) : 0;

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
      const py = ((b.y * this.h - this.cam.y * b.depth * 0.25) % this.h + this.h) % this.h;
      if (th.night && b.ci % 3 === 0) {
        const tw = 0.5 + 0.5 * Math.sin(this.time * 2 + b.tw);
        ctx.globalAlpha = 0.4 + 0.6 * tw;
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath(); ctx.arc(px, py, 1.6 + b.depth * 1.4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = (th.night ? 0.2 : 0.38) * b.depth;
        ctx.fillStyle = th.bokeh[b.ci % th.bokeh.length];
        ctx.beginPath(); ctx.arc(px, py, b.r * (1 + pulse * 0.15 * b.depth), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (th.night) {
      const mx = this.w * 0.84, my = this.h * 0.17;
      ctx.fillStyle = 'rgba(255,240,200,0.10)';
      ctx.beginPath(); ctx.arc(mx, my, 66 + pulse * 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff1c4';
      ctx.beginPath(); ctx.arc(mx, my, 36, 0, Math.PI * 2); ctx.fill();
    }

    /* ---------- 카메라 ---------- */
    const cat = this.catState(t);
    const tiles = s.chart.tiles;
    let ax = 0, ay = 0, an = 0;
    for (let i = cat.k; i <= Math.min(cat.k + 6, tiles.length - 1); i++) { ax += tiles[i].x * GAP; ay += tiles[i].y * GAP; an++; }
    const tx = lerp(cat.P.x, ax / an, 0.6), ty = lerp(cat.P.y, ay / an, 0.6);
    const f = 1 - Math.exp(-dt * 4);
    this.cam.x = lerp(this.cam.x, tx, f);
    this.cam.y = lerp(this.cam.y, ty, f);
    this.cam.zoom = clamp(Math.min(this.w, this.h) / 640, 0.75, 1.5);
    this.cam.shake *= Math.exp(-dt * 12);
    const shx = (Math.random() - 0.5) * this.cam.shake;
    const shy = (Math.random() - 0.5) * this.cam.shake;

    ctx.save();
    ctx.translate(this.w / 2 + shx, this.h / 2 + shy + this.yShift);
    const z = this.cam.zoom * (1 + pulse * 0.01);
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);

    const judged = s.judged;
    const viewR = (Math.max(this.w, this.h) / z) * 0.7;
    const vis = (tl) => Math.abs(tl.x * GAP - this.cam.x) < viewR && Math.abs(tl.y * GAP - this.cam.y) < viewR;
    const reveal = (i) => clamp(1 - (i - (judged + 30)) / 10, 0, 1);

    /* ---------- 길 (띠) ---------- */
    ctx.strokeStyle = th.path;
    ctx.lineWidth = 30;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < tiles.length - 1; i++) {
      const a = tiles[i], b = tiles[i + 1];
      const al = reveal(i + 1);
      if (al <= 0 || (!vis(a) && !vis(b))) continue;
      ctx.globalAlpha = al;
      ctx.beginPath(); ctx.moveTo(a.x * GAP, a.y * GAP); ctx.lineTo(b.x * GAP, b.y * GAP); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* ---------- 발판 ---------- */
    for (let i = 0; i < tiles.length; i++) {
      const tl = tiles[i];
      const al = reveal(i);
      if (al <= 0 || !vis(tl)) continue;
      const st = s.tileState[i];
      const x = tl.x * GAP, y = tl.y * GAP;
      let scale = 1;
      if (st && st.grade !== 'start') {
        const since = t - st.time;
        if (since >= 0 && since < 0.3) scale = 1 + 0.2 * (1 - easeOutBack(since / 0.3));
      }
      if (i === judged + 1) scale *= 1 + pulse * 0.05;
      const last = i === tiles.length - 1;
      if (last) scale *= 1.2;
      const sz = TS * scale;

      ctx.save();
      ctx.globalAlpha = al;
      ctx.translate(x, y);
      ctx.rotate((-tl.heading * Math.PI) / 180);
      ctx.fillStyle = th.tileShadow;
      roundRect(ctx, -sz / 2, -sz / 2 + 5, sz, sz, 13);
      ctx.fill();
      let fill = th.tile;
      if (st && GRADE_INFO[st.grade]) fill = mixColor(th.tile, GRADE_INFO[st.grade].color, 0.38);
      else if (i === judged + 1) fill = mixColor(th.tile, th.accent, 0.12 + pulse * 0.1);
      ctx.fillStyle = fill;
      roundRect(ctx, -sz / 2, -sz / 2, sz, sz, 13);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = al;
      if (st && GRADE_INFO[st.grade]) {
        drawPaw(ctx, x, y + 2, 13 * scale, st.grade === 'miss' ? 'rgba(120,110,130,0.45)' : GRADE_INFO[st.grade].color);
      } else if (last) {
        drawFish(ctx, x, y + 1, th.accent);
      }
      // 빙글 발판: 회전 방향이 바뀜
      if (tl.twirl) drawSpiral(ctx, x, y, 12, th.accent, tl.rot);
      // 추가 회전 수
      if (tl.loops > 0 && !st) {
        ctx.font = '15px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = th.tile;
        const label = `+${tl.loops}바퀴`;
        ctx.strokeText(label, x, y - sz / 2 - 6);
        ctx.fillStyle = th.accent;
        ctx.fillText(label, x, y - sz / 2 - 6);
      }
      if (tl.bpmChange && !st) {
        ctx.font = '18px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = tl.bpmChange > 0 ? '#ff4f6d' : '#4f8bff';
        ctx.fillText(tl.bpmChange > 0 ? '»»' : '««', x, y + 6);
      }
      ctx.restore();
    }

    /* ---------- 회전 궤도 가이드 ---------- */
    if (cat.L > 0.5 && !s.ended) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = th.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 9]);
      ctx.beginPath(); ctx.arc(cat.P.x, cat.P.y, GAP, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // 잔상 꼬리
      const span = 0.9;
      for (let i = 0; i < 10; i++) {
        const a0 = cat.phi - cat.rot * span * (i / 10);
        const a1 = cat.phi - cat.rot * span * ((i + 1) / 10);
        ctx.globalAlpha = 0.28 * (1 - i / 10);
        ctx.lineWidth = 9 * (1 - i / 12);
        ctx.beginPath();
        ctx.arc(cat.P.x, cat.P.y, GAP * cat.L, -a0, -a1, cat.rot < 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---------- 파티클 ---------- */
    this.drawParticles(ctx, dt);

    /* ---------- 고양이 ---------- */
    let mood = 'normal';
    if (t - this.lastMissAt < 0.6 || (s.ended && s.result && !s.result.cleared)) mood = 'dizzy';
    else if (t - this.lastHappyAt < 0.22) mood = 'happy';
    else if ((this.time % 3.1) < 0.12) mood = 'blink';
    if (s.ended && s.result && s.result.cleared) mood = 'happy';

    if (cat.L < 0.3) {
      ctx.save();
      ctx.translate(cat.P.x, cat.P.y + 14);
      drawCat(ctx, this.skin, { face: this.face, t: this.time, mood, sy: 1 - pulse * 0.05 });
      ctx.restore();
    } else {
      const H = cat.pivotIsHead ? cat.P : cat.S;
      const B = cat.pivotIsHead ? cat.S : cat.P;
      if (Math.abs(H.x - B.x) > 6) this.face = Math.sign(H.x - B.x);
      drawStretchCat(ctx, this.skin, {
        B, H, t: this.time, mood, face: this.face,
        bend: cat.rot * 9 * (cat.pivotIsHead ? -1 : 1) * cat.L,
        swingIsHead: !cat.pivotIsHead,
      });
    }

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
      ctx.font = `${p.small ? 15 : 22}px Jua, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      if (p.sub) {
        ctx.font = '13px Jua, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeText(p.sub, 0, 16);
        ctx.fillStyle = '#9a8aa6';
        ctx.fillText(p.sub, 0, 16);
      }
      ctx.restore();
    }
    ctx.restore();

    /* ---------- 카운트다운 ---------- */
    if (!s.demo && s.started && beat >= -3 && beat < 0.7) {
      const label = bi >= 0 ? '냥!' : String(-bi);
      const sc = 1 + 0.5 * Math.exp(-phase * 7);
      ctx.save();
      ctx.translate(this.w / 2, this.h * 0.26);
      ctx.scale(sc, sc);
      ctx.globalAlpha = 1 - phase * 0.6;
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
