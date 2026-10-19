import React from 'react';
import type {Line} from '../lib/lyrics';
import {FONT_SERIF, INK, PAPER, type InkName} from '../lib/theme';
import {HEIGHT, WIDTH, clamp, smooth, spring} from '../lib/time';
import {charState, type Feel} from '../type/kinetic';
import {wrapLine, type Placed} from '../type/layout';

export type LyricLayout = 'stack' | 'staff';

type Props = {
  lines: Line[];
  t: number;
  /** Left edge / baseline of the newest line, in screen px. */
  x: number;
  y: number;
  size: number;
  ink: InkName;
  /** Second drum printed under the sung glyph, slightly off-register. */
  shadow: InkName;
  offsets: Record<InkName, [number, number]>;
  feel: Feel;
  layout: LyricLayout;
  /** Wrap width in em. */
  maxEm: number;
  /** Ink for the staff lines in 'staff' layout. */
  staffInk?: InkName;
  /** Lines are never shown before this time (shot cut), chars sung earlier land on the cut. */
  notBefore?: number;
  /** 'paper' prints the glyph in opaque paper colour (render in a normal-blend layer). */
  mode?: 'ink' | 'paper';
  /** Held notes: the newest line stretches horizontally while it is sung. */
  stretch?: boolean;
  /** Extra per-glyph scale (e.g. to enlarge one word). */
  charScale?: (glyph: string, line: Line) => number;
  /** 'center' centres each row on x instead of starting it there. */
  align?: 'left' | 'center';
  /** Show only the newest line (diegetic text on an object). */
  single?: boolean;
  /** Text glued to an object: never shifted by the safe-area clamp. */
  free?: boolean;
};

const ROW_GAP = {stack: 1.32, staff: 1.9} as const;

/**
 * Kinetic lyrics printed as riso ink. Every glyph stays whole and appears on the exact frame it is
 * sung; the newest line sits on the baseline and older lines are pushed up and faded.
 */
export const LyricInk: React.FC<Props> = (p) => {
  const {t, size} = p;
  // Newest first: [current, previous, the one before (only while it fades out)].
  const shown = p.lines.filter((l) => Math.max(firstStart(l), p.notBefore ?? -Infinity) <= t + 0.15).reverse().slice(0, p.single ? 1 : 3);
  if (!shown.length) return null;
  // Wrap so a whole line always fits on screen (stretched held notes included).
  const stretchMax = p.stretch ? 1.75 : 1;
  const staffPad = p.layout === 'staff' ? 0.5 : 0;
  const maxEm = Math.max(4, Math.min(p.maxEm, (WIDTH - 2 * SAFE_X) / (size * stretchMax) - staffPad));
  const rowsOf = shown.map((l) => wrapLine(l, maxEm));
  const H = rowsOf.map((rows) => rows.length * ROW_GAP[p.layout] * size + 0.2 * size);
  // Keep the newest line's FULL layout (incl. glyphs not sung yet) inside the safe area, however
  // the camera has moved the anchor.
  const {x, y} = keepInside(p, rowsOf[0], stretchMax);
  // Older lines are pushed up just before the new line's first glyph lands.
  const push = clamp(spring(t - Math.max(firstStart(shown[0]), p.notBefore ?? -Infinity) + 0.15, 170, 16), 0, 1.06);
  const slots = [
    {y, opacity: 1},
    {y: y - (H[0] ?? 0) * push, opacity: 1 - 0.62 * clamp(push)},
    {y: y - (H[1] ?? 0) - (H[0] ?? 0) * push, opacity: 0.38 * (1 - clamp(push))},
  ];
  // Also keep the previous line on screen when there is room below for the newest one.
  if (!p.free && rowsOf[1]) {
    const gap = ROW_GAP[p.layout] * size;
    const staffLift = p.layout === 'staff' ? 0.62 * size : 0;
    const prevTop = slots[1].y - (rowsOf[1].length - 1) * gap - staffLift - 0.95 * size;
    const room = HEIGHT - SAFE_Y - (y + (p.layout === 'staff' ? 0.15 : 0.28) * size);
    const down = Math.min(Math.max(0, SAFE_Y - prevTop), Math.max(0, room));
    for (const sl of slots) sl.y += down;
  }
  return (
    <>
      {shown.map((line, j) =>
        slots[j].opacity > 0.01 ? (
          <Block key={line.i} {...p} x={x} line={line} rows={rowsOf[j]} yBottom={slots[j].y} opacity={slots[j].opacity} current={j === 0} />
        ) : null,
      )}
    </>
  );
};

const SAFE_X = 56;
const SAFE_Y = 40;

/** Shift the anchor so the block (all rows, at full width) stays inside the frame margins. */
const keepInside = (p: Props, rows: {width: number}[], stretchMax: number) => {
  if (p.free) return {x: p.x, y: p.y};
  const {size} = p;
  const w = Math.max(...rows.map((r) => r.width)) * size * stretchMax;
  const n = rows.length;
  const staff = p.layout === 'staff';
  const left = p.x - (p.align === 'center' ? w / 2 : 0) - (staff ? 0.25 * size : 0);
  const right = left + w + (staff ? 0.5 * size : 0);
  let dx = 0;
  if (right - left > WIDTH - 2 * SAFE_X || left < SAFE_X) dx = SAFE_X - left;
  else if (right > WIDTH - SAFE_X) dx = WIDTH - SAFE_X - right;
  const gap = ROW_GAP[p.layout] * size;
  const top = p.y - (n - 1) * gap - (staff ? 0.62 * size : 0) - 0.95 * size;
  const bottom = p.y + (staff ? 0.15 : 0.28) * size;
  let dy = 0;
  if (top < SAFE_Y) dy = SAFE_Y - top;
  else if (bottom > HEIGHT - SAFE_Y) dy = HEIGHT - SAFE_Y - bottom;
  return {x: p.x + dx, y: p.y + dy};
};

const firstStart = (l: Line) => {
  for (const tok of l.tokens) if (tok.s !== undefined && tok.s > 0) return tok.s;
  return l.s;
};

const Block: React.FC<
  Props & {line: Line; rows: {items: Placed[]; width: number}[]; yBottom: number; opacity: number; current: boolean}
> = ({rows, yBottom, opacity, current, ...p}) => {
  const {t, size} = p;
  const pitches = p.line.tokens.map((tk) => tk.m).filter((m): m is number => typeof m === 'number');
  const mRef = pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 54;
  const n = rows.length;
  const mainOff = p.offsets[p.ink];
  const shOff = p.offsets[p.shadow];
  const mainColor = p.mode === 'paper' ? PAPER : INK[p.ink];
  const stretchX = p.stretch ? 1 + 0.75 * smooth((t - p.line.s) / Math.max(0.5, p.line.e - p.line.s)) : 1;
  return (
    <div style={{position: 'absolute', inset: 0, transform: `scaleX(${stretchX})`, transformOrigin: `${p.x}px 0px`}}>
      {rows.map((row, r) => {
        const baseY = yBottom - (n - 1 - r) * ROW_GAP[p.layout] * size - (p.layout === 'staff' ? 0.62 * size : 0);
        const rowStart = row.items.find((it) => it.tok.t.trim())?.s ?? p.line.s;
        return (
          <React.Fragment key={r}>
            {p.layout === 'staff' && (
              <Staff
                x={p.x - 0.25 * size - (p.align === 'center' ? (row.width * size) / 2 : 0)}
                y={baseY + 0.42 * size}
                width={(row.width + 0.5) * size}
                gap={0.115 * size}
                draw={clamp((t - rowStart + 0.12) / 0.45)}
                ink={p.staffInk ?? 'cornflower'}
                off={p.offsets[p.staffInk ?? 'cornflower']}
                opacity={opacity}
              />
            )}
            {row.items.map((it, i) => {
              if (!it.tok.t.trim()) return null;
              const s = Math.max(it.s, p.notBefore ?? -Infinity);
              const st = charState({...it.tok, s, e: Math.max(it.e, s)}, t, p.feel);
              if (st.opacity <= 0) return null;
              // On the staff the glyph only leans toward its pitch; the note head below carries it.
              const rel = typeof it.tok.m === 'number' ? it.tok.m - mRef : null;
              const pitchDy = p.layout === 'staff' && rel !== null ? clamp(rel * 0.02, -0.1, 0.1) * size : 0;
              const x = p.x + it.x * size - (p.align === 'center' ? (row.width * size) / 2 : 0);
              const y = baseY - st.dy - pitchDy;
              const common: React.CSSProperties = {
                position: 'absolute',
                left: x,
                top: y - size * 0.88,
                fontFamily: FONT_SERIF,
                fontSize: size,
                lineHeight: 1,
                fontVariationSettings: `'wght' ${Math.round(760 + 140 * st.singing)}`,
                whiteSpace: 'pre',
                transform: `scale(${st.scale * (p.charScale?.(it.tok.t, p.line) ?? 1)})`,
                transformOrigin: '50% 70%',
              };
              // Paper glyphs always carry a full ink shadow + outline so they read on blank paper too.
              const shadowA = p.mode === 'paper' ? (current ? 1 : 0.8) : current ? 0.45 + 0.55 * st.singing : 0;
              return (
                <React.Fragment key={i}>
                  {shadowA > 0.01 && (
                    <span
                      style={{
                        ...common,
                        left: x + shOff[0] + 0.045 * size,
                        top: (common.top as number) + shOff[1] + 0.045 * size,
                        color: INK[p.shadow],
                        opacity: st.opacity * opacity * shadowA,
                      }}
                    >
                      {it.tok.t}
                    </span>
                  )}
                  <span
                    style={{
                      ...common,
                      left: x + mainOff[0],
                      top: (common.top as number) + mainOff[1],
                      color: mainColor,
                      opacity: st.opacity * opacity,
                      WebkitTextStroke: p.mode === 'paper' ? `${Math.max(1.2, size * 0.028)}px ${INK[p.shadow]}` : undefined,
                    }}
                  >
                    {it.tok.t}
                  </span>
                  {p.layout === 'staff' && rel !== null && (
                    <NoteHead
                      x={x + 0.5 * size + mainOff[0]}
                      y={baseY + 0.42 * size - clamp(rel * 0.055, -0.36, 0.36) * size + mainOff[1]}
                      size={size}
                      pop={st.scale}
                      color={mainColor}
                      opacity={st.opacity * opacity}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** A filled note head sitting on the staff at the pitch the syllable is sung on. */
const NoteHead: React.FC<{x: number; y: number; size: number; pop: number; color: string; opacity: number}> = ({x, y, size, pop, color, opacity}) => (
  <svg style={{position: 'absolute', left: x - size * 0.2, top: y - size * 0.2, width: size * 0.4, height: size * 0.4, overflow: 'visible', opacity}}>
    <ellipse
      cx={size * 0.2}
      cy={size * 0.2}
      rx={size * 0.105 * pop}
      ry={size * 0.075 * pop}
      transform={`rotate(-20 ${size * 0.2} ${size * 0.2})`}
      fill={color}
    />
  </svg>
);

/** Five printed staff lines that roll on from the left when their row starts. */
const Staff: React.FC<{x: number; y: number; width: number; gap: number; draw: number; ink: InkName; off: [number, number]; opacity: number}> = ({
  x,
  y,
  width,
  gap,
  draw,
  ink,
  off,
  opacity,
}) => (
  <svg style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', opacity}}>
    {[-2, -1, 0, 1, 2].map((k) => (
      <line
        key={k}
        x1={x + off[0]}
        x2={x + off[0] + width * draw}
        y1={y + k * gap + off[1]}
        y2={y + k * gap + off[1]}
        stroke={INK[ink]}
        strokeWidth={Math.max(1.6, gap * 0.28)}
        strokeLinecap="round"
      />
    ))}
  </svg>
);
