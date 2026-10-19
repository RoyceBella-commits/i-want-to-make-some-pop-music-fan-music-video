import {SHOTS, linesOf} from '../src/story/shots';
import {wrapLine} from '../src/type/layout';
for (const s of SHOTS) {
  if (!s.lyric) continue;
  const stretch = s.lyric.stretch ? 1.75 : 1;
  const pad = s.lyric.layout === 'staff' ? 0.5 : 0;
  const maxEm = Math.max(4, Math.min(s.lyric.maxEm, (1920 - 112) / (s.lyric.size * stretch) - pad));
  for (const l of linesOf(s)) {
    const rows = wrapLine(l, maxEm);
    if (rows.length > 1) console.log(`shot ${s.n} @${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, '0')} line ${l.i}: ${rows.map((r) => r.items.map((i) => i.tok.t).join('')).join(' / ')}`);
  }
}
