import timeline from '../../public/data/timeline.json';

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_FRAMES = Math.ceil(timeline.duration * FPS);

const {period: BEAT, first_downbeat: FIRST} = timeline.grid;
export {BEAT};
export const BAR = BEAT * 4;
export const BPM = timeline.grid.bpm;

export const secOf = (frame: number) => frame / FPS;
export const frameOf = (sec: number) => Math.round(sec * FPS);

/** Continuous beat count from the first downbeat (beat 0 = bar 1, beat 1). */
export const beatPos = (t: number) => (t - FIRST) / BEAT;
/** 0..1 position inside the current beat. */
export const beatPhase = (t: number) => {
  const p = beatPos(t);
  return p - Math.floor(p);
};
/** 1-based bar number. */
export const barOf = (t: number) => Math.floor(beatPos(t) / 4) + 1;
/** 0..3 beat inside the bar. */
export const beatInBar = (t: number) => ((Math.floor(beatPos(t)) % 4) + 4) % 4;
export const barStart = (bar: number) => FIRST + (bar - 1) * BAR;
export const beatTime = (beat: number) => FIRST + beat * BEAT;

/** Seconds elapsed since the most recent grid beat (quantised, "pop" feel). */
export const sinceBeat = (t: number) => beatPhase(t) * BEAT;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (x: number) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};
/** Exponential decay envelope starting at dt = 0. */
export const decay = (dt: number, tau: number) => (dt < 0 ? 0 : Math.exp(-dt / tau));

/**
 * Damped spring step response, 0 -> 1. Low stiffness + soft damping = "laid-back" soul,
 * high stiffness = crisp pop.
 */
export const spring = (dt: number, stiffness = 180, damping = 12) => {
  if (dt <= 0) return 0;
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * dt) * (Math.cos(wd * dt) + ((zeta * w0) / wd) * Math.sin(wd * dt));
  }
  return 1 - Math.exp(-w0 * dt) * (1 + w0 * dt);
};

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};
