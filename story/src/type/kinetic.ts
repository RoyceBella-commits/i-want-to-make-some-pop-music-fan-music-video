import {clamp, decay, spring} from '../lib/time';
import type {Token} from '../lib/lyrics';

export type Feel = 'soul' | 'pop';

/** Spring tuning: soul lands late and soft, pop snaps. */
export const FEEL = {
  soul: {stiffness: 70, damping: 7.5, fade: 0.09, drop: 30, overshootScale: 0.18},
  pop: {stiffness: 420, damping: 24, fade: 0.035, drop: 28, overshootScale: 0.12},
} as const;

export type CharState = {
  /** 0 before the character is sung, 1 once it has landed. */
  on: number;
  opacity: number;
  /** Vertical landing offset in px (positive = still above its slot). */
  dy: number;
  scale: number;
  /** Variable-font weight. */
  weight: number;
  /** 0..1 while the character is being sung (for glow / accent colour). */
  singing: number;
  /** Seconds since the character started (negative before). */
  age: number;
};

/**
 * Pure per-character animation state. The character appears on the exact frame it is sung;
 * the groove feel only shapes how it lands.
 */
export const charState = (tok: Token, t: number, feel: Feel): CharState => {
  const s = tok.s ?? 0;
  const e = tok.e ?? s + 0.2;
  const cfg = FEEL[feel];
  const age = t - s;
  const sp = spring(age, cfg.stiffness, cfg.damping);
  const on = age >= 0 ? 1 : 0;
  const singing = age >= 0 && t <= e ? 1 : clamp(1 - (t - e) / 0.35) * on;
  return {
    on,
    opacity: on * clamp(age / cfg.fade),
    dy: on ? (1 - sp) * cfg.drop : cfg.drop,
    scale: on ? 1 + cfg.overshootScale * decay(age, feel === 'soul' ? 0.22 : 0.09) : 0.8,
    weight: 520 + 330 * singing,
    singing,
    age,
  };
};
