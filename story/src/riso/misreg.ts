import {sinceHit} from '../lib/lyrics';
import {decay} from '../lib/time';
import type {InkName} from '../lib/theme';

/** Resting misregistration of each drum (px): a riso print is never perfectly aligned. */
const BASE: Record<InkName, [number, number]> = {
  yellow: [0, 0],
  teal: [1.6, -1.1],
  cornflower: [-1.3, 0.9],
  pink: [2.2, 1.4],
  brown: [-0.9, -1.7],
};
/** Direction each drum is knocked on a snare hit. */
const KICK_DIR: Record<InkName, [number, number]> = {
  yellow: [-0.6, 0.8],
  teal: [1, -0.2],
  cornflower: [-1, -0.4],
  pink: [0.5, 1],
  brown: [0.2, -1],
};

/**
 * Per-ink offsets in screen px at time t (y down). The snare (2 & 4 in this groove) shoves the
 * drums apart and they settle back softly, so the print itself breathes with the backbeat.
 */
export const misreg = (t: number, amount = 1): Record<InkName, [number, number]> => {
  const hit = decay(sinceHit('s', t), 0.16) * 5.5 * amount;
  const out = {} as Record<InkName, [number, number]>;
  for (const k of Object.keys(BASE) as InkName[]) {
    out[k] = [BASE[k][0] + KICK_DIR[k][0] * hit, BASE[k][1] + KICK_DIR[k][1] * hit];
  }
  return out;
};

/** Grain re-seeds at 12 fps: the print "boils" like hand-made animation instead of shimmering. */
export const boilSeed = (t: number) => Math.floor(t * 12) % 997;

/** Knock every drum apart by `e` (0..1) — the ink jolt that replaces a print-in on a hard cut. */
export const jolt = (o: Record<InkName, [number, number]>, e: number): Record<InkName, [number, number]> => {
  const out = {} as Record<InkName, [number, number]>;
  for (const k of Object.keys(o) as InkName[]) out[k] = [o[k][0] + KICK_DIR[k][0] * 9 * e, o[k][1] + KICK_DIR[k][1] * 9 * e];
  return out;
};
