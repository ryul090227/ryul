/* =========================================================
 * 노래 데이터 (전부 Web Audio로 실시간 합성)
 * ---------------------------------------------------------
 * 곡 = 섹션(section)들의 배열(order).
 * 섹션마다:
 *   bars    마디 수 (4/4)
 *   chords  마디별 코드 (부족하면 반복)  예) 'F', 'Dm', 'C7', 'Bbmaj7'
 *   drums   DRUMS 패턴 이름 / fill: 마지막 마디용 패턴
 *   bass    BASS 패턴 이름
 *   pad     true면 코드 패드
 *   arp     { rate: 박, inst, vel } 코드 아르페지오
 *   lead    멜로디  "음:박 음:박 ..."  (r = 쉼표, '|'는 마디 구분용 장식)
 *   crash   섹션 시작에 심벌
 *
 *   map     이 구간의 채보(발판) 생성 방식
 *            'lead'    멜로디 음마다 발판
 *            'beat'    매 박
 *            'eighth'  8분음표마다
 *            'every:3' 3박마다 (고양이가 한 바퀴 더 돔)
 *            'pat:1 .5 .5'  박 길이 패턴 반복
 *   fill    발판 간격이 2박 이상일 때: 'beat'(박으로 채움) | 'loop'(빙글 회전)
 *   twirl   0~1, 회전 방향 뒤집기(빙글 발판)가 나올 확률
 *
 * order 항목에 { s: '이름', bpm: 152 } 처럼 쓰면 그 지점부터 BPM 변경.
 * ========================================================= */

/* 드럼 패턴: 한 마디를 N칸으로 나눈 문자열 (16칸 = 16분, 12칸 = 셋잇단 8분)
 * x = 보통, X = 강하게, g = 약하게(고스트) */
const DRUMS = {
  hatsOnly:  { h: '..x...x...x...x.' },
  softIntro: { k: 'x.......x.......', h: '..g...g...g...g.' },
  soft:      { k: 'x.......x..x....', s: '....g.......g...', h: '..x...x...x...x.' },
  pop:       { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  funk:      { k: 'x..x..x...x.....', s: '....X.......X..g', h: 'xgxgxgxgxgxgxgxg' },
  four:      { k: 'X...x...X...x...', c: '....x.......x...', h: '..x...x...x...x.', o: '..g...g...g...g.' },
  drive:     { k: 'X...x...X...x...', s: '....X.......X...', h: 'xgxgxgxgxgxgxgxg', o: '..x...x...x...x.' },
  half:      { k: 'x...............', s: '........x.......', h: 'x...x...x...x...' },
  shuffle:   { k: 'x.....x..x..', s: '...X.....X..', h: 'x.gx.gx.gx.g' },
  fillA:     { k: 'x.......x.x.x...', s: '....x...x.xxXxXX', h: 'x.x.x.x.........' },
  fillB:     { k: 'X...x...x.x.x.x.', s: '....X.x.XxXxXXXX' },
  fillT:     { k: 'x.....x..x..', s: '...X..XxxXXX' },
};

/* 베이스 패턴 (16칸): R 근음, O 옥타브 위, 5 5도, 3 3도, 7 7도, . 이어서, - 끊기 */
const BASS = {
  long:    'R...............',
  simple:  'R.......5.......',
  walk:    'R...3...5...O...',
  pulse8:  'R-R-R-R-R-R-R-R-',
  octave:  'R-O-R-O-R-O-R-O-',
  bounce:  'R..R..O.R..R.5O.',
  offbeat: '--R---R---R---R-',
  trip:    'R..R..O..5..',
};

/* ---------------- 1. 쉬움: 산책하는 오후 ---------------- */
const SONG_STROLL = {
  title: '산책하는 오후', artist: '꾹꾹 밴드', bpm: 100,
  lead: 'bell', leadVel: 0.9,
  sections: {
    intro: {
      bars: 4, chords: ['F', 'Dm', 'Bb', 'C'], drums: 'softIntro', bass: 'long', pad: true,
      arp: { rate: 0.5, inst: 'bell', vel: 0.45 }, map: 'beat',
    },
    A: {
      bars: 8, chords: ['F', 'Dm', 'Bb', 'C'], drums: 'soft', fill: 'fillA', bass: 'simple', pad: true,
      lead: 'C5:1 A4:.5 C5:.5 F5:1 E5:1 | D5:1.5 C5:.5 A4:1 r:1 | Bb4:1 D5:.5 F5:.5 D5:1 Bb4:1 | C5:1.5 D5:.5 E5:1 G5:1 |' +
            'A5:1 G5:.5 F5:.5 C5:1 F5:1 | A5:1 F5:1 D5:1 F5:1 | F5:1 D5:.5 Bb4:.5 D5:1 F5:1 | E5:1.5 D5:.5 C5:2',
      map: 'lead',
    },
    B: {
      bars: 8, chords: ['Bb', 'C', 'Am', 'Dm', 'Bb', 'C7', 'F', 'F'], drums: 'pop', fill: 'fillA', bass: 'walk', pad: true, crash: true,
      lead: 'D5:1 F5:1 Bb5:1 A5:1 | G5:1 E5:1 C5:1 E5:1 | A5:1.5 G5:.5 E5:1 C5:1 | D5:2 F5:1 A5:1 |' +
            'Bb5:1 A5:.5 G5:.5 F5:1 D5:1 | E5:1 G5:1 C6:1 Bb5:1 | A5:1.5 G5:.5 F5:1 C5:1 | F5:3 r:1',
      map: 'lead',
    },
    outro: {
      bars: 4, chords: ['F', 'Bb', 'C', 'F'], drums: 'soft', bass: 'simple', pad: true,
      arp: { rate: 0.5, inst: 'bell', vel: 0.45 }, map: 'beat',
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'outro'],
  finalChord: 'F',
};
SONG_STROLL.sections.A2 = { ...SONG_STROLL.sections.A, arp: { rate: 0.5, inst: 'bell', vel: 0.35 }, crash: true };

/* ---------------- 2. 보통: 생선가게 탭댄스 ---------------- */
const SONG_TAP = {
  title: '생선가게 탭댄스', artist: '꾹꾹 밴드', bpm: 124,
  lead: 'pluck', leadVel: 1,
  sections: {
    intro: {
      bars: 4, chords: ['D', 'Bm', 'G', 'A'], drums: 'hatsOnly', bass: 'octave', pad: true,
      arp: { rate: 0.5, inst: 'pluck', vel: 0.5 }, map: 'beat',
    },
    A: {
      bars: 8, chords: ['D', 'Bm', 'G', 'A'], drums: 'funk', fill: 'fillA', bass: 'bounce', crash: true,
      lead: 'F#5:.5 A5:.5 r:.5 A5:.5 B5:.5 A5:.5 F#5:1 | D5:.5 F#5:.5 r:.5 F#5:.5 E5:.5 D5:.5 B4:1 |' +
            'G5:.5 B5:.5 r:.5 B5:.5 A5:.5 G5:.5 D5:1 | E5:1 F#5:.5 E5:.5 C#5:1 A4:1 |' +
            'F#5:.5 A5:.5 r:.5 A5:.5 B5:.5 A5:.5 F#5:1 | D5:.5 F#5:.5 r:.5 F#5:.5 E5:.5 D5:.5 B4:1 |' +
            'G5:.5 B5:.5 r:.5 B5:.5 A5:.5 G5:.5 D5:1 | E5:.5 F#5:.5 G5:.5 A5:.5 C#6:1 r:1',
      map: 'lead', twirl: 0.15,
    },
    B: {
      bars: 8, chords: ['Em', 'A', 'D', 'Bm', 'G', 'A', 'D', 'D'], drums: 'pop', fill: 'fillA', bass: 'walk', pad: true,
      lead: 'G5:1 E5:.5 G5:.5 B5:1 A5:1 | A5:1.5 G5:.5 E5:1 C#5:1 | F#5:1 D5:.5 F#5:.5 A5:1 D6:1 | B5:1.5 A5:.5 F#5:1 D5:1 |' +
            'G5:.5 A5:.5 B5:.5 G5:.5 D6:1 B5:1 | C#6:.5 B5:.5 A5:.5 G5:.5 E5:1 C#5:1 | D5:.5 F#5:.5 A5:.5 D6:.5 F#6:1 E6:1 | D6:2 r:2',
      map: 'lead', twirl: 0.2,
    },
    C: {
      bars: 8, chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'], drums: 'four', fill: 'fillB', bass: 'octave', pad: true, crash: true,
      arp: { rate: 0.25, inst: 'pluck', vel: 0.3 },
      lead: 'A5:.75 F#5:.75 D5:.5 E5:.5 F#5:.5 A5:1 | E5:.75 C#5:.75 A4:.5 B4:.5 C#5:.5 E5:1 |' +
            'F#5:.75 D5:.75 B4:.5 C#5:.5 D5:.5 F#5:1 | G5:.5 F#5:.5 E5:.5 D5:.5 B4:1 D5:1 |' +
            'A5:.75 F#5:.75 D5:.5 E5:.5 F#5:.5 A5:1 | E5:.75 C#5:.75 A4:.5 B4:.5 C#5:.5 E5:1 |' +
            'B5:.75 A5:.75 G5:.5 A5:.5 B5:.5 D6:1 | C#6:1 A5:1 E5:.5 F#5:.5 G5:.5 A5:.5',
      map: 'lead', twirl: 0.35,
    },
    outro: {
      bars: 4, chords: ['D', 'G', 'A', 'D'], drums: 'funk', bass: 'bounce', pad: true,
      arp: { rate: 0.5, inst: 'pluck', vel: 0.5 }, map: 'pat:1 .5 .5', twirl: 0.3,
    },
  },
  order: ['intro', 'A', 'B', 'C', 'A2', 'outro'],
  finalChord: 'D',
};
SONG_TAP.sections.A2 = { ...SONG_TAP.sections.A, pad: true, arp: { rate: 0.5, inst: 'pluck', vel: 0.35 }, twirl: 0.3 };

/* ---------------- 3. 어려움: 달빛 지붕 위 ---------------- */
const MOON_CHORUS =
  'E5:.5 A5:.5 C6:.75 B5:.25 A5:.5 G5:.5 E5:1 | F5:.5 A5:.5 C6:.75 D6:.25 C6:.5 A5:.5 F5:1 |' +
  'G5:.5 C6:.5 E6:.75 D6:.25 C6:.5 B5:.5 G5:1 | B5:.25 C6:.25 D6:.5 B5:.5 G5:.5 D5:1 r:1 |' +
  'E5:.5 A5:.5 C6:.75 B5:.25 A5:.5 G5:.5 E5:1 | F5:.5 A5:.5 C6:.75 D6:.25 C6:.5 A5:.5 F5:1 |' +
  'G5:.5 C6:.5 E6:.75 D6:.25 C6:.5 B5:.5 G5:1 | D6:.25 C6:.25 B5:.25 A5:.25 G5:.5 B5:.5 D6:1 B5:1';

const SONG_MOON = {
  title: '달빛 지붕 위', artist: '꾹꾹 밴드', bpm: 140,
  lead: 'square', leadVel: 1,
  sections: {
    intro: {
      bars: 4, chords: ['Am', 'F', 'C', 'G'], drums: 'half', bass: 'long', pad: true,
      arp: { rate: 0.25, inst: 'pluck', vel: 0.45 }, map: 'eighth', twirl: 0.4,
    },
    A: {
      bars: 8, chords: ['Am', 'F', 'C', 'G'], drums: 'pop', fill: 'fillA', bass: 'pulse8', pad: true, crash: true,
      lead: 'A4:.5 C5:.5 E5:.5 A5:.5 G5:.5 E5:.5 C5:.5 E5:.5 | F5:.5 A5:.5 C6:.5 A5:.5 F5:1 E5:1 |' +
            'E5:.5 G5:.5 C6:.5 G5:.5 E5:.75 D5:.75 C5:.5 | D5:1 B4:.5 D5:.5 G5:1.5 r:.5 |' +
            'A4:.5 C5:.5 E5:.5 A5:.5 G5:.5 E5:.5 C5:.5 E5:.5 | F5:.5 A5:.5 C6:.5 A5:.5 F5:1 E5:1 |' +
            'G5:.5 E5:.5 C5:.5 E5:.5 G5:.5 C6:.5 B5:.5 G5:.5 | B5:.75 A5:.75 G5:.5 D5:1 B4:1',
      map: 'lead', twirl: 0.3,
    },
    T: {
      bars: 8, chords: ['Dm', 'Am', 'F', 'E'], drums: 'shuffle', fill: 'fillT', bass: 'trip', pad: true,
      arp: { rate: 1 / 3, inst: 'bell', vel: 0.3 },
      lead: 'D5:1/3 F5:1/3 A5:1/3 D6:1/3 A5:1/3 F5:1/3 D5:1 F5:1 | C5:1/3 E5:1/3 A5:1/3 C6:1/3 A5:1/3 E5:1/3 A5:2 |' +
            'F5:1/3 A5:1/3 C6:1/3 F5:1/3 A5:1/3 C6:1/3 A5:2/3 G5:2/3 F5:2/3 | E5:2/3 G#5:2/3 B5:2/3 E6:1 r:1 |' +
            'D5:1/3 F5:1/3 A5:1/3 D6:1/3 A5:1/3 F5:1/3 D5:1 F5:1 | C5:1/3 E5:1/3 A5:1/3 C6:1/3 A5:1/3 E5:1/3 A5:2 |' +
            'F5:1/3 A5:1/3 C6:1/3 F5:1/3 A5:1/3 C6:1/3 A5:2/3 G5:2/3 F5:2/3 | B5:1/3 G#5:1/3 E5:1/3 B4:1/3 E5:1/3 G#5:1/3 B5:2',
      map: 'lead', twirl: 0.35,
    },
    C: {
      bars: 8, chords: ['Am', 'F', 'C', 'G'], drums: 'drive', fill: 'fillB', bass: 'octave', pad: true, crash: true,
      arp: { rate: 0.25, inst: 'pluck', vel: 0.3 }, lead: MOON_CHORUS, map: 'lead', twirl: 0.45,
    },
    R: {
      bars: 4, chords: ['Dm', 'Am', 'Dm', 'E'], bass: 'long', pad: true,
      arp: { rate: 0.5, inst: 'bell', vel: 0.5 }, map: 'every:3', fill: 'loop',
    },
    end: { bars: 2, chords: ['Am', 'Am'], drums: 'half', bass: 'long', pad: true, map: 'beat' },
  },
  order: ['intro', 'A', 'T', 'C', 'R', { s: 'C2', bpm: 152 }, 'end'],
  finalChord: 'Am',
};
SONG_MOON.sections.C2 = { ...SONG_MOON.sections.C, twirl: 0.55 };

/* ---------------- 4. 극악: 냥냥 대폭주 ---------------- */
const ZOOM_DROP =
  'E6:.5 E6:.25 E6:.25 D6:.5 B5:.5 G5:.5 B5:.25 D6:.25 E6:1 | G6:.5 E6:.5 C6:.5 E6:.25 G6:.25 E6:.5 C6:.5 G5:1 |' +
  'D6:.5 D6:.25 D6:.25 B5:.5 G5:.5 D5:.5 G5:.25 B5:.25 D6:1 | F#6:.75 E6:.75 D6:.5 A5:1/3 D6:1/3 F#6:1/3 A6:1 |' +
  'E6:.5 E6:.25 E6:.25 D6:.5 B5:.5 G5:.5 B5:.25 D6:.25 E6:1 | G6:.5 E6:.5 C6:.5 E6:.25 G6:.25 E6:.5 C6:.5 G5:1 |' +
  'D6:.5 D6:.25 D6:.25 B5:.5 G5:.5 D5:.5 G5:.25 B5:.25 D6:1 | A6:.25 F#6:.25 D6:.25 A5:.25 F#6:.25 D6:.25 A5:.25 F#5:.25 D6:2';

const SONG_ZOOM = {
  title: '냥냥 대폭주', artist: '꾹꾹 밴드', bpm: 172,
  lead: 'chip', leadVel: 1, leadOctave: -1, pump: true,
  sections: {
    intro: {
      bars: 4, chords: ['Em', 'C', 'G', 'D'], drums: 'four', bass: 'offbeat', pad: true,
      arp: { rate: 0.25, inst: 'chip', vel: 0.35 }, map: 'eighth', twirl: 0.6,
    },
    A: {
      bars: 8, chords: ['Em', 'C', 'G', 'D'], drums: 'drive', fill: 'fillB', bass: 'octave', crash: true,
      lead: 'E5:.5 G5:.5 B5:.5 E6:.5 D6:.25 E6:.25 D6:.5 B5:.5 G5:.5 | C6:.5 B5:.5 G5:.5 E5:.5 G5:.5 C6:.5 B5:1 |' +
            'B5:.5 D6:.5 G6:.5 D6:.5 B5:.25 A5:.25 G5:.5 D5:1 | F#5:.75 A5:.75 D6:.5 F#6:1 r:1 |' +
            'E5:.5 G5:.5 B5:.5 E6:.5 D6:.25 E6:.25 D6:.5 B5:.5 G5:.5 | C6:.5 B5:.5 G5:.5 E5:.5 G5:.5 C6:.5 B5:1 |' +
            'B5:.5 D6:.5 G6:.5 D6:.5 B5:.25 A5:.25 G5:.5 D5:1 | A5:.25 B5:.25 A5:.25 F#5:.25 D5:.5 F#5:.5 A5:.5 D6:.5 F#6:1',
      map: 'lead', twirl: 0.5,
    },
    B: {
      bars: 8, chords: ['Am', 'Em', 'C', 'B'], drums: 'four', fill: 'fillB', bass: 'pulse8', pad: true,
      lead: 'A5:1/3 C6:1/3 E6:1/3 A5:1/3 C6:1/3 E6:1/3 A6:1 E6:1 | G5:1/3 B5:1/3 E6:1/3 G5:1/3 B5:1/3 E6:1/3 G6:1 E6:1 |' +
            'E6:.25 D6:.25 C6:.25 B5:.25 C6:.5 E6:.5 G6:.5 E6:.5 C6:1 | D#6:.75 B5:.75 F#5:.5 B5:2/3 D#6:2/3 F#6:2/3 |' +
            'A5:1/3 C6:1/3 E6:1/3 A5:1/3 C6:1/3 E6:1/3 A6:1 E6:1 | G5:1/3 B5:1/3 E6:1/3 G5:1/3 B5:1/3 E6:1/3 G6:1 E6:1 |' +
            'E6:.25 D6:.25 C6:.25 B5:.25 C6:.5 E6:.5 G6:.5 E6:.5 C6:1 | B5:.25 C6:.25 B5:.25 A5:.25 F#5:.25 D#5:.25 B4:.5 r:2',
      map: 'lead', twirl: 0.55,
    },
    D: {
      bars: 8, chords: ['Em', 'C', 'G', 'D'], drums: 'drive', fill: 'fillB', bass: 'offbeat', pad: true, crash: true,
      arp: { rate: 0.25, inst: 'chip', vel: 0.25 }, lead: ZOOM_DROP, map: 'lead', twirl: 0.6,
    },
    K: {
      bars: 4, chords: ['Am', 'Em', 'C', 'D'], bass: 'long', pad: true,
      arp: { rate: 0.5, inst: 'bell', vel: 0.5 }, map: 'every:3', fill: 'loop',
    },
    end: { bars: 2, chords: ['Em', 'Em'], drums: 'four', bass: 'octave', pad: true, map: 'eighth', twirl: 0.7 },
  },
  order: ['intro', 'A', 'B', 'D', 'K', { s: 'D2', bpm: 186 }, 'end'],
  finalChord: 'Em',
};
SONG_ZOOM.sections.D2 = { ...SONG_ZOOM.sections.D, twirl: 0.75 };
