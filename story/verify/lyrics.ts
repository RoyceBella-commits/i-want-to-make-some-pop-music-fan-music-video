// Checks that every lyric line is printed somewhere: either by the shot's lyric layer, or by an
// effect that puts it onto an object (diegetic). Also checks shots are contiguous.
// run: node verify/run.mjs
import {LINES} from '../src/lib/lyrics';
import {SHOTS, linesOf} from '../src/story/shots';

/** Lines an effect prints itself, and the shot effect that does it. */
const DIEGETIC: Record<number, string> = {
  8: 'form',
  27: 'marquee',
  29: 'bubble',
  37: 'lens',
  41: 'mirror',
  60: 'freaking',
  102: 'flashback',
};

let bad = 0;
for (const l of LINES) {
  const shot = SHOTS.find((s) => linesOf(s).some((x) => x.i === l.i));
  if (!shot) {
    console.log(`MISSING shot for line ${l.i} ${l.text}`);
    bad++;
    continue;
  }
  const fx = DIEGETIC[l.i];
  if (fx) {
    if (shot.fx !== fx) {
      console.log(`line ${l.i} should be printed by fx '${fx}' but shot ${shot.n} has fx '${shot.fx}'`);
      bad++;
    }
  } else if (!shot.lyric) {
    console.log(`line ${l.i} "${l.text}" falls in shot ${shot.n} which has no lyric layer`);
    bad++;
  }
}
for (let i = 1; i < SHOTS.length; i++) {
  if (SHOTS[i].start <= SHOTS[i - 1].start) {
    console.log(`shot ${SHOTS[i].n} starts before ${SHOTS[i - 1].n}`);
    bad++;
  }
}
console.log(bad ? `${bad} problem(s)` : `OK: ${LINES.length} lines covered by ${SHOTS.length} shots`);
process.exit(bad ? 1 : 0);
