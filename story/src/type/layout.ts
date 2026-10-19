import type {Line, Token} from '../lib/lyrics';

const isCJK = (s: string) => /[㐀-鿿　-〿＀-￯“”‘’—…]/.test(s);

/** Approximate advance width (in em) of a display token for Noto Sans SC / Latin fallback. */
export const advance = (tok: Token) => {
  const s = tok.t;
  if (s === ' ') return 0.42;
  if (isCJK(s)) return s.length * 1.0;
  if (/^[A-Za-z']+$/.test(s)) return s.length * 0.6 + 0.08;
  return s.length * 0.5;
};

export type Placed = {tok: Token; x: number; w: number; /** time the token becomes visible */ s: number; e: number};

/**
 * Lay out a line left-to-right (x in em, starting at 0). Unsung tokens (punctuation, spaces)
 * inherit timing from the previous sung token so they appear together with it.
 */
export const placeLine = (line: Line): {items: Placed[]; width: number} => {
  let x = 0;
  let lastS = line.s;
  let lastE = line.s;
  const items: Placed[] = [];
  for (const tok of line.tokens) {
    const w = advance(tok);
    if (tok.s !== undefined) {
      lastS = tok.s;
      lastE = tok.e ?? tok.s;
    }
    items.push({tok, x, w, s: tok.s ?? lastS, e: tok.e ?? lastE});
    x += w;
  }
  return {items, width: x};
};

/** Greedy wrap at a given width, breaking only at token boundaries. */
const greedy = (items: Placed[], limit: number) => {
  const rows: Placed[][] = [[]];
  let rowX = 0;
  for (const it of items) {
    if (rowX + it.w > limit && rows[rows.length - 1].length && it.tok.t !== ' ') {
      rows.push([]);
      rowX = 0;
    }
    if (it.tok.t === ' ' && rows[rows.length - 1].length === 0) continue;
    rows[rows.length - 1].push({...it, x: rowX});
    rowX += it.w;
  }
  // Drop trailing spaces so a row's width is its visible width.
  for (const r of rows) while (r.length && r[r.length - 1].tok.t === ' ') r.pop();
  return rows.filter((r) => r.length);
};

/**
 * Wrap a placed line into rows no wider than maxEm. A line that fits stays on one row; a line
 * that must wrap is balanced (rows of similar length) so no single glyph is left hanging.
 */
export const wrapLine = (line: Line, maxEm: number) => {
  const {items} = placeLine(line);
  let rows = greedy(items, maxEm);
  if (rows.length > 1) {
    const total = items.reduce((a, b) => a + b.w, 0);
    for (let limit = total / rows.length; limit <= maxEm; limit += 0.25) {
      const r = greedy(items, limit);
      if (r.length <= rows.length) {
        rows = r;
        break;
      }
    }
  }
  return rows.map((r) => ({items: r, width: r.reduce((a, b) => Math.max(a, b.x + b.w), 0)}));
};
