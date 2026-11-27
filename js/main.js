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
  musicVol: store.get('musicVol', 80),
  sfxVol: store.get('sfxVol', 70),
  offset: store.get('offset', 0),
  auto: params.has('auto') || store.get('auto', false),
  skin: store.get('skin', 'cheese'),
};
const best = store.get('best2', {});

const $ = (id) => document.getElementById(id);
const audio = new AudioEngine();
audio.setMusicVolume(settings.musicVol / 100);
audio.setSfxVolume(settings.sfxVol / 100);
const renderer = new Renderer($('game'));
renderer.skin = SKINS.find((s) => s.id === settings.skin) || SKINS[0];

const chartInfo = {};
for (const lv of LEVELS) {
  const c = buildChart(lv);
  chartInfo[lv.id] = { notes: c.tiles.length - 1, length: c.endTime };
}

let session = null;   // 실제 플레이
let demo = null;      // 메뉴 배경 (자동 플레이)
let selected = LEVELS[0];
let screen = 'title';

/* ---------- 화면 전환 ---------- */
function show(name) {
  const prev = screen;
  screen = name;
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === 'screen-' + name));
  if (name === 'select') {
    buildSelect();
    if (prev !== 'select') startDemo(selected, true);
  } else if (prev === 'select' && !session) {
    startDemo(selected, false);
  }
  renderer.yShift = name === 'title' ? renderer.h * 0.3 : name === 'select' ? renderer.h * 0.36 : 0;
}

document.querySelectorAll('[data-go]').forEach((b) =>
  b.addEventListener('click', () => { audio.ensure(); audio.uiBlip(); show(b.dataset.go); }));

/* ---------- 데모 (메뉴 배경 + 미리듣기) ---------- */
function startDemo(level, withMusic) {
  if (demo) demo.stop();
  demo = new Session(level, { demo: true, auto: true, audio: withMusic && audio.ctx ? audio : null });
  demo.start();
  renderer.attach(demo);
}

/* ---------- 레벨 선택 ---------- */
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

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
    const tier = TIERS[lv.tier];
    const card = document.createElement('button');
    card.className = 'level-card' + (lv === selected ? ' sel' : '');
    card.style.setProperty('--c-top', lv.theme.bgTop);
    card.style.setProperty('--c-bottom', lv.theme.bgBottom);
    card.style.setProperty('--c-text', lv.theme.text);
    const rec = best[lv.id];
    card.innerHTML = `
      <span class="tier" style="background:${tier.color}">${tier.name}</span>
      <span class="lv-best ${rec ? '' : 'none'}">${rec ? rec.rank : '—'}</span>
      <span class="lv-name">${lv.song.title}</span>
      <span class="lv-sub">${lv.sub}</span>
      <span class="lv-meta"><span>${'🐾'.repeat(tier.paws)}</span><span>BPM ${lv.song.bpm}</span></span>`;
    card.onclick = () => {
      if (selected === lv) { startLevel(lv); return; }
      selected = lv;
      audio.ensure();
      startDemo(lv, true);
      buildSelect();
    };
    grid.append(card);
  }

  const info = chartInfo[selected.id];
  const rec = best[selected.id];
  $('detail').innerHTML = `
    <span class="now">♪ ${selected.song.title}</span>
    <span>난이도 <b style="color:${TIERS[selected.tier].color}">${TIERS[selected.tier].name}</b></span>
    <span>길이 <b>${fmtTime(info.length)}</b></span>
    <span>발판 <b>${info.notes}칸</b></span>
    <span>목숨 <b>${'♥'.repeat(selected.lives)}</b></span>
    ${rec ? `<span>최고 <b>${(rec.acc * 100).toFixed(1)}%</b></span>` : ''}`;
}
$('btn-play').onclick = () => startLevel(selected);

/* ---------- 플레이 ---------- */
function startLevel(level) {
  audio.ensure();
  if (demo) { demo.stop(); demo = null; }
  if (session) session.stop();
  selected = level;
  session = new Session(level, {
    audio, auto: settings.auto, offsetMs: settings.offset,
    onEnd: (r) => setTimeout(() => showResult(r), r.cleared ? 1600 : 1200),
  });
  renderer.attach(session);
  buildHUD();
  session.start();
  show('none');
  $('hud').classList.remove('hidden');
}

function quitToMenu() {
  if (session) { session.stop(); session = null; }
  $('hud').classList.add('hidden');
  screen = 'none';
  show('select');
}

function buildHUD() {
  const lives = $('lives');
  lives.innerHTML = '';
  for (let i = 0; i < session.maxLives; i++) {
    const h = document.createElement('span');
    h.className = 'h'; h.textContent = '♥';
    lives.append(h);
  }
  const tier = TIERS[selected.tier];
  $('level-name').textContent = `${tier.name} · ${selected.song.title}${settings.auto ? ' · 구경 모드' : ''}`;
  $('hud').classList.toggle('night', !!selected.theme.night);
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
  $('res-title').textContent = r.cleared
    ? `${selected.song.title} 완주!`
    : `목숨을 다 썼어요… (${Math.round(r.progress * 100)}% 지점)`;
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
    const prev = best[selected.id];
    if (!prev || r.accuracy > prev.acc) {
      best[selected.id] = { acc: r.accuracy, rank: r.rank, fc: r.fullCombo };
      store.set('best2', best);
      badges.push('<span class="badge gold">NEW BEST</span>');
    }
  }
  $('res-badges').innerHTML = badges.join('');
  show('result');
}

/* ---------- 일시정지 ---------- */
function pauseGame() {
  if (!session || session.ended || session.paused || screen !== 'none') return;
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
$('btn-retry-p').onclick = () => startLevel(selected);
$('btn-retry').onclick = () => startLevel(selected);
$('btn-quit').onclick = quitToMenu;
$('btn-back').onclick = quitToMenu;
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
  } else if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('button')) {
    e.preventDefault();
    if (screen === 'title') { audio.ensure(); show('select'); }
    else if (screen === 'select' || screen === 'result') startLevel(selected);
  }
});

$('game').addEventListener('pointerdown', (e) => {
  if (playing()) { e.preventDefault(); session.press(); }
});

/* ---------- 설정 ---------- */
function bindSettings() {
  const mv = $('opt-mvol'), sv = $('opt-svol'), off = $('opt-offset'), auto = $('opt-auto');
  mv.value = settings.musicVol;
  sv.value = settings.sfxVol;
  off.value = settings.offset;
  auto.checked = settings.auto;
  const label = () => {
    $('mvol-val').textContent = settings.musicVol + '%';
    $('svol-val').textContent = settings.sfxVol + '%';
    $('off-val').textContent = (settings.offset > 0 ? '+' : '') + settings.offset + 'ms';
  };
  label();
  mv.oninput = () => { settings.musicVol = +mv.value; audio.setMusicVolume(settings.musicVol / 100); store.set('musicVol', settings.musicVol); label(); };
  sv.oninput = () => { settings.sfxVol = +sv.value; audio.setSfxVolume(settings.sfxVol / 100); store.set('sfxVol', settings.sfxVol); label(); };
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
    if (s === demo && demo.ended && demo.t() > demo.chart.endTime + 2) startDemo(demo.level, !!demo.audio);
    renderer.draw(dt);
  }
  updateHUD();
  requestAnimationFrame(frame);
}

startDemo(LEVELS[0], false);
renderer.yShift = renderer.h * 0.3;
requestAnimationFrame(frame);

// 디버그용
window.__game = { get session() { return session; }, get demo() { return demo; }, startLevel, LEVELS, audio };
