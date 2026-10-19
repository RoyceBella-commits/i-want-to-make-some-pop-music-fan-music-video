// Flags frames that look like blank paper (very bright, flat) outside the expected print-in
// window after each cut, which would mean a plate was not ready when the frame was captured.
import {readFileSync} from 'node:fs';
import {SHOTS, revealTimes} from '../src/story/shots';

const y = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(Number);
const paper = Math.max(...y.slice(0, 3));
const bad: number[] = [];
y.forEach((v, f) => {
  const t = f / 60;
  if (v < paper - 6) return;
  const s = SHOTS.find((x) => t >= x.start && t < x.end)!;
  const times = revealTimes(s);
  const printed = s.reveal === 'none' ? s.start : times[Math.min(1, times.length - 1)] + 0.24;
  if (t > printed + 0.05 && s.fx !== 'credits' && s.fx !== 'bubble') bad.push(f);
});
console.log(`paper Y≈${paper}; suspicious frames: ${bad.length}`, bad.slice(0, 40).map((f) => (f / 60).toFixed(2)).join(' '));
