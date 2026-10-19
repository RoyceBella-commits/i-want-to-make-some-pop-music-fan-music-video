import timeline from '../../public/data/timeline.json';

export type Token = {t: string; s?: number; e?: number; m?: number; mel?: number};
export type Line = {i: number; text: string; lrc: number; s: number; e: number; sec: string; tokens: Token[]};
export type Section = {id: string; name: string; accent: string; feel: string; start: number; end: number};

/**
 * Hand corrections on top of the aligned timeline, confirmed by ear.
 * key: line index -> token index -> patched times (seconds).
 */
const FIXES: Record<number, Record<number, Partial<Token>>> = {
  // 内嵌歌词写作 "freaking"，实际唱的是 "f**king"（按用户听感，保留星号遮挡）。
  60: {2: {t: 'f**king'}},
  // "我无法…"：对齐把"我"放在 87.04，比"无"早 1.6 秒；按用户听感挪到"无法"前。
  29: {0: {s: 88.42, e: 88.64}},
  // 最后一个"乐"：自动对齐落在 5:03.94，用户听确认应在 5:00 整出现。
  103: {7: {s: 300.0, e: 303.5}},
};

export const LINES = (timeline.lines as unknown as Line[]).map((l) => {
  const fix = FIXES[l.i];
  if (!fix) return l;
  const tokens = l.tokens.map((tk, k) => (fix[k] ? {...tk, ...fix[k]} : tk));
  return {...l, tokens, text: tokens.map((tk) => tk.t).join(''), e: Math.max(...tokens.map((tk) => tk.e ?? 0))};
});
export const SECTIONS = timeline.sections as Section[];
export const META = timeline.meta;
export const DRUMS = timeline.drums;
export const GROOVE = timeline.groove;

export const sectionAt = (t: number) =>
  SECTIONS.find((s) => t >= s.start && t < s.end) ?? SECTIONS[SECTIONS.length - 1];

export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id)!;

/** Lines whose sung span (padded) touches time t. */
export const linesAt = (t: number, pre = 0.4, post = 0.6) =>
  LINES.filter((l) => t >= l.s - pre && t <= l.e + post);

export const linesIn = (secId: string) => LINES.filter((l) => l.sec === secId);

/** Index of the line most recently started at time t (-1 before the first). */
export const lastLineIndex = (t: number) => {
  let k = -1;
  for (let i = 0; i < LINES.length; i++) if (LINES[i].s <= t) k = i;
  return k;
};

/** Drum hits of a kind ('k' kick, 's' snare, 'h' hat) in [t0, t1]. */
export const hitsIn = (kind: 'k' | 's' | 'h', t0: number, t1: number, ghosts = false) =>
  DRUMS.filter((d) => d.k === kind && d.t >= t0 && d.t <= t1 && (ghosts ? d.g === 1 : d.g === 0));

/** Seconds since the latest drum hit of a kind (Infinity if none). */
export const sinceHit = (kind: 'k' | 's' | 'h', t: number, ghosts = false) => {
  let best = Infinity;
  for (let i = DRUMS.length - 1; i >= 0; i--) {
    const d = DRUMS[i];
    if (d.t > t) continue;
    if (t - d.t > 4) break;
    if (d.k === kind && (ghosts ? d.g === 1 : d.g === 0)) {
      best = t - d.t;
      break;
    }
  }
  return best;
};

export const isLatin = (s: string) => /^[A-Za-z']+$/.test(s);
