import React from 'react';
import {INK, type InkName} from '../lib/theme';

/** Open-position chord shapes, low E -> high e. -1 = muted, 0 = open, n = fret. */
export const CHORDS = {
  C: [-1, 3, 2, 0, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  Am: [-1, 0, 2, 2, 1, 0],
  F: [-1, -1, 3, 2, 1, 1],
} as const;
export type ChordName = keyof typeof CHORDS;

type Pos = {x: number; y: number; scale: number; rot?: number; opacity?: number};
const wrap = ({x, y, scale, rot = 0, opacity = 1}: Pos): React.CSSProperties => ({
  position: 'absolute',
  left: x,
  top: y,
  transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
  opacity,
  overflow: 'visible',
});

/** A chord diagram inside a speech bubble whose tail (-1 left .. +1 right) points back to the guitar. */
export const ChordBubble: React.FC<Pos & {chord: ChordName; ink: InkName; dot: InkName; fill: InkName; tail: number}> = ({
  chord,
  ink,
  dot,
  fill,
  tail,
  ...pos
}) => {
  const frets = CHORDS[chord];
  const W = 120;
  const H = 150;
  const gx = (i: number) => 22 + i * 15.2;
  const gy = (f: number) => 44 + f * 22;
  // tail: -1 points down-left, +1 down-right (toward wherever the sound came from).
  const tailBase = W / 2 + tail * 30;
  const tailTip = W / 2 + tail * 58;
  return (
    <svg width={W} height={H + 30} viewBox={`0 0 ${W} ${H + 30}`} style={wrap(pos)}>
      <path
        d={`M14 4 H${W - 14} Q${W - 4} 4 ${W - 4} 14 V${H - 14} Q${W - 4} ${H - 4} ${W - 14} ${H - 4} H${tailBase + 13} L${tailTip} ${
          H + 24
        } L${tailBase - 13} ${H - 4} H14 Q4 ${H - 4} 4 ${H - 14} V14 Q4 4 14 4 Z`}
        fill={INK[fill]}
        fillOpacity={0.55}
        stroke={INK[ink]}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <rect x={gx(0) - 1} y={gy(0) - 5} width={gx(5) - gx(0) + 2} height={5} fill={INK[ink]} />
      {[1, 2, 3, 4].map((f) => (
        <line key={f} x1={gx(0)} x2={gx(5)} y1={gy(f)} y2={gy(f)} stroke={INK[ink]} strokeWidth={2.4} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <line key={s} x1={gx(s)} x2={gx(s)} y1={gy(0)} y2={gy(4)} stroke={INK[ink]} strokeWidth={2.4} />
      ))}
      {frets.map((f, s) =>
        f > 0 ? (
          <circle key={s} cx={gx(s)} cy={gy(f) - 11} r={6.5} fill={INK[dot]} />
        ) : f === 0 ? (
          <circle key={s} cx={gx(s)} cy={gy(0) - 16} r={4.2} fill="none" stroke={INK[ink]} strokeWidth={2.4} />
        ) : (
          <g key={s} stroke={INK[ink]} strokeWidth={2.4}>
            <line x1={gx(s) - 4} x2={gx(s) + 4} y1={gy(0) - 20} y2={gy(0) - 12} />
            <line x1={gx(s) + 4} x2={gx(s) - 4} y1={gy(0) - 20} y2={gy(0) - 12} />
          </g>
        ),
      )}
    </svg>
  );
};

/** An eighth note (head, stem, flag). */
export const EighthNote: React.FC<Pos & {ink: InkName}> = ({ink, ...pos}) => (
  <svg width={60} height={80} viewBox="0 0 60 80" style={wrap(pos)}>
    <ellipse cx={20} cy={62} rx={13} ry={9.5} transform="rotate(-22 20 62)" fill={INK[ink]} />
    <rect x={30} y={10} width={5} height={52} fill={INK[ink]} />
    <path d="M35 10 C 44 20, 54 24, 50 44 C 48 32, 42 28, 35 26 Z" fill={INK[ink]} />
  </svg>
);

/** Comic "tick" lines radiating to one side of a point (the metronome swing). */
export const Ticks: React.FC<Pos & {ink: InkName; side: 1 | -1}> = ({ink, side, ...pos}) => (
  <svg width={120} height={120} viewBox="-60 -60 120 120" style={wrap(pos)}>
    {[-40, -10, 20].map((a, i) => {
      const r = ((a * side + (side > 0 ? 0 : 180)) * Math.PI) / 180;
      return (
        <line
          key={i}
          x1={Math.cos(r) * 22}
          y1={Math.sin(r) * 22}
          x2={Math.cos(r) * 46}
          y2={Math.sin(r) * 46}
          stroke={INK[ink]}
          strokeWidth={9}
          strokeLinecap="round"
        />
      );
    })}
  </svg>
);

/** Sound arcs opening to the left of a point. */
export const Arcs: React.FC<Pos & {ink: InkName; radius: number}> = ({ink, radius, ...pos}) => (
  <svg width={300} height={300} viewBox="-150 -150 300 300" style={wrap(pos)}>
    {[0, 1].map((k) => {
      const r = radius + k * 22;
      return (
        <path
          key={k}
          d={`M ${-r * Math.cos(0.75)} ${-r * Math.sin(0.75)} A ${r} ${r} 0 0 0 ${-r * Math.cos(0.75)} ${r * Math.sin(0.75)}`}
          fill="none"
          stroke={INK[ink]}
          strokeWidth={9 - k * 3}
          strokeLinecap="round"
        />
      );
    })}
  </svg>
);

/** A shop label on a string: an opaque paper object, so it reads on top of busy record spines. */
export const Tag: React.FC<Pos & {ink: InkName; string: InkName}> = ({ink, string, ...pos}) => (
  <svg width={70} height={90} viewBox="0 0 70 90" style={wrap(pos)}>
    <path d="M35 4 C 30 18, 40 24, 35 34" fill="none" stroke={INK[string]} strokeWidth={3} />
    <path d="M14 40 L35 30 L56 40 V82 H14 Z" fill="#F3ECDD" stroke={INK[ink]} strokeWidth={4} strokeLinejoin="round" />
    <circle cx={35} cy={42} r={4.5} fill={INK[string]} />
    <rect x={22} y={56} width={26} height={5} fill={INK[ink]} />
    <rect x={22} y={67} width={18} height={5} fill={INK[ink]} />
  </svg>
);

/** Thought dots and a small cloud. */
export const Thought: React.FC<Pos & {ink: InkName; dots: number; cloud: number}> = ({ink, dots, cloud, ...pos}) => (
  <svg width={160} height={160} viewBox="0 0 160 160" style={wrap(pos)}>
    {[0, 1, 2].map((i) =>
      dots > i ? <circle key={i} cx={30 + i * 22} cy={140 - i * 26} r={5 + i * 3} fill={INK[ink]} opacity={Math.min(1, (dots - i) * 3)} /> : null,
    )}
    {cloud > 0 && (
      <path
        d="M96 64 C 80 64 76 46 90 40 C 88 24 110 18 118 30 C 128 18 150 26 146 42 C 158 48 152 66 138 64 Z"
        fill="none"
        stroke={INK[ink]}
        strokeWidth={5}
        strokeLinejoin="round"
        transform={`translate(118 44) scale(${cloud}) translate(-118 -44)`}
      />
    )}
  </svg>
);

/** A hand-printed arrow with tick marks — a little history timeline. */
export const Timeline: React.FC<{x0: number; x1: number; y: number; draw: number; ink: InkName; ticks: number}> = ({
  x0,
  x1,
  y,
  draw,
  ink,
  ticks,
}) => {
  const xe = x0 + (x1 - x0) * draw;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible'}}>
      <line x1={x0} x2={xe} y1={y} y2={y} stroke={INK[ink]} strokeWidth={5} strokeLinecap="round" />
      {draw > 0.98 && <path d={`M${x1 - 18} ${y - 12} L${x1 + 4} ${y} L${x1 - 18} ${y + 12}`} fill="none" stroke={INK[ink]} strokeWidth={5} strokeLinejoin="round" />}
      {Array.from({length: ticks}, (_, i) => {
        const tx = x0 + ((i + 0.5) / ticks) * (x1 - x0);
        return tx <= xe ? <line key={i} x1={tx} x2={tx} y1={y - 12} y2={y + 12} stroke={INK[ink]} strokeWidth={4} /> : null;
      })}
    </svg>
  );
};

export type SymbolKind = 'quarter' | 'eighth' | 'beamed' | 'half' | 'sharp' | 'flat' | 'rest';
export const SYMBOL_KINDS: SymbolKind[] = ['quarter', 'eighth', 'beamed', 'half', 'sharp', 'flat', 'rest'];

/** Printed music symbols (100 × 100 box) for falling / flying decorations. */
export const MusicSymbol: React.FC<Pos & {kind: SymbolKind; ink: InkName; size: number}> = ({kind, ink, size, ...pos}) => {
  const c = INK[ink];
  const head = (x: number, y: number, open = false) => (
    <ellipse cx={x} cy={y} rx={13} ry={9.5} transform={`rotate(-22 ${x} ${y})`} fill={open ? 'none' : c} stroke={c} strokeWidth={open ? 5 : 0} />
  );
  let body: React.ReactNode;
  switch (kind) {
    case 'quarter':
      body = (<>{head(42, 76)}<rect x={51} y={14} width={5} height={62} fill={c} /></>);
      break;
    case 'half':
      body = (<>{head(42, 76, true)}<rect x={52} y={14} width={5} height={60} fill={c} /></>);
      break;
    case 'eighth':
      body = (<>{head(40, 76)}<rect x={49} y={14} width={5} height={62} fill={c} /><path d="M54 14 C 63 24, 73 28, 69 48 C 67 36, 61 32, 54 30 Z" fill={c} /></>);
      break;
    case 'beamed':
      body = (<>{head(24, 80)}{head(70, 70)}<rect x={33} y={22} width={5} height={58} fill={c} /><rect x={79} y={12} width={5} height={58} fill={c} /><polygon points="33,22 84,12 84,24 33,34" fill={c} /></>);
      break;
    case 'sharp':
      body = (<g stroke={c} strokeLinecap="round"><line x1={40} y1={14} x2={38} y2={88} strokeWidth={6} /><line x1={62} y1={10} x2={60} y2={84} strokeWidth={6} /><line x1={26} y1={42} x2={76} y2={32} strokeWidth={10} /><line x1={26} y1={66} x2={76} y2={56} strokeWidth={10} /></g>);
      break;
    case 'flat':
      body = (<g fill="none" stroke={c} strokeWidth={6} strokeLinecap="round"><line x1={38} y1={8} x2={38} y2={88} /><path d="M38 60 C 52 48, 70 52, 64 66 C 60 76, 46 84, 38 88" strokeWidth={7} /></g>);
      break;
    default:
      // quarter rest
      body = <path d="M44 10 L62 32 C 52 42, 52 50, 64 62 C 50 58, 44 66, 54 84 C 38 74, 40 60, 52 58 L 38 40 C 48 32, 50 24, 44 10 Z" fill={c} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={wrap(pos)}>
      {body}
    </svg>
  );
};
