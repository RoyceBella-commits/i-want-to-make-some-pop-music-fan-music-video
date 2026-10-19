import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import layout from '../../public/data/features.json';
import {FPS} from './time';

/** Per-frame audio features computed by analysis/features.py (float32 [frame][channel]). */
export type Features = {
  /** Value of a channel at time t (seconds), linearly interpolated. */
  get: (name: Channel, t: number) => number;
  /** Max of a channel over [t - window, t]. */
  peak: (name: Channel, t: number, window: number) => number;
  spectrum: (t: number) => number[];
  chroma: (t: number) => number[];
};
export type Channel = (typeof layout.channels)[number];

const N_CH = layout.channels.length;
const INDEX = new Map(layout.channels.map((c, i) => [c, i]));
let cache: Promise<Float32Array> | null = null;

const load = () => {
  cache ??= fetch(staticFile('data/features.bin'))
    .then((r) => r.arrayBuffer())
    .then((b) => new Float32Array(b));
  return cache;
};

const make = (data: Float32Array): Features => {
  const frames = data.length / N_CH;
  const at = (ch: number, f: number) => data[Math.min(frames - 1, Math.max(0, f)) * N_CH + ch];
  const get = (name: Channel, t: number) => {
    const ch = INDEX.get(name)!;
    const x = t * layout.fps;
    const f = Math.floor(x);
    const k = x - f;
    return at(ch, f) * (1 - k) + at(ch, f + 1) * k;
  };
  return {
    get,
    peak: (name, t, window) => {
      const ch = INDEX.get(name)!;
      const f1 = Math.round(t * layout.fps);
      const f0 = Math.round((t - window) * layout.fps);
      let m = 0;
      for (let f = f0; f <= f1; f++) m = Math.max(m, at(ch, f));
      return m;
    },
    spectrum: (t) => Array.from({length: 32}, (_, i) => get(`spec_${String(i).padStart(2, '0')}` as Channel, t)),
    chroma: (t) =>
      ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'].map((n) => get(`chroma_${n}` as Channel, t)),
  };
};

export const useFeatures = (): Features | null => {
  const [features, setFeatures] = useState<Features | null>(null);
  const [handle] = useState(() => delayRender('features.bin'));
  useEffect(() => {
    load()
      .then((d) => {
        setFeatures(make(d));
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
  return features;
};

export {FPS};
