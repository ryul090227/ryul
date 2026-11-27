/* =========================================================
 * 레벨 = 노래(songs.js) + 난이도 + 테마
 * 채보(발판 모양)는 노래의 각 섹션 map 설정으로 자동 생성됩니다.
 * ========================================================= */

const TIERS = {
  easy:    { name: '쉬움',  color: '#5fc97a', paws: 1 },
  normal:  { name: '보통',  color: '#4ea8ff', paws: 2 },
  hard:    { name: '어려움', color: '#ff9a3c', paws: 3 },
  extreme: { name: '극악',  color: '#e0457b', paws: 4 },
};

const LEVELS = [
  {
    id: 'stroll', tier: 'easy', song: SONG_STROLL, lives: 9, seed: 11,
    sub: 'Afternoon Stroll',
    theme: {
      bgTop: '#ffe3ec', bgBottom: '#fff3df',
      tile: '#ffffff', tileShadow: '#f2c3d1', path: '#ffd3e0',
      accent: '#ff6f9f', text: '#7a4a5c',
      bokeh: ['#ffc2d4', '#ffe0a8', '#ffd6f0', '#ffffff'], night: false,
    },
  },
  {
    id: 'fishtap', tier: 'normal', song: SONG_TAP, lives: 7, seed: 7,
    sub: 'Fish Market Tap',
    theme: {
      bgTop: '#d4f4ef', bgBottom: '#e4ecff',
      tile: '#ffffff', tileShadow: '#addcd9', path: '#c3ebe6',
      accent: '#1fa89f', text: '#2f5f63',
      bokeh: ['#b7ecff', '#c9fff0', '#ffffff', '#ffe9b0'], night: false,
    },
  },
  {
    id: 'moonroof', tier: 'hard', song: SONG_MOON, lives: 5, seed: 3,
    sub: 'Moonlit Rooftops',
    theme: {
      bgTop: '#231f4a', bgBottom: '#5b4b8f',
      tile: '#fff7e8', tileShadow: '#a897d4', path: '#4a3f80',
      accent: '#ffd56b', text: '#fff2d6',
      bokeh: ['#ffe8a3', '#c9b8ff', '#ffffff', '#ffb8d9'], night: true,
    },
  },
  {
    id: 'zoomies', tier: 'extreme', song: SONG_ZOOM, lives: 3, seed: 5,
    sub: 'Zoomies!',
    theme: {
      bgTop: '#2a0f2e', bgBottom: '#7a1f4f',
      tile: '#fff0f6', tileShadow: '#c44a86', path: '#5a1f4a',
      accent: '#ff4f8b', text: '#ffe3ef',
      bokeh: ['#ff7fb0', '#ffd36b', '#9be7ff', '#ffffff'], night: true,
    },
  },
];

/* 고양이 스킨 */
const SKINS = [
  {
    id: 'cheese', name: '치즈냥',
    body: '#ffc27a', belly: '#fff3e2', line: '#8a5a3c', ear: '#ffb0b8',
    stripe: '#ef9748', eye: '#3b2a2a',
  },
  {
    id: 'black', name: '까망이',
    body: '#3d3550', belly: '#585070', line: '#1c1727', ear: '#ff9fb4',
    eye: '#ffe27a', pupil: '#1c1727',
  },
  {
    id: 'calico', name: '삼색이',
    body: '#fffaf3', belly: '#ffffff', line: '#7a6155', ear: '#ffb0b8',
    eye: '#3b2a2a',
    patches: [
      { c: '#f4a259', x: -7, y: -44, r: 9 },
      { c: '#4a3f45', x: 15, y: -41, r: 7 },
    ],
    bodyPatches: [{ c: '#f4a259', x: -12, y: -14, r: 8 }],
    stretchPatches: [{ c: '#f4a259', from: 0.22, to: 0.42 }, { c: '#4a3f45', from: 0.58, to: 0.72 }],
  },
];
