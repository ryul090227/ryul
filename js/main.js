/* =========================================================
 * 메인: 화면 전환, 입력, 저장, 게임 루프
 * ========================================================= */

const store = {
  get(k, d) {
    try { const v = localStorage.getItem('kkstep.' + k); return v == null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) { try { localStorage.setItem('kkstep.' + k, JSON.stringify(v)); } catch { /* 무시 */ } },
};

const params = new URLSearchParams(location.search);
const settings = {
  volume: store.get('volume', 80),
  offset: store.get('offset', 0),
  auto: params.has('auto') || store.get('auto', false),
  skin: store.get('skin', 'cheese'),
};
const best = store.get('best', {});

const $ = (id) => document.getElementById(id);
const audio = new AudioEngine();
audio.setVolume(settings.volume / 100);
const renderer = new Renderer($('game'));
renderer.skin = SKINS.find((s) => s.id === settings.skin) || SKINS[0];

let session = null;   // 실제 플레이 세션
let demo = null;      // 메뉴 배경용 자동 산책
let currentLevel = null;
let screen = 'title';

/* ---------- 화면 전환 ---------- */
function show(name) {
  screen = name;
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === 'screen-' + name));
  if (name === 'select') buildSelect();
}

document.querySelectorAll('[data-go]').forEach((b) =>
  b.addEventListener('click', () => { audio.ensure(); audio.uiBlip(); show(b.dataset.go); }));

/* ---------- 데모 (메뉴 배경) ---------- */
function startDemo(level = LEVELS[0]) {
  demo = new Session(level, { demo: true, auto: true });
  demo.start();
  renderer.attach(demo);
}

/* ---------- 레벨 선택 화면 ---------- */
function buildSelect() {
  const skinsEl = $('skins');
  skinsEl.innerHTML = '';
  for (const sk of SKINS) {
    const b = document.createElement('button');
    b.className = 'skin' + (sk.id === settings.skin ? ' sel' : '');
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const c = cv.getContext('2d');
    c.scale(2, 2); c.translate(32, 58);
    drawCat(c, sk, { face: 1, t: 0.5, mood: 'normal' });
    b.append(cv, sk.name);
    b.onclick = () => {
      settings.skin = sk.id; store.set('skin', sk.id);
      renderer.skin = sk; audio.uiBlip(); buildSelect();
    };
    skinsEl.append(b);
  }

  const grid = $('levels');
  grid.innerHTML = '';
  for (const lv of LEVELS) {
    const card = document.createElement('button');
    card.className = 'level-card';
    card.style.setProperty('--c-top', lv.theme.bgTop);
    card.style.setProperty('--c-bottom', lv.theme.bgBottom);
    card.style.setProperty('--c-text', lv.theme.text);
    const rec = best[lv.id];
    const notes = buildChart(lv).tiles.length - 1;
    card.innerHTML = `
      <span class="lv-best ${rec ? '' : 'none'}">${rec ? rec.rank : '—'}</span>
      <span class="lv-name">${lv.name}</span>
      <span class="lv-sub">${lv.sub}</span>
      <span class="lv-meta"><span>${'🐾'.repeat(lv.difficulty)}</span><span>BPM ${lv.bpm} · ${notes}칸</span></span>
      ${rec ? `<span class="lv-meta" style="margin-top:6px"><span>최고 기록</span><span>${(rec.acc * 100).toFixed(1)}%</span></span>` : ''}`;
    card.onmouseenter = () => { if (demo && demo.level !== lv) startDemo(lv); };
    card.onclick = () => startLevel(lv);
    grid.append(card);
  }
}

/* ---------- 플레이 ---------- */
function startLevel(level) {
  audio.ensure();
  if (session) session.stop();
  currentLevel = level;
  session = new Session(level, {
    audio, auto: settings.auto, offsetMs: settings.offset,
    onEnd: (r) => setTimeout(() => showResult(r), r.cleared ? 900 : 700),
  });
  renderer.attach(session);
  buildHUD();
  session.start();
  show('none');
  $('hud').classList.remove('hidden');
}

function quitToMenu(to = 'select') {
  if (session) { session.stop(); session = null; }
  $('hud').classList.add('hidden');
  startDemo(currentLevel || LEVELS[0]);
  show(to);
}

function buildHUD() {
  const lives = $('lives');
  lives.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const h = document.createElement('span');
    h.className = 'h'; h.textContent = '♥';
    lives.append(h);
  }
  $('level-name').textContent = `${currentLevel.name}${settings.auto ? ' · 구경 모드' : ''}`;
  $('hud').classList.toggle('night', !!currentLevel.theme.night);
  hudCache = {};
}

let hudCache = {};
function updateHUD() {
  const s = session;
  if (!s) return;
  if (hudCache.combo !== s.combo) {
    const el = $('combo');
    $('combo-num').textContent = s.combo;
    el.classList.toggle('zero', s.combo < 2);
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    hudCache.combo = s.combo;
  }
  if (hudCache.lives !== s.lives) {
    [...$('lives').children].forEach((h, i) => h.classList.toggle('lost', i >= s.lives));
    hudCache.lives = s.lives;
  }
  if (hudCache.judged !== s.judged) {
    const acc = s.judged ? s.scoreSum / (300 * s.judged) : 1;
    $('acc').textContent = (acc * 100).toFixed(1) + '%';
    $('progress-fill').style.width = (s.judged / s.totalNotes) * 100 + '%';
    hudCache.judged = s.judged;
  }
}

function showResult(r) {
  if (!session || screen === 'result') return;
  $('res-title').textContent = r.cleared ? `${currentLevel.name} 산책 완료!` : '아홉 목숨을 다 썼어요…';
  const rank = $('res-rank');
  rank.textContent = r.rank;
  rank.className = 'rank ' + r.rank;
  $('res-acc').textContent = (r.accuracy * 100).toFixed(2) + '%';
  for (const g of ['perfect', 'great', 'good', 'miss']) $('res-' + g).textContent = r.counts[g];
  $('res-combo').textContent = r.maxCombo;

  const badges = [];
  if (r.allPerfect) badges.push('<span class="badge gold">ALL PURRFECT</span>');
  else if (r.fullCombo) badges.push('<span class="badge">FULL COMBO</span>');
  if (r.cleared && !settings.auto) {
    const prev = best[currentLevel.id];
    if (!prev || r.accuracy > prev.acc) {
      best[currentLevel.id] = { acc: r.accuracy, rank: r.rank, fc: r.fullCombo };
      store.set('best', best);
      badges.push('<span class="badge gold">NEW BEST</span>');
    }
  }
  $('res-badges').innerHTML = badges.join('');
  show('result');
}

/* ---------- 일시정지 ---------- */
function pauseGame() {
  if (!session || session.ended || session.paused) return;
  session.pause();
  show('pause');
}
function resumeGame() {
  if (!session) return;
  session.resume();
  show('none');
}
$('btn-pause').onclick = pauseGame;
$('btn-resume').onclick = resumeGame;
$('btn-retry-p').onclick = () => startLevel(currentLevel);
$('btn-retry').onclick = () => startLevel(currentLevel);
$('btn-quit').onclick = () => quitToMenu('select');
$('btn-back').onclick = () => quitToMenu('select');
window.addEventListener('blur', pauseGame);

/* ---------- 입력 ---------- */
const playing = () => session && !session.paused && !session.ended && screen === 'none';

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'Escape') {
    if (screen === 'pause') resumeGame();
    else if (playing()) pauseGame();
    return;
  }
  if (playing()) {
    e.preventDefault();
    session.press();
  } else if (screen === 'title' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    audio.ensure(); show('select');
  } else if (screen === 'result' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    startLevel(currentLevel);
  }
});

$('game').addEventListener('pointerdown', (e) => {
  if (playing()) { e.preventDefault(); session.press(); }
});

/* ---------- 설정 화면 ---------- */
function bindSettings() {
  const vol = $('opt-volume'), off = $('opt-offset'), auto = $('opt-auto');
  vol.value = settings.volume;
  off.value = settings.offset;
  auto.checked = settings.auto;
  const label = () => {
    $('vol-val').textContent = settings.volume + '%';
    $('off-val').textContent = (settings.offset > 0 ? '+' : '') + settings.offset + 'ms';
  };
  label();
  vol.oninput = () => { settings.volume = +vol.value; audio.setVolume(settings.volume / 100); store.set('volume', settings.volume); label(); };
  off.oninput = () => { settings.offset = +off.value; store.set('offset', settings.offset); label(); };
  auto.onchange = () => { settings.auto = auto.checked; store.set('auto', settings.auto); };
}
bindSettings();

/* ---------- 루프 ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const s = session || demo;
  if (s) {
    s.update();
    if (s === demo && demo.ended) startDemo(demo.level);
    renderer.draw(dt);
  }
  updateHUD();
  requestAnimationFrame(frame);
}

startDemo();
requestAnimationFrame(frame);

// 디버그용
window.__game = { get session() { return session; }, startLevel, LEVELS };
