import React from 'react';
import {random} from 'remotion';
import type {Features} from '../lib/features';
import {LINES, hitsIn, sinceHit} from '../lib/lyrics';
import {FONT_SANS, FONT_SERIF, INK, INK_ORDER, PAPER, type InkName} from '../lib/theme';
import {BAR, BEAT, HEIGHT, WIDTH, beatTime, clamp, decay, lerp, smooth, spring} from '../lib/time';
import {Arcs, CHORDS, ChordBubble, EighthNote, MusicSymbol, SYMBOL_KINDS, Tag, Thought, Ticks, Timeline, type ChordName} from '../music/Glyphs';
import {LyricInk} from '../lyric/LyricInk';
import {sectionAt} from '../lib/lyrics';
import type {Cam} from '../riso/camera';
import {misreg} from '../riso/misreg';
import type {RisoState} from '../riso/RisoCanvas';
import timeline from '../../public/data/timeline.json';
import {SHOTS, type LyricSpec, type Shot} from './shots';

type At = (u: number, v: number) => {x: number; y: number; scale: number};
type Offsets = Record<InkName, [number, number]>;

export type Ctx = {
  t: number;
  local: number;
  shot: Shot;
  cam: Cam;
  offsets: Offsets;
  at: At;
  features: Features;
  plateId: string | null;
};

export type FxOut = {
  /** Multiplied ink overlays (printed on top of the plate). */
  ink?: React.ReactNode;
  /** Opaque paper props, normal blend. */
  paper?: React.ReactNode;
  /** Above everything (title cards). */
  top?: React.ReactNode;
  riso?: Partial<RisoState>;
  cam?: Cam;
  reveal?: Record<InkName, number>;
  offsets?: Offsets;
  lyric?: Partial<LyricSpec>;
  hideLyrics?: boolean;
  /** Lines this shot prints somewhere else (on an object), kept out of the lyric layer. */
  skipLines?: number[];
  charScale?: (glyph: string) => number;
};

export type Fx = ((c: Ctx) => FxOut) & {plateFor?: (t: number, s: Shot) => string | null};

const tokenTime = (line: number, glyph: string, nth = 0) => LINES[line].tokens.filter((t) => t.t === glyph)[nth]?.s ?? LINES[line].s;
const lineStart = (line: number) => LINES[line].tokens.find((t) => t.s !== undefined && t.s > 0)?.s ?? LINES[line].s;
const beatsIn = (t0: number, t1: number, step = BEAT) => {
  const out: number[] = [];
  for (let b = Math.ceil((t0 - beatTime(0)) / step - 1e-6); beatTime(0) + b * step < t1; b++) out.push(beatTime(0) + b * step);
  return out;
};
/** A soft "nod" on snare hits — reused for lights and props. */
const snareEnv = (t: number, tau = 0.12) => decay(sinceHit('s', t), tau);
const kickEnv = (t: number, tau = 0.12) => decay(sinceHit('k', t), tau);

// ---------------------------------------------------------------------------------------------
// 01 夏天 — radio notes in bar 1, chord bubbles in bars 2-3 (density trimmed ~20% from the demo).

const CHORD_CYCLE: ChordName[] = ['C', 'G', 'Am', 'F'];

const summer: Fx = ({t, at, offsets}) => {
  const radio = at(0.16, 0.37);
  const hole = at(0.757, 0.66);
  return {
    ink: (
      <>
        {[0, 1, 2, 4, 5, 6].map((n) => {
          const t0 = beatTime(n / 2) + 0.03;
          const age = t - t0;
          if (age < 0 || age > 1.9) return null;
          return (
            <EighthNote
              key={n}
              x={radio.x + (30 + 46 * age + Math.sin(age * 5 + n) * 14) * radio.scale}
              y={radio.y - (20 + 120 * age) * radio.scale}
              scale={0.95 * radio.scale * (0.6 + 0.4 * spring(age, 240, 14))}
              rot={Math.sin(age * 4 + n) * 12}
              opacity={clamp(age / 0.08) * (1 - clamp((age - 1.4) / 0.5))}
              ink={n % 2 ? 'teal' : 'cornflower'}
            />
          );
        })}
        {[0, 1, 2, 4, 5, 6].map((k, i) => {
          const t0 = beatTime(4 + k) + 0.035;
          const age = t - t0;
          if (age < 0 || age > 2.5) return null;
          const go = 1 - Math.exp(-age * 2.4);
          const side = i % 2 === 0 ? -1 : 1;
          const dx = side < 0 ? -250 - 40 * (i % 3) : 40 + 30 * (i % 3);
          const dy = side < 0 ? -320 + 26 * (i % 2) : -420;
          const bx = hole.x + dx * go * hole.scale + offsets.cornflower[0];
          const by = hole.y + dy * go * hole.scale + offsets.cornflower[1];
          return (
            <ChordBubble
              key={k}
              chord={CHORD_CYCLE[k % 4]}
              x={bx}
              y={by}
              scale={1.05 * hole.scale * spring(age, 260, 13)}
              rot={Math.sin(age * 3 + k) * 6 + side * 4}
              opacity={1 - clamp((age - 2.0) / 0.5)}
              ink="cornflower"
              dot="teal"
              fill="yellow"
              tail={clamp((hole.x - bx) / (140 * hole.scale), -1, 1)}
            />
          );
        })}
      </>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 02 少年练琴 — weather by the bar, metronome ticks, headphone arcs, thought, record tags.

type Weather = 'sun' | 'cloud' | 'rain' | 'night';
const W_VEC: Record<Weather, [number, number, number, number]> = {sun: [1, 0, 0, 0], cloud: [0, 1, 0, 0], rain: [0, 0, 1, 0], night: [0, 0, 0, 1]};
const weatherAt = (keys: [number, Weather][], t: number): [number, number, number, number] => {
  let cur = W_VEC[keys[0][1]];
  for (let i = 1; i < keys.length; i++) {
    const k = clamp((t - keys[i][0]) / 0.12);
    if (k <= 0) break;
    cur = cur.map((v, j) => lerp(v, W_VEC[keys[i][1]][j], k)) as typeof cur;
  }
  return cur;
};

const SHELF_TAGS: [number, number, number][] = [
  [0.43, 0.2, -14],
  [0.61, 0.17, -6],
  [0.47, 0.35, 12],
  [0.57, 0.38, -10],
  [0.45, 0.51, -8],
];

const teen: Fx = ({t, at, offsets, shot}) => {
  const metro = at(0.935, 0.355);
  const phones = at(0.815, 0.49);
  const head = at(0.33, 0.16);
  return {
    riso: {
      weather: weatherAt(
        [
          [shot.start, 'sun'],
          [beatTime(16), 'night'],
          [beatTime(20), 'sun'],
          [tokenTime(5, '阴'), 'cloud'],
          [tokenTime(5, '练'), 'rain'],
        ],
        t,
      ),
      sun: [0.2 * (16 / 9), 0.85],
    },
    ink: (
      <>
        {beatsIn(shot.start + 0.1, shot.end).map((bt) => {
          const b = Math.round((bt - beatTime(0)) / BEAT);
          const age = t - bt;
          if (age < 0 || age > 0.4) return null;
          return (
            <Ticks
              key={b}
              x={metro.x + (b % 2 ? -1 : 1) * 34 * metro.scale + offsets.pink[0]}
              y={metro.y - 10 * metro.scale + offsets.pink[1]}
              side={b % 2 ? -1 : 1}
              scale={(b % 4 === 0 ? 1.25 : 0.95) * metro.scale * (0.7 + 0.3 * spring(age, 300, 14))}
              opacity={decay(age, 0.16)}
              ink="pink"
            />
          );
        })}
        {[0, 1, 2, 4, 5, 6].map((i) => {
          const age = t - (lineStart(4) - 0.05 + (i * BEAT) / 2);
          if (age < 0 || age > 0.7) return null;
          return <Arcs key={i} x={phones.x} y={phones.y - 30 * phones.scale} radius={30 + 90 * (1 - Math.exp(-age * 4))} rot={90} scale={phones.scale} opacity={1 - clamp(age / 0.7)} ink="teal" />;
        })}
        {t > tokenTime(4, '思') - 0.07 && t < tokenTime(4, '点', 1) + 0.9 && (
          <Thought
            x={head.x + offsets.teal[0]}
            y={head.y + offsets.teal[1]}
            scale={1.5 * head.scale}
            opacity={1 - clamp((t - tokenTime(4, '点', 1) - 0.6) / 0.3)}
            ink="teal"
            dots={[tokenTime(4, '思'), tokenTime(4, '考'), tokenTime(4, '一', 1)].filter((s) => t >= s).length}
            cloud={spring(t - tokenTime(4, '点', 1), 220, 13)}
          />
        )}
        {t > tokenTime(6, '历') - 0.02 && (
          <Timeline x0={at(0.385, 0.11).x} x1={at(0.66, 0.11).x} y={at(0.5, 0.11).y + offsets.brown[1]} draw={smooth((t - tokenTime(6, '历')) / 0.55)} ink="brown" ticks={6} />
        )}
      </>
    ),
    paper: (
      <>
        {SHELF_TAGS.map(([u, v, rot], i) => {
          const tIn = lineStart(6) + (i * BEAT) / 4;
          if (t < tIn) return null;
          const p = at(u, v);
          const fall = Math.max(0, t - (tokenTime(6, '不') + i * 0.075));
          return (
            <Tag
              key={i}
              x={p.x + fall * 60 * (i % 2 ? 1 : -1) * p.scale}
              y={p.y + 0.5 * 2600 * fall * fall * p.scale}
              rot={rot + fall * 220 * (i % 2 ? 1 : -1)}
              scale={0.95 * p.scale * spring(t - tIn, 320, 14)}
              ink="pink"
              string="brown"
            />
          );
        })}
      </>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 20 被注视 — the windows across the street light up one by one as each watcher is named.

/** Window rects in plate uv [u0, v0, u1, v1] (s20_windows, 4 × 3 grid). */
const WIN = (() => {
  const cols = [
    [375, 570],
    [615, 810],
    [860, 1055],
    [1100, 1300],
  ];
  const rows = [
    [85, 262],
    [300, 467],
    [508, 656],
  ];
  return rows.map((r) => cols.map((c) => [c[0] / 1672, r[0] / 941, c[1] / 1672, r[1] / 941] as const));
})();

const windows: Fx = ({t, at}) => {
  // When each window comes on: parents, grandparents (two windows), classmates, rivals; the
  // empty rooms flick on during "还有".
  const on: [number, number, number][] = [
    [0, 0, tokenTime(31, '爸')],
    [0, 2, tokenTime(32, '外')],
    [0, 3, tokenTime(32, '外', 1)],
    [1, 0, tokenTime(35, '同')],
    [1, 2, tokenTime(36, '同')],
    [0, 1, lineStart(34)],
    [2, 3, lineStart(34) + BEAT / 2],
    [1, 1, lineStart(37)],
    [2, 0, lineStart(37) + BEAT / 2],
  ];
  return {
    paper: (
      <>
        {WIN.flatMap((row, r) =>
          row.map((w, c) => {
            const when = on.find(([rr, cc]) => rr === r && cc === c)?.[2] ?? Infinity;
            const lit = t >= when ? 1 : 0;
            // a quick flicker as the light comes on
            const flick = t >= when && t < when + 0.12 ? (Math.floor((t - when) * 40) % 2) * 0.6 : 0;
            const dark = lit ? flick : 1;
            if (dark <= 0.01) return null;
            const a = at(w[0], w[1]);
            const b = at(w[2], w[3]);
            return <div key={`${r}${c}`} style={{position: 'absolute', left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y, background: '#123c45', opacity: dark * 0.94}} />;
          }),
        )}
      </>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// Generic effects that need no plate coordinates.

/** 11 噪音: the lyric shakes with the hats, the drums already knock harder via shot.misreg. */
const noise: Fx = ({t}) => ({
  lyric: {},
  charScale: () => 1 + 0.08 * decay(sinceHit('h', t), 0.05),
});

/** 45 墙倒下: the frame jolts on every snare. */
const shake: Fx = ({t, cam}) => {
  const e = snareEnv(t, 0.09);
  return {cam: {...cam, y: cam.y + 0.05 * e, roll: cam.roll + 0.5 * e * (Math.floor(t / BEAT) % 2 ? 1 : -1)}};
};

/** 40 撕掉灰纸: mono peels away left to right, landing on "世界". */
const colorWipe: Fx = ({t, shot}) => {
  const tEnd = tokenTime(73, '界');
  const k = smooth((t - (shot.start + 0.3)) / (tEnd - shot.start - 0.3));
  return {riso: {mono: 1, monoEdge: lerp(-0.05, 1.08, k)}};
};

/** 49 半边噪音: the right half of the stage keeps knocking out of register. */
const split: Fx = ({t}) => {
  const rough = misreg(t, 2.8);
  const jitter = (k: number) => (random(`sp${Math.floor(t * 24)}${k}`) - 0.5) * 7 * (0.4 + kickEnv(t, 0.2));
  const right = Object.fromEntries(INK_ORDER.map((k, i) => [k, [rough[k][0] + jitter(i), rough[k][1] + jitter(i + 9)]])) as Offsets;
  return {riso: {splitX: WIDTH / 2, offsetsRight: right}};
};

/** 50 你: the word 你 is printed big. */
const you: Fx = () => ({charScale: (g) => (g === '你' ? 1.45 : 1)});

/** 34 I f**king care: fluorescent pink floods the sheet, the line knocks out to paper. */
const freaking: Fx = ({t, offsets}) => {
  const t0 = lineStart(60);
  const k = clamp((t - t0 + 0.03) / 0.08);
  if (k <= 0) return {};
  const words = LINES[60].tokens.filter((tk) => tk.t.trim());
  // Fixed two-row layout; each word only appears when it is sung, so nothing shifts.
  const rows = [words.slice(0, 2), words.slice(2)];
  return {
    hideLyrics: true,
    ink: <div style={{position: 'absolute', inset: 0, background: INK.pink, opacity: 0.92 * k}} />,
    top: (
      <div style={{position: 'absolute', left: 0, right: 0, top: HEIGHT * 0.24, textAlign: 'center'}}>
        {rows.map((row, r) => (
          <div key={r} style={{whiteSpace: 'nowrap', lineHeight: 1.08}}>
            {row.map((tk, i) => {
              const age = t - (tk.s ?? t0);
              const s = age >= 0 ? 1 + 0.25 * decay(age, 0.08) : 1;
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    margin: '0 16px',
                    fontFamily: FONT_SANS,
                    fontWeight: 900,
                    fontSize: 136,
                    color: PAPER,
                    opacity: age >= 0 ? 1 : 0,
                    transform: `translate(${offsets.pink[0] * 2}px, ${offsets.pink[1] * 2}px) scale(${s})`,
                    textShadow: `6px 6px 0 ${INK.teal}`,
                  }}
                >
                  {tk.t}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    ),
  };
};

/** Stamped word(s), slammed on a hit and left on the sheet. */
const Stamp: React.FC<{x: number; y: number; text: string; age: number; rot: number; ink: InkName; size: number; font?: string; paper?: boolean}> = ({
  x,
  y,
  text,
  age,
  rot,
  ink,
  size,
  font = FONT_SANS,
  paper,
}) => {
  if (age < 0) return null;
  const slam = 1 + 0.5 * decay(age, 0.05);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${slam})`,
        border: `${size * 0.09}px solid ${INK[ink]}`,
        borderRadius: size * 0.16,
        padding: `${size * 0.08}px ${size * 0.28}px`,
        fontFamily: font,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.05,
        color: INK[ink],
        background: paper ? PAPER : undefined,
        whiteSpace: 'nowrap',
        opacity: clamp(age / 0.03),
      }}
    >
      {text}
    </div>
  );
};

/** 23 not anymore — a sans stamp on the downbeat. */
const notAnymore: Fx = ({t}) => ({
  paper: <Stamp x={WIDTH * 0.3} y={HEIGHT * 0.62} text="not anymore" age={t - lineStart(45)} rot={-8} ink="pink" size={110} paper />,
});

/** 25-30 nobody cares — six stamps, one per line, each on the snare after "nobody". */
const NOBODY_LINES = [47, 48, 49, 50, 51, 52];
/** Plate uv of the six objects on the table (3 × 2 grid). */
const OBJ: [number, number][] = [
  [0.227, 0.255],
  [0.523, 0.266],
  [0.825, 0.277],
  [0.215, 0.66],
  [0.52, 0.68],
  [0.807, 0.67],
];
const nobody: Fx = ({t, at}) => ({
  ink: (
    <>
      {NOBODY_LINES.map((li, i) => {
        const when = tokenTime(li, 'cares') ?? lineStart(li);
        const p = at(OBJ[i][0], OBJ[i][1]);
        return <Stamp key={li} x={p.x} y={p.y} text="nobody cares" age={t - when} rot={-10 + 7 * i} ink="pink" size={44 * p.scale} />;
      })}
    </>
  ),
});

/** 19 任性世界 — the line lights up on the marquee inside a soap bubble that pops on "世界". */
const bubble: Fx = (c) => {
  const {t, shot, offsets} = c;
  const tPop = tokenTime(29, '界');
  const r = 470 + 12 * Math.sin(t * 2.2);
  const signFade = 1 - clamp((t - tPop) / 0.18);
  const sign =
    signFade > 0 ? (
      <>
        <MarqueeBulbs c={c} opacity={signFade} />
        <OnObject c={c} line={29} u={0.5} v={0.18} rot={0} size={64} ink="pink" shadow="yellow" opacity={signFade} />
      </>
    ) : null;
  if (t < tPop) {
    return {
      ink: (
        <>
        {sign}
        <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
          <circle cx={WIDTH / 2 + offsets.cornflower[0]} cy={HEIGHT * 0.46 + offsets.cornflower[1]} r={r} fill="none" stroke={INK.cornflower} strokeWidth={10} opacity={clamp((t - shot.start) / 0.5)} />
          {/* Highlight on the lower-left of the bubble, clear of the marquee text. */}
          <path d={`M ${WIDTH / 2 - r * 0.83} ${HEIGHT * 0.46 + r * 0.22} A ${r * 0.86} ${r * 0.86} 0 0 0 ${WIDTH / 2 - r * 0.43} ${HEIGHT * 0.46 + r * 0.745}`} fill="none" stroke={INK.pink} strokeWidth={14} strokeLinecap="round" />
        </svg>
        </>
      ),
    };
  }
  // Pop: the drums fly apart and the sheet is lifted to blank paper.
  const age = t - tPop;
  const blast = misreg(t, 1 + 30 * decay(age, 0.12));
  const lift = 1 - clamp(age / 0.18);
  return {
    offsets: blast,
    reveal: Object.fromEntries(INK_ORDER.map((k) => [k, lift])) as Record<InkName, number>,
    ink: (
      <>
      {sign}
      <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        {Array.from({length: 14}, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const d = r * (1 + age * 2.2);
          return <circle key={i} cx={WIDTH / 2 + Math.cos(a) * d} cy={HEIGHT * 0.46 + Math.sin(a) * d} r={9 * (1 - clamp(age / 0.5))} fill={INK.cornflower} />;
        })}
      </svg>
      </>
    ),
  };
};

/** 43 零星下落 — music symbols (notes, sharps, flats, rests) drift down like snow. */
const snow: Fx = ({t, shot}) => {
  const t0 = lineStart(82);
  const crack = tokenTime(81, '冲');
  const jolted = decay(t - crack, 0.15) * (t >= crack ? 1 : 0);
  const out: FxOut = {offsets: misreg(t, 1 + 9 * jolted)};
  if (t < t0 - 0.2) return out;
  const n = 105;
  out.ink = (
    <>
      {Array.from({length: n}, (_, i) => {
        const start = t0 - 0.2 + (i / n) * (shot.end - t0 + 0.2) * 0.85;
        const age = t - start;
        if (age < 0) return null;
        return (
          <MusicSymbol
            key={i}
            kind={SYMBOL_KINDS[Math.floor(random(`sk${i}`) * SYMBOL_KINDS.length)]}
            x={random(`sx${i}`) * WIDTH + Math.sin(age * 1.6 + i) * 30}
            y={-60 + age * (160 + 120 * random(`sv${i}`))}
            size={60 + 60 * random(`ss${i}`)}
            scale={1}
            rot={(random(`sr${i}`) - 0.5) * 50 + age * 18}
            ink={(['yellow', 'pink', 'cornflower', 'teal'] as InkName[])[i % 4]}
          />
        );
      })}
    </>
  );
  return out;
};

/** 46 / 48 Livehouse — confetti on each downbeat, kick-driven light wash. */
const live: Fx = ({t, shot}) => {
  const bars = beatsIn(shot.start, t + 0.01, BAR).slice(-2);
  return {
    ink: (
      <>
        <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 50% 40% at 50% 18%, ${INK.yellow}, transparent 70%)`, opacity: 0.45 * kickEnv(t, 0.15)}} />
        {bars.flatMap((b0, j) =>
          Array.from({length: 26}, (_, i) => {
            const age = t - b0;
            if (age < 0 || age > 2.6) return null;
            const seed = `${Math.round(b0 * 100)}c${i}`;
            const x = random(seed + 'x') * WIDTH;
            const y = -30 + age * age * 160 + age * 120 * random(seed + 'v');
            const ink = (['pink', 'yellow', 'cornflower', 'teal'] as InkName[])[(i + j) % 4];
            return (
              <div
                key={seed}
                style={{
                  position: 'absolute',
                  left: x + Math.sin(age * 4 + i) * 24,
                  top: y,
                  width: 16,
                  height: 9,
                  background: INK[ink],
                  transform: `rotate(${age * 300 * (random(seed + 'r') - 0.5)}deg)`,
                  opacity: 1 - clamp((age - 2.1) / 0.5),
                }}
              />
            );
          }),
        )}
      </>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 51 还有 — reverse flashback through every plate, one "还有" stamp per sung onset.

const ONSETS = (timeline as {outro_onsets: number[]}).outro_onsets;
const HAI = ONSETS.filter((_, i) => i % 2 === 0); // the "还" of each "还有"
const FLASH_PLATES = (() => {
  const ids: string[] = [];
  for (const s of SHOTS) if (s.plate && !ids.includes(s.plate) && s.n < '51') ids.push(s.plate);
  return ids.reverse(); // newest first, ending on the summer
})();
const flashIndex = (t: number) => {
  let k = -1;
  for (let i = 0; i < HAI.length; i++) if (HAI[i] <= t) k = i;
  return k;
};
const plateAtFlash = (k: number) => (k < 0 ? FLASH_PLATES[0] : FLASH_PLATES[Math.round((k / (HAI.length - 1)) * (FLASH_PLATES.length - 1))]);

const flashback: Fx = Object.assign(
  ({t}: Ctx): FxOut => {
    const k = flashIndex(t);
    const recent = HAI.map((h, i) => ({h, i})).filter(({h}) => h <= t && t - h < 1.6);
    return {
      // Every cut lands already printed, with a little ink jolt.
      offsets: misreg(t, 1 + 3 * decay(t - (HAI[k] ?? -9), 0.1)),
      ink: (
        <>
          {recent.map(({h, i}) => (
            <Stamp
              key={i}
              x={WIDTH * (0.18 + 0.64 * random(`hx${i}`))}
              y={HEIGHT * (0.2 + 0.6 * random(`hy${i}`))}
              text="还有"
              age={t - h}
              rot={(random(`hr${i}`) - 0.5) * 30}
              ink={(['pink', 'teal', 'yellow', 'cornflower'] as InkName[])[i % 4]}
              size={70 + 40 * random(`hs${i}`)}
              font={FONT_SERIF}
            />
          ))}
        </>
      ),
    };
  },
  {plateFor: (t: number) => plateAtFlash(flashIndex(t))},
);

// ---------------------------------------------------------------------------------------------
// 52 / 53 结尾 — back in the summer; then the colophon, and the inks lift back to blank paper.

const ending: Fx = ({t, at, offsets}) => {
  // The child strums the first chord again as the last line starts.
  const hole = at(0.757, 0.66);
  const age = t - (lineStart(103) + 0.03);
  if (age < 0 || age > 3.2) return {};
  const go = 1 - Math.exp(-age * 1.6);
  const bx = hole.x - 260 * go * hole.scale + offsets.cornflower[0];
  const by = hole.y - 330 * go * hole.scale + offsets.cornflower[1];
  return {
    ink: (
      <ChordBubble
        chord="C"
        x={bx}
        y={by}
        scale={1.1 * hole.scale * spring(age, 200, 12)}
        rot={Math.sin(age * 2) * 5 - 4}
        opacity={1 - clamp((age - 2.7) / 0.5)}
        ink="cornflower"
        dot="teal"
        fill="yellow"
        tail={clamp((hole.x - bx) / (140 * hole.scale), -1, 1)}
      />
    ),
  };
};

const CREDIT_LINES: {text: string; size: number; font: string; ink: InkName; gap: number}[] = [
  {text: '我想要做点流行音乐', size: 92, font: FONT_SERIF, ink: 'teal', gap: 26},
  {text: '回环 RingAgain', size: 48, font: FONT_SERIF, ink: 'pink', gap: 46},
  {text: '作词 / 作曲 / 演唱　马路', size: 32, font: FONT_SANS, ink: 'brown', gap: 14},
  {text: '制作人 / 编曲 / 混音 / 母带　天秤Dav', size: 32, font: FONT_SANS, ink: 'brown', gap: 14},
  {text: '专辑《松一口气！》 2025', size: 32, font: FONT_SANS, ink: 'cornflower', gap: 0},
];

const credits: Fx = ({t, shot, offsets}) => {
  const local = t - shot.start;
  // The summer lifts off drum by drum, the colophon prints in, holds, then lifts too.
  const plateLift = Object.fromEntries(INK_ORDER.map((k, i) => [k, 1 - clamp((local - i * 0.12) / 0.25)])) as Record<InkName, number>;
  const liftAt = shot.end - shot.start - 0.75;
  const lift = clamp((local - liftAt) / 0.55);
  return {
    hideLyrics: true,
    reveal: plateLift,
    riso: lift >= 1 ? {seed: 0} : {},
    ink: (
      <div style={{position: 'absolute', left: 0, right: 0, top: HEIGHT * 0.3, textAlign: 'center'}}>
        {CREDIT_LINES.map((c, i) => {
          const k = clamp((local - 0.55 - i * 0.22) / 0.2) * (1 - clamp((lift - i * 0.12) / 0.4));
          const o = offsets[c.ink];
          return (
            <div
              key={i}
              style={{
                fontFamily: c.font,
                fontWeight: c.font === FONT_SERIF ? 900 : 700,
                fontSize: c.size,
                color: INK[c.ink],
                marginBottom: c.gap,
                opacity: k,
                transform: `translate(${o[0]}px, ${o[1]}px)`,
                letterSpacing: c.font === FONT_SANS ? 2 : 0,
              }}
            >
              {c.text}
            </div>
          );
        })}
      </div>
    ),
  };
};

const none: Fx = () => ({});

/** A sung line printed onto an object in the scene: centred on (u, v), rotated with the object. */
const OnObject: React.FC<{c: Ctx; line: number; u: number; v: number; rot: number; size: number; ink: InkName; shadow?: InkName; maxEm?: number; mode?: 'ink' | 'paper'; opacity?: number}> = ({
  c,
  line,
  u,
  v,
  rot,
  size,
  ink,
  shadow,
  maxEm = 20,
  mode,
  opacity = 1,
}) => {
  const p = c.at(u, v);
  return (
    <div style={{position: 'absolute', inset: 0, opacity, transform: `rotate(${rot}deg)`, transformOrigin: `${p.x}px ${p.y}px`}}>
      <LyricInk
        lines={[LINES[line]]}
        t={c.t}
        x={p.x}
        y={p.y + size * p.scale * 0.35}
        size={size * p.scale}
        ink={ink}
        shadow={shadow ?? ink}
        offsets={c.offsets}
        feel={sectionAt(c.t).feel === 'pop' ? 'pop' : 'soul'}
        layout="stack"
        maxEm={maxEm}
        align="center"
        single
        free
        mode={mode}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// 03 四个和弦 — the four cards light one per beat (I–V–vi–IV), all four on "四个和弦", then torn down.

const CARDS: [number, number][] = [
  [0.4725, 0.188],
  [0.569, 0.188],
  [0.671, 0.188],
  [0.77, 0.188],
];
const CARD_W = 0.084;
const CARD_H = 0.198;

const chords: Fx = (c) => {
  const {t, at, offsets, shot} = c;
  const tAll = tokenTime(7, '四');
  const tTear = tokenTime(7, '弦');
  const beats = beatsIn(shot.start, t + 0.001);
  const cur = beats.length ? Math.round((beats[beats.length - 1] - beatTime(0)) / BEAT) % 4 : -1;
  return {
    ink: (
      <>
        {CARDS.map(([u, v], i) => {
          const a = at(u - CARD_W / 2, v - CARD_H / 2);
          const b = at(u + CARD_W / 2, v + CARD_H / 2);
          const lit = t >= tAll ? 1 : i === cur ? decay(t - beats[beats.length - 1], 0.6) : 0;
          if (t >= tTear) return null;
          const frets = CHORDS[CHORD_CYCLE[i]];
          const gx = (s: number) => a.x + (b.x - a.x) * (0.17 + s * 0.132);
          const gy = (f: number) => a.y + (b.y - a.y) * (0.36 + f * 0.13);
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y, background: INK.yellow, opacity: 0.75 * lit}} />
              <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
                {frets.map((f, s) => (f > 0 ? <circle key={s} cx={gx(s) + offsets.teal[0]} cy={gy(f - 0.5) + offsets.teal[1]} r={(b.x - a.x) * 0.055} fill={INK.teal} /> : null))}
              </svg>
            </React.Fragment>
          );
        })}
      </>
    ),
    paper: (
      <>
        {t >= tTear &&
          CARDS.map(([u, v], i) => {
            // Each card is ripped in two; the halves fall off the wall.
            const a = at(u - CARD_W / 2 - 0.004, v - CARD_H / 2 - 0.012);
            const b = at(u + CARD_W / 2 + 0.004, v + CARD_H / 2 + 0.006);
            const age = t - tTear - i * 0.05;
            const w = b.x - a.x;
            const h = b.y - a.y;
            return (
              <React.Fragment key={i}>
                <div style={{position: 'absolute', left: a.x, top: a.y, width: w, height: h, background: '#F1EADB'}} />
                {[0, 1].map((half) => {
                  const fall = Math.max(0, age);
                  return (
                    <div
                      key={half}
                      style={{
                        position: 'absolute',
                        left: a.x + half * w * 0.5 + (half ? 1 : -1) * fall * 90,
                        top: a.y + 0.5 * 2400 * fall * fall,
                        width: w * 0.5,
                        height: h,
                        background: PAPER,
                        border: `2px solid ${INK.cornflower}`,
                        transform: `rotate(${(half ? 1 : -1) * fall * 160}deg)`,
                        clipPath: half ? 'polygon(8% 0, 100% 0, 100% 100%, 0 100%, 14% 60%, 4% 30%)' : 'polygon(0 0, 92% 0, 86% 30%, 96% 60%, 88% 100%, 0 100%)',
                      }}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
      </>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 04 转专业 — the decision is printed into the form's box, then a pink seal lands on the snare.

const form: Fx = (c) => {
  const t险 = tokenTime(8, '险');
  const tSeal = hitsIn('s', t险, t险 + 1.6)[0]?.t ?? t险 + 0.2;
  const seal = c.at(0.6, 0.34);
  const age = c.t - tSeal;
  return {
    ink: (
      <>
        <OnObject c={c} line={8} u={0.486} v={0.255} rot={-8.6} size={58} ink="teal" />
        {age >= 0 && (
          <svg
            width={240}
            height={240}
            viewBox="-120 -120 240 240"
            style={{position: 'absolute', left: seal.x - 120, top: seal.y - 120, transform: `scale(${seal.scale * (1 + 0.45 * decay(age, 0.05))}) rotate(-14deg)`}}
          >
            <circle r={96} fill="none" stroke={INK.pink} strokeWidth={10} />
            <circle r={78} fill="none" stroke={INK.pink} strokeWidth={4} />
            <g transform="translate(-26 -52) scale(1.3)" fill={INK.pink}>
              <ellipse cx={20} cy={62} rx={13} ry={9.5} transform="rotate(-22 20 62)" />
              <rect x={30} y={10} width={5} height={52} />
              <path d="M35 10 C 44 20, 54 24, 50 44 C 48 32, 42 28, 35 26 Z" />
            </g>
          </svg>
        )}
      </>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 06 音阶 — each syllable puts a note on the next stair up: an ascending scale.

const STAIR_A: [number, number] = [0.25, 0.78];
const STAIR_B: [number, number] = [0.86, 0.1];
const scale: Fx = ({t, at, offsets}) => {
  const toks = LINES[10].tokens.filter((tk) => tk.s !== undefined && tk.t.trim());
  return {
    ink: (
      <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        {toks.map((tk, i) => {
          const age = t - (tk.s ?? 0);
          if (age < 0) return null;
          const k = i / Math.max(1, toks.length - 1);
          const p = at(lerp(STAIR_A[0], STAIR_B[0], k), lerp(STAIR_A[1], STAIR_B[1], k) - 0.07);
          const pop = spring(age, 300, 14);
          return (
            <g key={i} transform={`translate(${p.x + offsets.teal[0]} ${p.y + offsets.teal[1]}) scale(${p.scale * pop}) rotate(-20)`}>
              <ellipse rx={20} ry={14} fill={INK.teal} />
              <rect x={16} y={-74} width={6} height={74} fill={INK.teal} />
            </g>
          );
        })}
      </svg>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 07 和弦 — chord tones stack up the tower, root at the bottom block, then the whole chord rings.

const BLOCKS: [number, number][] = [
  [0.68, 0.84],
  [0.672, 0.638],
  [0.658, 0.455],
  [0.663, 0.27],
  [0.61, 0.1],
];
const blocks: Fx = ({t, at}) => {
  const toks = LINES[11].tokens.filter((tk) => tk.s !== undefined && tk.t.trim());
  const ring = tokenTime(11, '和');
  const pulse = t >= ring ? decay(t - ring, 0.35) : 0;
  return {
    paper: (
      <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        {BLOCKS.map(([u, v], i) => {
          const tk = toks[Math.min(i, toks.length - 1)];
          const age = t - (tk?.s ?? Infinity);
          if (age < 0) return null;
          const p = at(u, v);
          const s = p.scale * spring(age, 280, 13) * (1 + 0.25 * pulse);
          return (
            <g key={i} transform={`translate(${p.x} ${p.y}) scale(${s}) rotate(-20)`}>
              <ellipse rx={30} ry={21} fill={PAPER} stroke={INK.teal} strokeWidth={6} />
              <rect x={24} y={-92} width={8} height={92} fill={PAPER} stroke={INK.teal} strokeWidth={3} />
            </g>
          );
        })}
      </svg>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 08 不定义声音 — the microphone spits out a printed waveform of what it hears (the drum stem).

const sounds: Fx = ({t, at, features}) => {
  const mic = at(0.27, 0.26);
  const n = 90;
  const len = 1100 * mic.scale;
  const pts = Array.from({length: n}, (_, i) => {
    const k = i / (n - 1);
    // the newest sound sits at the mic; older sound has travelled right
    const a = features.get('drums_rms', t - k * 1.4) * 1.6 + features.get('other_rms', t - k * 1.4) * 0.8;
    const y = Math.sin(i * 1.7 + t * 30) * Math.min(1, a) * 70 * mic.scale;
    return `${mic.x + 40 * mic.scale + k * len},${mic.y + 30 * mic.scale + y}`;
  });
  return {
    paper: <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}><polyline points={pts.join(' ')} fill="none" stroke={INK.yellow} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" /></svg>,
  };
};

// ---------------------------------------------------------------------------------------------
// 31 衡量 — tally marks counted into the ledger, one per beat.

const tally: Fx = ({t, at, shot}) => {
  const t0 = lineStart(54) - 0.05;
  const beats = beatsIn(t0, Math.min(t + 0.001, shot.end));
  const origin = at(0.64, 0.84);
  const u = origin.scale;
  return {
    ink: (
      <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        <g transform={`translate(${origin.x} ${origin.y}) rotate(-7)`} stroke={INK.teal} strokeWidth={8 * u} strokeLinecap="round">
          {beats.map((b, i) => {
            const g = Math.floor(i / 5);
            const j = i % 5;
            const x0 = g * 90 * u;
            const draw = clamp((t - b) / 0.08);
            return j < 4 ? (
              <line key={i} x1={x0 + j * 16 * u} y1={0} x2={x0 + j * 16 * u} y2={-58 * u * draw} />
            ) : (
              <line key={i} x1={x0 - 8 * u} y1={-8 * u} x2={x0 - 8 * u + 72 * u * draw} y2={-8 * u - 42 * u * draw} />
            );
          })}
        </g>
      </svg>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 33 日夜 — working through the days: the window flips day / night on every beat.

const dayNight: Fx = ({t, shot}) => {
  const keys: [number, Weather][] = [[shot.start, 'night']];
  beatsIn(shot.start + 0.05, shot.end).forEach((b, i) => keys.push([b, i % 2 === 0 ? 'sun' : 'night']));
  return {riso: {weather: weatherAt(keys, t), sun: [0.24 * (16 / 9), 0.8]}};
};

// ---------------------------------------------------------------------------------------------
// 10 剧场 — the spotlight flares on every kick.

const spotlight: Fx = ({t, at}) => {
  const lamp = at(1450 / 1672, 75 / 941);
  const l = at((1125 - 360) / 1672, 625 / 941);
  const r = at((1125 + 360) / 1672, 625 / 941);
  const c = at(1125 / 1672, 625 / 941);
  const k = 0.35 * kickEnv(t, 0.14) + 0.1 * snareEnv(t, 0.1);
  if (k < 0.01) return {};
  return {
    paper: (
      <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        <polygon points={`${lamp.x},${lamp.y} ${l.x},${l.y} ${r.x},${r.y}`} fill={PAPER} opacity={k * 0.6} />
        <ellipse cx={c.x} cy={c.y} rx={(r.x - l.x) / 2} ry={48 * c.scale} fill={PAPER} opacity={k} />
      </svg>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 12 拼凑 — a dotted line joins the scattered pieces one beat at a time, like a puzzle that never closes.

const PIECES: [number, number][] = [
  [0.167, 0.64],
  [0.395, 0.3],
  [0.45, 0.1],
  [0.65, 0.085],
  [0.676, 0.32],
  [0.78, 0.36],
  [0.72, 0.52],
  [0.56, 0.52],
  [0.514, 0.34],
];
const pieces: Fx = ({t, at, shot, offsets}) => {
  const beats = beatsIn(shot.start + 0.1, Math.min(t, shot.end));
  const pts = PIECES.map(([u, v]) => at(u, v));
  const n = Math.min(beats.length, pts.length - 1);
  const segs: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const k = clamp((t - beats[i]) / 0.25);
    const a = pts[i];
    const b = pts[i + 1];
    segs.push(
      <line key={i} x1={a.x + offsets.pink[0]} y1={a.y + offsets.pink[1]} x2={lerp(a.x, b.x, k) + offsets.pink[0]} y2={lerp(a.y, b.y, k) + offsets.pink[1]} stroke={INK.pink} strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />,
    );
  }
  return {
    ink: (
      <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        {segs}
        {pts.slice(0, n + 1).map((p, i) => (
          <circle key={i} cx={p.x + offsets.pink[0]} cy={p.y + offsets.pink[1]} r={9} fill={INK.pink} />
        ))}
      </svg>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 13 / 35 标签 — a paper label with the sung word is hung on an object (or a person) as it is sung.

const WordLabel: React.FC<{x: number; y: number; scale: number; word: string; age: number; rot: number; pulse: number; ink?: InkName}> = ({
  x,
  y,
  scale,
  word,
  age,
  rot,
  pulse,
  ink = 'teal',
}) => {
  if (age < 0) return null;
  const s = scale * spring(age, 260, 12) * (1 + 0.18 * pulse);
  const swing = Math.sin(age * 5) * 6 * Math.exp(-age * 1.5);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -12%) rotate(${rot + swing}deg) scale(${s})`, transformOrigin: '50% 0%'}}>
      <svg width={20} height={46} style={{position: 'absolute', left: '50%', top: -46, marginLeft: -10, overflow: 'visible'}}>
        <path d="M10 0 C 4 16, 16 26, 10 46" fill="none" stroke={INK.brown} strokeWidth={3} />
      </svg>
      <div
        style={{
          background: PAPER,
          border: `4px solid ${INK[ink]}`,
          borderRadius: 10,
          padding: '8px 18px 10px',
          fontFamily: FONT_SERIF,
          fontWeight: 900,
          fontSize: 50,
          lineHeight: 1,
          color: INK[ink],
          whiteSpace: 'nowrap',
          boxShadow: `6px 6px 0 ${INK.yellow}`,
        }}
      >
        {word}
      </div>
    </div>
  );
};

const ROOM_LABELS: {line: number; word: string; u: number; v: number; rot: number}[] = [
  {line: 19, word: '话术', u: 0.1, v: 0.2, rot: -6},
  {line: 20, word: '审美', u: 0.37, v: 0.36, rot: 5},
  {line: 21, word: '教育', u: 0.56, v: 0.25, rot: -4},
  {line: 22, word: '机会', u: 0.79, v: 0.28, rot: 7},
];
const labels1: Fx = ({t, at}) => {
  const all = lineStart(23);
  const pulse = t >= all ? decay(t - all, 0.3) + 0.6 * snareEnv(t, 0.12) * (t >= all ? 1 : 0) : 0;
  return {
    skipLines: [],
    paper: (
      <>
        {ROOM_LABELS.map((l) => {
          const p = at(l.u, l.v);
          const word0 = tokenTime(l.line, l.word[0]);
          return <WordLabel key={l.word} x={p.x} y={p.y} scale={p.scale} word={l.word} age={t - word0} rot={l.rot} pulse={pulse} />;
        })}
      </>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 39 广告牌 — "nobody cares" goes up on the blank billboards, one board per sung phrase.

type Pt = {x: number; y: number};

/** CSS matrix3d mapping a w × h box onto the quad [TL, TR, BR, BL] (projective, Heckbert). */
const quadMatrix = (w: number, h: number, q: Pt[]) => {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + hh * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + hh * p3.y, f = p0.y;
  // column-major 4 × 4
  return `matrix3d(${a / w},${d / w},0,${g / w}, ${b / h},${e / h},0,${hh / h}, 0,0,1,0, ${c},${f},0,1)`;
};

/** Point at (s, t) inside a quad (bilinear), used to inset the text from the board's border. */
const inQuad = (q: Pt[], s: number, t: number): Pt => ({
  x: lerp(lerp(q[0].x, q[1].x, s), lerp(q[3].x, q[2].x, s), t),
  y: lerp(lerp(q[0].y, q[1].y, s), lerp(q[3].y, q[2].y, s), t),
});

/** Board faces measured on s39_city (raw px, TL TR BR BL), and when each goes up. */
const BOARDS: {q: [number, number][]; when: () => number}[] = [
  {q: [[649, 90], [1002, 90], [1006, 306], [644, 302]], when: () => tokenTime(71, 'nobody')},
  {q: [[218, 0], [442, 102], [443, 319], [212, 214]], when: () => tokenTime(72, 'nobody')},
  {q: [[1208, 130], [1464, 0], [1471, 223], [1205, 329]], when: () => tokenTime(72, 'cares')},
];
const BW = 600;
const BH = 380;
const billboards: Fx = ({t, at}) => ({
  ink: (
    <>
      {BOARDS.map((b, i) => {
        const age = t - b.when();
        if (age < 0) return null;
        const quad = b.q.map(([x, y]) => at(x / 1672, y / 940));
        const inner = [inQuad(quad, 0.07, 0.1), inQuad(quad, 0.93, 0.1), inQuad(quad, 0.93, 0.9), inQuad(quad, 0.07, 0.9)];
        return (
          <div key={i} style={{position: 'absolute', left: 0, top: 0, width: BW, height: BH, transformOrigin: '0 0', transform: quadMatrix(BW, BH, inner), opacity: clamp(age / 0.04)}}>
            <div
              style={{
                width: BW,
                height: BH,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT_SANS,
                fontWeight: 900,
                fontSize: 150,
                lineHeight: 1.02,
                color: INK.teal,
                transform: `scale(${1 + 0.3 * decay(age, 0.06)})`,
              }}
            >
              <span>nobody</span>
              <span>cares</span>
            </div>
          </div>
        );
      })}
    </>
  ),
});

// ---------------------------------------------------------------------------------------------
// 15 窃喜 — one little note sneaks out from under the book.

const bookNote: Fx = ({t, at}) => {
  const book = at(0.7, 0.32);
  const age = t - tokenTime(25, '窃');
  if (age < 0 || age > 2.6) return {};
  return {
    ink: (
      <EighthNote
        x={book.x + (40 + 120 * age) * book.scale}
        y={book.y - (10 + 80 * age - 30 * Math.sin(age * 3)) * book.scale}
        scale={1.1 * book.scale * spring(age, 260, 12)}
        rot={Math.sin(age * 5) * 14}
        opacity={1 - clamp((age - 2.1) / 0.5)}
        ink="pink"
      />
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 17 灯牌 — the line lights up inside the marquee; the bulbs chase on the eighths.

const MARQUEE = {u0: 0.245, v0: 0.068, u1: 0.757, v1: 0.29};
const MarqueeBulbs: React.FC<{c: Ctx; opacity?: number}> = ({c, opacity = 1}) => {
  const a = c.at(MARQUEE.u0, MARQUEE.v0);
  const b = c.at(MARQUEE.u1, MARQUEE.v1);
  const step = Math.floor((c.t - beatTime(0)) / (BEAT / 2));
  const bulbs: {x: number; y: number}[] = [];
  const nx = 18;
  const ny = 5;
  for (let i = 0; i <= nx; i++) bulbs.push({x: lerp(a.x, b.x, i / nx), y: a.y}, {x: lerp(a.x, b.x, i / nx), y: b.y});
  for (let j = 1; j < ny; j++) bulbs.push({x: a.x, y: lerp(a.y, b.y, j / ny)}, {x: b.x, y: lerp(a.y, b.y, j / ny)});
  return (
    <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', opacity}}>
      {bulbs.map((p, i) => ((i + step) % 3 === 0 ? <circle key={i} cx={p.x} cy={p.y} r={13 * a.scale} fill={INK.yellow} /> : null))}
    </svg>
  );
};

const marquee: Fx = (c) => ({
  ink: (
    <>
      <MarqueeBulbs c={c} />
      <OnObject c={c} line={27} u={0.5} v={0.18} rot={0} size={78} ink="pink" shadow="yellow" />
    </>
  ),
});

// ---------------------------------------------------------------------------------------------
// 42 音符流入 — printed notes blow in through the window and stream into the listener's head.

const notesFlow: Fx = ({t, at, shot, features}) => {
  const win = at(0.24, 0.3);
  const head = at(0.6, 0.3);
  const n = 22;
  return {
    paper: (
      <>
        {Array.from({length: n}, (_, i) => {
          const t0 = shot.start + 0.3 + i * 0.27;
          const life = 1.8;
          const age = t - t0;
          if (age < 0 || age > life) return null;
          const k = age / life;
          const x = lerp(win.x, head.x, k);
          const y = lerp(win.y, head.y, k) + Math.sin(k * Math.PI * 2 + i) * 60 * win.scale * (1 - k) - Math.sin(k * Math.PI) * 80 * win.scale;
          const loud = 0.8 + features.get('vocals_rms', t) * 0.8;
          return (
            <EighthNote
              key={i}
              x={x}
              y={y}
              scale={1.15 * win.scale * loud * (1 - 0.4 * k)}
              rot={Math.sin(age * 4 + i) * 18}
              opacity={clamp(age / 0.15) * (1 - clamp((k - 0.8) / 0.2))}
              ink={(['yellow', 'cornflower', 'pink'] as InkName[])[i % 3]}
            />
          );
        })}
      </>
    ),
  };
};

// ---------------------------------------------------------------------------------------------
// 35 / 36 联结 — labels on the people; a printed five-line staff ribbons from the protagonist to
// each one, and notes ride along it on the beat. In 36 the whole web lights up.

const HUB: [number, number] = [0.335, 0.42];
const PEOPLE: {line: number; word: string; u: number; v: number; lu: number; lv: number; rot: number}[] = [
  {line: 63, word: '关系', u: 0.8, v: 0.47, lu: 0.81, lv: 0.33, rot: 5},
  {line: 64, word: '联结', u: 0.55, v: 0.45, lu: 0.55, lv: 0.28, rot: -5},
  {line: 65, word: '事件', u: 0.313, v: 0.25, lu: 0.31, lv: 0.08, rot: 4},
  {line: 66, word: '时间', u: 0.1, v: 0.52, lu: 0.1, lv: 0.36, rot: -6},
];
const cableWeb = (c: Ctx, all: boolean, withLabels: boolean): FxOut => {
  const {t, at} = c;
  const hub = at(HUB[0], HUB[1]);
  const tAll = lineStart(67);
  const pulse = t >= tAll ? decay(t - tAll, 0.3) + 0.5 * snareEnv(t, 0.12) : 0;
  const lastBeat = beatsIn(t - BEAT, t + 0.001).pop() ?? t;
  const flow = (t - lastBeat) / BEAT;
  const gap = 7 * hub.scale;
  const N = 56;
  return {
    paper: (
      <>
        <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
          {PEOPLE.map((p, pi) => {
            const k = all ? 1 : clamp((t - tokenTime(p.line, p.word[0])) / 0.5);
            if (k <= 0) return null;
            const end = at(p.u, p.v);
            const mx = (hub.x + end.x) / 2;
            const my = Math.min(hub.y, end.y) - 240 * hub.scale;
            const pt = (q: number) => ({
              x: (1 - q) ** 2 * hub.x + 2 * (1 - q) * q * mx + q * q * end.x,
              y: (1 - q) ** 2 * hub.y + 2 * (1 - q) * q * my + q * q * end.y,
            });
            const nrm = (q: number) => {
              const dx = 2 * (1 - q) * (mx - hub.x) + 2 * q * (end.x - mx);
              const dy = 2 * (1 - q) * (my - hub.y) + 2 * q * (end.y - my);
              const L = Math.hypot(dx, dy) || 1;
              return {x: -dy / L, y: dx / L, a: (Math.atan2(dy, dx) * 180) / Math.PI};
            };
            const qs = Array.from({length: N + 1}, (_, i) => (i / N) * k);
            const lineW = (3 + 1.6 * pulse) * hub.scale;
            return (
              <g key={p.word}>
                {[-2, -1, 0, 1, 2].map((j) => (
                  <polyline
                    key={j}
                    points={qs.map((q) => {
                      const a = pt(q);
                      const n = nrm(q);
                      return `${a.x + n.x * j * gap},${a.y + n.y * j * gap}`;
                    }).join(' ')}
                    fill="none"
                    stroke={INK.cornflower}
                    strokeWidth={lineW}
                    strokeLinecap="round"
                  />
                ))}
                {[0.25, 0.5, 0.75].filter((q) => q <= k).map((q) => {
                  const a = pt(q);
                  const n = nrm(q);
                  return <line key={q} x1={a.x - n.x * 2 * gap} y1={a.y - n.y * 2 * gap} x2={a.x + n.x * 2 * gap} y2={a.y + n.y * 2 * gap} stroke={INK.cornflower} strokeWidth={lineW} />;
                })}
                {k >= 1 &&
                  [0, 0.5].map((o) => {
                    const q = (flow + o) % 1;
                    const a = pt(q);
                    const n = nrm(q);
                    // a different staff position (pitch) for each note
                    const step = Math.floor(random(`pitch${pi}${o}${Math.floor(lastBeat * 10)}`) * 9) - 4;
                    const x = a.x + n.x * step * gap * 0.5;
                    const y = a.y + n.y * step * gap * 0.5;
                    return (
                      <g key={o} transform={`translate(${x} ${y}) rotate(${n.a})`}>
                        <ellipse rx={gap * 1.25} ry={gap * 0.9} transform="rotate(-20)" fill={INK.pink} />
                        <rect x={gap * 1.0} y={-gap * 4.2} width={gap * 0.42} height={gap * 4.2} fill={INK.pink} />
                      </g>
                    );
                  })}
              </g>
            );
          })}
        </svg>
        {withLabels &&
          PEOPLE.map((p) => {
            const q = at(p.lu, p.lv);
            return <WordLabel key={p.word} x={q.x} y={q.y} scale={q.scale} word={p.word} age={t - tokenTime(p.line, p.word[0])} rot={p.rot} pulse={pulse} ink="pink" />;
          })}
      </>
    ),
  };
};
const labels2: Fx = (c) => cableWeb(c, false, true);
const cables: Fx = (c) => cableWeb(c, true, true);

// ---------------------------------------------------------------------------------------------
// 21 放大镜 — the line is printed on the cassette's label, magnified by the lens; "忐忑" shakes.

const lens: Fx = (c) => {
  const shakeT = c.t - tokenTime(38, '忐');
  const e = shakeT >= 0 ? decay(shakeT, 0.25) : 0;
  return {
    skipLines: [37],
    cam: {...c.cam, x: c.cam.x + Math.sin(c.t * 70) * 0.06 * e, y: c.cam.y + Math.cos(c.t * 63) * 0.04 * e},
    ink: <OnObject c={c} line={37} u={0.497} v={0.487} rot={-12} size={42} ink="teal" />,
  };
};

// ---------------------------------------------------------------------------------------------
// 22 镜子 — a line written on the fog; then the mirror's halftone breaks apart into big dots.

const MIRROR = [340 / 1672, 0, 1430 / 1672, 685 / 941] as const;
const mirror: Fx = (c) => {
  const a = c.at(MIRROR[0], MIRROR[1]);
  const b = c.at(MIRROR[2], MIRROR[3]);
  const t0 = lineStart(42);
  const k = smooth((c.t - t0 + 0.1) / (LINES[42].e - t0 + 0.3));
  return {
    skipLines: [41],
    riso: k > 0 ? {cellRect: [a.x, a.y, b.x, b.y], cellMul: 1 + 7 * k + 1.5 * snareEnv(c.t, 0.1) * k} : {},
    ink: <OnObject c={c} line={41} u={0.73} v={0.62} rot={-3} size={48} ink="cornflower" />,
  };
};

export const FX: Record<string, Fx> = {
  summer,
  teen,
  windows,
  noise,
  shake,
  colorWipe,
  split,
  you,
  freaking,
  notAnymore,
  nobody,
  bubble,
  snow,
  live,
  flashback,
  ending,
  credits,
  // Filled in once their plates exist (need coordinates from the images):
  chords,
  form,
  scale,
  blocks,
  sounds,
  spotlight,
  pieces,
  labels1,
  bookNote,
  marquee,
  lens,
  mirror,
  tally,
  dayNight,
  labels2,
  cables,
  billboards,
  scroll: none,
  notesFlow,
};

export {kickEnv, snareEnv, tokenTime, lineStart, beatsIn};
