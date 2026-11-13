/* =========================================================
 * 레벨 데이터
 * ---------------------------------------------------------
 * path 문법 (공백으로 구분된 토큰):
 *   방향 글자  : R(→) L(←) U(↑) D(↓) E(↗) Q(↖) Z(↙) C(↘)
 *   박자 길이  : 방향 뒤 숫자. 생략 시 1박.  예) R2, U0.5
 *   반복       : *N 으로 반복.               예) R*4, R0.5*8
 *   BPM 변경   : @숫자 → 이후 칸부터 적용.    예) @160
 *
 * 각 토큰은 "고양이가 다음 칸으로 한 번 점프"를 뜻하고,
 * 박자 길이만큼 기다렸다가 착지 순간에 키를 누르면 됩니다.
 *
 * key        : 곡의 으뜸음 (MIDI 번호, 60 = C4)
 * progression: 마디마다 바뀌는 코드 (장음계 도수, 0 = I)
 * melody     : 칸을 밟을 때마다 순서대로 나는 음 (장음계 도수)
 * ========================================================= */

const LEVELS = [
  {
    id: 'stroll',
    name: '첫 산책',
    sub: 'Morning Stroll',
    difficulty: 1,
    bpm: 100,
    key: 60,
    progression: [0, 4, 5, 3],
    melody: [0, 2, 4, 2, 4, 5, 4, 2, 0, 2, 4, 7, 5, 4, 2, 4],
    music: { four: false, clap: false, hats: true },
    theme: {
      bgTop: '#ffe3ec', bgBottom: '#fff3df',
      tile: '#ffffff', tileShadow: '#f2c3d1', line: '#f6b6c9',
      accent: '#ff7fa8', text: '#7a4a5c',
      bokeh: ['#ffc2d4', '#ffe0a8', '#ffd6f0', '#ffffff'],
      night: false,
    },
    path: 'R*4 U*4 R*4 D*4 R*4 U*2 R*2 D*2 R*4 U*4 L*4 U*4 R*8',
  },
  {
    id: 'fishmarket',
    name: '생선가게 골목',
    sub: 'Fish Market Alley',
    difficulty: 2,
    bpm: 120,
    key: 62,
    progression: [0, 5, 3, 4],
    melody: [4, 4, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 4, 0, 1],
    music: { four: false, clap: true, hats: true },
    theme: {
      bgTop: '#d7f5f1', bgBottom: '#e6eeff',
      tile: '#ffffff', tileShadow: '#b5dcdc', line: '#8fd0cc',
      accent: '#2fb3aa', text: '#2f5f63',
      bokeh: ['#b7ecff', '#c9fff0', '#ffffff', '#ffe9b0'],
      night: false,
    },
    path: 'R*4 E*4 R*4 C*4 R0.5*4 R*2 U*4 Q*2 U*2 E*4 R0.5*8 R2 D*4 C*4 R*8',
  },
  {
    id: 'moonroof',
    name: '달빛 지붕 위',
    sub: 'Moonlit Rooftops',
    difficulty: 3,
    bpm: 132,
    key: 57,
    progression: [5, 3, 0, 4],
    melody: [5, 4, 2, 4, 5, 7, 9, 7, 5, 4, 2, 0, 2, 4, 5, 2],
    music: { four: true, clap: true, hats: true },
    theme: {
      bgTop: '#231f4a', bgBottom: '#5b4b8f',
      tile: '#fff7e8', tileShadow: '#a897d4', line: '#9a88d4',
      accent: '#ffd56b', text: '#fff2d6',
      bokeh: ['#ffe8a3', '#c9b8ff', '#ffffff', '#ffb8d9'],
      night: true,
    },
    path:
      'R*4 U*4 R*4 D*2 R*2 U*2 R*2 D*4 L*2 D*2 R*8 ' +
      '@160 E*4 R*4 C*4 R0.5*8 U*4 L*4 U*4 R*8',
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
  },
];
