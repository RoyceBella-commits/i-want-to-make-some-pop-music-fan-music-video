import {LINES} from '../src/lib/lyrics';
import {SHOTS, linesOf} from '../src/story/shots';
for (const s of SHOTS) for (const l of linesOf(s)) {
  const late = l.tokens.filter((t) => t.s !== undefined && t.s >= s.end - 0.02 && t.t.trim());
  if (late.length) {
    const next = SHOTS[SHOTS.indexOf(s) + 1];
    console.log(`shot ${s.n} (ends ${s.end.toFixed(2)}) line ${l.i} "${l.text}": ${late.map((t) => t.t + '@' + t.s!.toFixed(2)).join(' ')} -> next ${next?.n} lyric=${next?.lyric ? 'yes' : 'NO'}`);
  }
}
for (const i of [25, 28, 29, 39, 40, 42, 57, 58, 86]) console.log(i, LINES[i].tokens.map((t) => `${t.t}@${(t.s ?? 0).toFixed(2)}`).join(' '));
