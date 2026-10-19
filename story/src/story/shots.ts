import {LINES, type Line} from '../lib/lyrics';
import type {InkName} from '../lib/theme';
import {BEAT, barStart, beatTime, lerp, smooth} from '../lib/time';
import type {Cam} from '../riso/camera';
import type {LyricLayout} from '../lyric/LyricInk';

/** How a new sheet is printed in: one drum per beat, per eighth, or already there. */
export type Reveal = 'beats' | 'eighths' | 'sixteenths' | 'none';

export type LyricSpec = {
  layout: LyricLayout;
  /** Left edge / baseline of the newest line, in plate uv (0..1 from the top-left). */
  u: number;
  v: number;
  size: number;
  maxEm: number;
  ink: InkName;
  shadow: InkName;
  staffInk?: InkName;
  /** 'paper': glyphs are opaque paper colour (for dark plates); 'ink': multiplied ink. */
  mode?: 'ink' | 'paper';
  /** Horizontal stretch for held notes (现在——在——). */
  stretch?: boolean;
  /** u/v are screen fractions (lyric stays put while the camera travels). */
  screen?: boolean;
  /** Words left out of the lyric layer because the scene prints them elsewhere (stamps). */
  drop?: string[];
};

export type CamKey = Partial<Cam>;

export type Shot = {
  n: string;
  plate: string | null;
  start: number;
  end: number;
  reveal: Reveal;
  /** Drum order for the print-in. */
  inks: InkName[];
  cam: {from: CamKey; to: CamKey; ease?: 'smooth' | 'linear' | 'out'; nod?: number};
  lyric: LyricSpec | null;
  /** Overlay / effect key in fx.tsx. */
  fx?: string;
  /** Freeze the print boil + misregistration (time stands still). */
  freeze?: boolean;
  misreg?: number;
  mono?: number;
  /** Hard cut: the sheet arrives already printed, with an ink jolt instead of a print-in. */
  hard?: boolean;
};

const BASE: Cam = {x: 0, y: 0, zoom: 1.04, roll: 0, depth: 0.4};
const ALL: InkName[] = ['yellow', 'cornflower', 'teal', 'pink', 'brown'];

const L = (layout: LyricLayout, u: number, v: number, o: Partial<LyricSpec> = {}): LyricSpec => ({
  layout,
  u,
  v,
  size: layout === 'staff' ? 52 : 64,
  maxEm: layout === 'staff' ? 10 : 13,
  ink: 'teal',
  shadow: 'yellow',
  staffInk: 'cornflower',
  ...o,
});

const push = (z0 = 1.04, z1 = 1.1, x0 = 0, x1 = 0, y0 = 0, y1 = 0) => ({from: {zoom: z0, x: x0, y: y0}, to: {zoom: z1, x: x1, y: y1}});

/** Shots in time order; each runs until the next one starts. */
const RAW: Omit<Shot, 'end'>[] = [
  // ---------------- 第一幕：长大 ----------------
  {n: '01', plate: 's01_summer', start: 0, reveal: 'beats', inks: ['yellow', 'cornflower', 'teal', 'brown', 'pink'],
   cam: {from: {x: -0.25, y: 0.06, zoom: 1.06, depth: 0.45}, to: {x: 0.05, y: -0.06, zoom: 1.13, depth: 0.45}, nod: 0.035}, lyric: L('stack', 0.1, 0.27, {size: 66}), fx: 'summer'},
  {n: '02', plate: 's02_teen', start: 9.25, reveal: 'eighths', inks: ['yellow', 'cornflower', 'teal', 'pink', 'brown'],
   cam: {from: {x: -0.12, y: 0.02, zoom: 1.03}, to: {x: 0.18, y: -0.04, zoom: 1.08}, nod: 0.03}, lyric: L('staff', 0.685, 0.41), fx: 'teen'},
  {n: '03', plate: 's03_chords', start: 21.72, reveal: 'eighths', inks: ['cornflower', 'teal', 'brown', 'yellow'], cam: push(1.05, 1.08), lyric: L('stack', 0.06, 0.34, {maxEm: 9}), fx: 'chords'},
  {n: '04', plate: 's04_form', start: 25.55, reveal: 'eighths', inks: ALL, cam: push(1.02, 1.12), lyric: null, fx: 'form'},
  {n: '05', plate: 's05_gate', start: 27.98, reveal: 'eighths', inks: ALL, cam: push(1.02, 1.16, 0, 0, -0.1, 0.1), lyric: L('stack', 0.31, 0.2, {maxEm: 9, size: 60})},
  {n: '06', plate: 's06_scale', start: barStart(11), reveal: 'sixteenths', inks: ALL, cam: push(1.06, 1.1, -0.2, 0.25, -0.2, 0.25), lyric: L('staff', 0.12, 0.3, {maxEm: 8}), fx: 'scale'},
  {n: '07', plate: 's07_blocks', start: 34.08, reveal: 'none', hard: true, inks: ALL, cam: push(1.08, 1.08, 0, 0, -0.35, 0.3), lyric: L('stack', 0.06, 0.34, {maxEm: 8}), fx: 'blocks'},
  {n: '08', plate: 's08_sounds', start: 36.5, reveal: 'sixteenths', inks: ALL, cam: push(1.06, 1.06, -0.25, 0.25), lyric: L('stack', 0.52, 0.24, {mode: 'paper', maxEm: 9, shadow: 'pink'}), fx: 'sounds'},
  {n: '09', plate: 's09_install', start: 39.98, reveal: 'none', hard: true, inks: ALL, cam: {from: {x: -0.3, zoom: 1.08, roll: -0.6}, to: {x: 0.3, zoom: 1.1, roll: 0.6}}, lyric: L('stack', 0.62, 0.4)},
  {n: '10', plate: 's10_stage', start: 43.14, reveal: 'sixteenths', inks: ALL, cam: push(1.03, 1.12, -0.2, -0.3), lyric: L('stack', 0.42, 0.16, {mode: 'paper', shadow: 'pink', maxEm: 10}), fx: 'spotlight'},
  {n: '11', plate: 's11_band', start: 46.1, reveal: 'none', hard: true, inks: ALL, cam: push(1.06, 1.1), lyric: L('stack', 0.06, 0.2, {ink: 'teal', shadow: 'pink'}), fx: 'noise', misreg: 2.6},
  {n: '12', plate: 's12_pieces', start: 49.19, reveal: 'eighths', inks: ALL, cam: {from: {zoom: 1.08, roll: -2}, to: {zoom: 1.12, roll: 2}}, lyric: L('stack', 0.04, 0.2, {mode: 'paper', maxEm: 8, shadow: 'yellow'}), fx: 'pieces'},
  {n: '13', plate: 's13_room', start: 55.24, reveal: 'eighths', inks: ALL, cam: push(1.16, 1.16, -1.0, 1.0), lyric: L('stack', 0.62, 0.92, {size: 54, maxEm: 7, mode: 'paper'}), fx: 'labels1'},
  {n: '14', plate: 's14_hands', start: 64.4, reveal: 'eighths', inks: ALL, cam: {from: {zoom: 2.3, y: 1.53}, to: {zoom: 1.02, y: 0}}, lyric: L('stack', 0.05, 0.24, {screen: true, mode: 'paper', maxEm: 8})},
  {n: '15', plate: 's15_cover', start: 67.51, reveal: 'eighths', inks: ALL, cam: push(1.05, 1.1), lyric: L('stack', 0.05, 0.2, {mode: 'paper', maxEm: 12}), fx: 'bookNote'},
  {n: '16', plate: 's15_cover', start: 71.08, reveal: 'none', inks: ALL, cam: push(1.1, 0.98), lyric: L('stack', 0.05, 0.2, {stretch: true, size: 80, mode: 'paper'}), freeze: true},

  // ---------------- 第二幕：被看着 ----------------
  {n: '17', plate: 's17_popstage', start: barStart(25), reveal: 'eighths', inks: ['pink', 'yellow', 'cornflower', 'teal', 'brown'], cam: push(1.03, 1.1), lyric: null, fx: 'marquee'},
  {n: '18', plate: 's18_shelf', start: barStart(27), reveal: 'sixteenths', inks: ['pink', 'yellow', 'cornflower', 'teal', 'brown'], cam: {from: {zoom: 2.2, y: -0.4}, to: {zoom: 1.02, y: 0}}, lyric: L('stack', 0.05, 0.2, {screen: true, mode: 'paper', shadow: 'pink', maxEm: 12})},
  {n: '19', plate: 's17_popstage', start: 86.92, reveal: 'none', inks: ALL, cam: push(1.1, 1.14), lyric: null, fx: 'bubble'},
  {n: '20', plate: 's20_windows', start: 92.54, reveal: 'eighths', inks: ['teal', 'brown', 'cornflower', 'yellow', 'pink'], cam: push(1.02, 1.14, 0, 0, -0.1, 0.35), lyric: L('stack', 0.24, 0.07, {mode: 'paper', size: 50, shadow: 'yellow'}), fx: 'windows'},
  {n: '21', plate: 's21_magnifier', start: 102.48, reveal: 'eighths', inks: ALL, cam: push(1.04, 1.1), lyric: L('stack', 0.03, 0.13, {mode: 'paper', size: 50, maxEm: 7, shadow: 'yellow'}), fx: 'lens'},
  {n: '22', plate: 's22_mirror', start: 105.86, reveal: 'sixteenths', inks: ALL, cam: push(1.03, 1.15, 0, 0, 0, 0.2), lyric: L('stack', 0.44, 0.17, {size: 50, maxEm: 11}), fx: 'mirror'},
  {n: '23', plate: 's23_poster', start: 112.13, reveal: 'eighths', inks: ALL, cam: push(1.05, 1.05, -0.3, 0.3), lyric: L('stack', 0.06, 0.24, {mode: 'paper', shadow: 'yellow'}), fx: 'notAnymore'},
  {n: '24', plate: 's24_dinner', start: 116.92, reveal: 'none', hard: true, inks: ['yellow', 'brown', 'teal', 'cornflower', 'pink'], cam: {from: {zoom: 1.05, roll: -1}, to: {zoom: 1.08, roll: 1}}, lyric: L('stack', 0.04, 0.2, {maxEm: 8, size: 58})},
  // nobody cares ×6 — one table, the camera jumps between the six things; teal only.
  {n: '25', plate: 's25_objects', start: 119.52, reveal: 'sixteenths', inks: ['teal'], cam: {from: {zoom: 2.4, x: -4.37, y: 2.2}, to: {zoom: 2.5, x: -4.37, y: 2.2}}, lyric: L('stack', 0.06, 0.92, {size: 54, mode: 'paper', shadow: 'pink', drop: ['nobody', 'cares']}), fx: 'nobody', mono: 1},
  {n: '26', plate: 's25_objects', start: 121.4, reveal: 'none', inks: ['teal'], cam: {from: {zoom: 2.4, x: 0.37, y: 2.1}, to: {zoom: 2.5, x: 0.37, y: 2.1}}, lyric: L('stack', 0.06, 0.92, {size: 54, mode: 'paper', shadow: 'pink', drop: ['nobody', 'cares']}), fx: 'nobody', mono: 1},
  {n: '27', plate: 's25_objects', start: 122.99, reveal: 'none', inks: ['teal'], cam: {from: {zoom: 2.4, x: 4.6, y: 2.0}, to: {zoom: 2.5, x: 4.6, y: 2.0}}, lyric: L('stack', 0.06, 0.92, {size: 54, mode: 'paper', shadow: 'pink', drop: ['nobody', 'cares']}), fx: 'nobody', mono: 1},
  {n: '28', plate: 's25_objects', start: 124.62, reveal: 'none', inks: ['teal'], cam: {from: {zoom: 2.4, x: -4.56, y: -1.44}, to: {zoom: 2.5, x: -4.56, y: -1.44}}, lyric: L('stack', 0.06, 0.92, {size: 54, mode: 'paper', shadow: 'pink', drop: ['nobody', 'cares']}), fx: 'nobody', mono: 1},
  {n: '29', plate: 's25_objects', start: 126.06, reveal: 'none', inks: ['teal'], cam: {from: {zoom: 2.4, x: 0.32, y: -1.62}, to: {zoom: 2.5, x: 0.32, y: -1.62}}, lyric: L('stack', 0.06, 0.92, {size: 54, mode: 'paper', shadow: 'pink', drop: ['nobody', 'cares']}), fx: 'nobody', mono: 1},
  {n: '30', plate: 's25_objects', start: 127.73, reveal: 'none', inks: ['teal'], cam: {from: {zoom: 2.4, x: 4.6, y: -1.53}, to: {zoom: 1.0, x: 0, y: 0}, ease: 'out'}, lyric: L('stack', 0.06, 0.92, {size: 54, mode: 'paper', shadow: 'pink', drop: ['nobody', 'cares']}), fx: 'nobody', mono: 1},
  {n: '31', plate: 's31_books', start: 129.12, reveal: 'none', hard: true, inks: ['teal', 'brown', 'cornflower', 'yellow', 'pink'], cam: push(1.03, 1.1), lyric: L('stack', 0.58, 0.16, {mode: 'paper', maxEm: 9}), fx: 'tally'},
  {n: '32', plate: 's32_door', start: 133.62, reveal: 'beats', inks: ['brown', 'teal', 'yellow', 'cornflower', 'pink'], cam: push(1.03, 1.05), lyric: L('stack', 0.06, 0.18, {mode: 'paper', size: 56, shadow: 'yellow'})},
  {n: '33', plate: 's33_work', start: 138.4, reveal: 'eighths', inks: ALL, cam: push(1.04, 1.08), lyric: L('staff', 0.64, 0.3, {maxEm: 11}), fx: 'dayNight'},
  {n: '34', plate: 's34_mic', start: 144.67, reveal: 'eighths', inks: ALL, cam: {from: {zoom: 1.04}, to: {zoom: 1.12}, ease: 'linear'}, lyric: L('stack', 0.05, 0.4, {size: 70}), fx: 'freaking'},

  // ---------------- 第三幕：连在一起 ----------------
  {n: '35', plate: 's35_rehearsal', start: 148.96, reveal: 'eighths', inks: ['yellow', 'teal', 'brown', 'cornflower', 'pink'], cam: push(1.18, 1.18, 1.2, -1.2), lyric: L('stack', 0.55, 0.13, {size: 54, screen: true, maxEm: 9}), fx: 'labels2'},
  {n: '36', plate: 's35_rehearsal', start: 164.11, reveal: 'none', inks: ALL, cam: {from: {zoom: 1.18, x: -1.2}, to: {zoom: 0.99, x: 0}, ease: 'out'}, lyric: L('stack', 0.55, 0.13, {size: 54, screen: true, maxEm: 9}), fx: 'cables'},
  {n: '37', plate: 's37_cover2', start: 167.3, reveal: 'eighths', inks: ALL, cam: push(1.05, 1.1), lyric: L('stack', 0.55, 0.16, {mode: 'paper', maxEm: 9})},
  {n: '38', plate: 's37_cover2', start: 170.88, reveal: 'none', inks: ALL, cam: push(1.1, 0.98), lyric: L('stack', 0.5, 0.16, {stretch: true, size: 80, mode: 'paper'}), freeze: true},
  {n: '39', plate: 's39_city', start: barStart(57), reveal: 'eighths', inks: ['teal'], cam: push(1.04, 1.12, 0, 0, 0, -0.2), lyric: L('stack', 0.06, 0.9, {mode: 'paper', shadow: 'teal'}), fx: 'billboards', mono: 1},
  {n: '40', plate: 's39_city', start: 188.48, reveal: 'none', inks: ALL, cam: push(1.12, 1.16, 0, 0, -0.2, -0.25), lyric: L('stack', 0.06, 0.9, {mode: 'paper', shadow: 'pink'}), fx: 'colorWipe'},
  {n: '41', plate: 's41_book', start: 192.16, reveal: 'eighths', inks: ALL, cam: push(1.3, 1.3, -2.2, 2.2), lyric: L('staff', 0.3, 0.22, {screen: true}), fx: 'scroll'},
  {n: '42', plate: 's42_night', start: barStart(65), reveal: 'beats', inks: ['teal', 'cornflower', 'brown', 'yellow', 'pink'], cam: push(1.03, 1.1), lyric: L('staff', 0.66, 0.22, {mode: 'paper', staffInk: 'yellow', maxEm: 8}), fx: 'notesFlow'},
  {n: '43', plate: 's43_roof', start: 206.3, reveal: 'sixteenths', inks: ALL, cam: push(1.03, 1.12, 0, 0, 0, 0.3), lyric: L('stack', 0.06, 0.92, {mode: 'paper', shadow: 'pink'}), fx: 'snow'},
  {n: '44', plate: 's44_run', start: 211.8, reveal: 'none', hard: true, inks: ['pink', 'yellow', 'cornflower', 'teal', 'brown'], cam: {from: {x: -0.6, zoom: 1.1}, to: {x: 0.6, zoom: 1.12}, ease: 'linear'}, lyric: L('stack', 0.4, 0.16, {screen: true, maxEm: 11})},
  {n: '45', plate: 's45_walls', start: 218.02, reveal: 'sixteenths', inks: ALL, cam: push(1.04, 1.12), lyric: L('stack', 0.27, 0.13, {screen: true, maxEm: 12, shadow: 'pink'}), fx: 'shake'},

  // ---------------- 第四幕：回环 ----------------
  {n: '46', plate: 's46_live', start: barStart(73), reveal: 'none', hard: true, inks: ['pink', 'yellow', 'cornflower', 'teal', 'brown'], cam: push(1.03, 1.1), lyric: L('stack', 0.06, 0.18, {mode: 'paper', shadow: 'pink', size: 72}), fx: 'live'},
  {n: '47', plate: 's47_crowd', start: 238.13, reveal: 'none', hard: true, inks: ALL, cam: push(1.04, 1.08), lyric: L('stack', 0.27, 0.2, {screen: true, mode: 'paper', shadow: 'pink', maxEm: 13})},
  {n: '48', plate: 's46_live', start: 242.22, reveal: 'none', inks: ALL, cam: push(1.15, 1.25, 0, 0, -0.5, -0.6), lyric: L('stack', 0.06, 0.18, {mode: 'paper', shadow: 'pink', size: 72}), fx: 'live'},
  {n: '49', plate: 's49_split', start: barStart(81), reveal: 'none', hard: true, inks: ALL, cam: push(1.03, 1.08), lyric: L('stack', 0.05, 0.16, {mode: 'paper', shadow: 'teal', maxEm: 8}), fx: 'split'},
  {n: '50', plate: 's50_kid', start: 263.02, reveal: 'eighths', inks: ALL, cam: push(1.03, 1.12, -0.2, 0, 0, 0.1), lyric: L('stack', 0.04, 0.16, {shadow: 'yellow', maxEm: 9}), fx: 'you'},
  {n: '51', plate: 's01_summer', start: 272.9, reveal: 'none', inks: ALL, cam: push(1.06, 1.06), lyric: null, fx: 'flashback'},
  {n: '52', plate: 's01_summer', start: 295.9, reveal: 'none', inks: ALL, cam: {from: {x: -0.25, y: 0.06, zoom: 1.06, depth: 0.45}, to: {x: -0.2, y: 0.04, zoom: 1.08, depth: 0.45}}, lyric: L('stack', 0.1, 0.27, {size: 66}), fx: 'ending'},
  {n: '53', plate: 's01_summer', start: 301.0, reveal: 'none', inks: ALL, cam: {from: {x: -0.2, y: 0.04, zoom: 1.08, depth: 0.45}, to: {x: -0.2, y: 0.04, zoom: 1.08, depth: 0.45}}, lyric: null, fx: 'credits'},
];

export const END = 305.5;

export const SHOTS: Shot[] = RAW.map((s, i) => ({...s, end: RAW[i + 1]?.start ?? END}));

export const shotAt = (t: number) => SHOTS.find((s) => t >= s.start && t < s.end) ?? SHOTS[SHOTS.length - 1];

/** Lyric lines whose first sung token falls inside the shot. */
export const linesOf = (s: Shot): Line[] =>
  LINES.filter((l) => {
    const first = l.tokens.find((t) => t.s !== undefined && t.s > 0)?.s ?? l.s;
    return first >= s.start - 0.02 && first < s.end - 0.02;
  });

export const camAt = (s: Shot, t: number): Cam => {
  const k = Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start)));
  const e = s.cam.ease === 'linear' ? k : s.cam.ease === 'out' ? 1 - (1 - k) ** 3 : smooth(k);
  const from = {...BASE, ...s.cam.from};
  const to = {...BASE, ...s.cam.from, ...s.cam.to};
  return {
    x: lerp(from.x, to.x, e),
    y: lerp(from.y, to.y, e),
    zoom: lerp(from.zoom, to.zoom, e),
    roll: lerp(from.roll, to.roll, e),
    depth: lerp(from.depth, to.depth, e),
  };
};

/** When each drum lands for a shot's print-in (seconds). */
export const revealTimes = (s: Shot): number[] => {
  if (s.reveal === 'none') return s.inks.map(() => -Infinity);
  const step = s.reveal === 'beats' ? BEAT : s.reveal === 'sixteenths' ? BEAT / 4 : BEAT / 2;
  // First grid slot at or after the cut.
  const first = Math.ceil((s.start - beatTime(0)) / step - 1e-6) * step + beatTime(0);
  return s.inks.map((_, i) => first + i * step);
};
