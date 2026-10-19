// Keeps the song's lyrics out of the repository.
//
// public/data/timeline.public.json (committed) holds every timing, pitch and token *shape* but no
// lyric text. public/data/timeline.json (git-ignored, read by the code) is the same data with the
// text filled back in from your own copy of the song.
//
//   node scripts/lyrics.mjs merge <song.flac | lyrics.lrc>   restore text  -> timeline.json
//   node scripts/lyrics.mjs strip                             remove text   -> timeline.public.json
//
// merge reads the lyrics embedded in the FLAC (via ffprobe) or an LRC file with the same lines.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/data');
const FULL = path.join(dataDir, 'timeline.json');
const PUBLIC = path.join(dataDir, 'timeline.public.json');

// Same tokeniser as analysis/align.py: one CJK character or one Latin word per sung unit.
const UNIT = /[A-Za-z][A-Za-z']*|[0-9]+|[㐀-鿿]|\s+|[\s\S]/gu;
const tokenize = (text) => (text.match(UNIT) ?? []).map((s) => (/^\s+$/.test(s) ? ' ' : s));
const kindOf = (s) =>
  /^\s+$/.test(s) ? 's' : /^[A-Za-z]/.test(s) ? 'l' : /^[0-9]/.test(s) ? 'n' : /^[㐀-鿿]$/u.test(s) ? 'h' : 'p';

// Same LRC parsing as analysis/prepare.py (credit lines are skipped).
const CREDIT_KEYS = ['作词', '作曲', '演唱', '制作人', '编曲', '混音', '母带'];
const TS = /^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/;
const parseLrc = (raw) =>
  raw
    .split(/\r?\n/)
    .map((row) => row.trim().match(TS))
    .filter(Boolean)
    .map((m) => m[3].trim())
    .filter((text) => text && !CREDIT_KEYS.some((k) => text.startsWith(k)));

const readLyrics = (src) => {
  if (/\.(lrc|txt)$/i.test(src)) return fs.readFileSync(src, 'utf8');
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', src], {encoding: 'utf8'});
  const tags = JSON.parse(out).format?.tags ?? {};
  const key = Object.keys(tags).find((k) => k.toLowerCase() === 'lyrics');
  if (!key) throw new Error(`no embedded lyrics found in ${src}`);
  return tags[key];
};

const strip = () => {
  const tl = JSON.parse(fs.readFileSync(FULL, 'utf8'));
  tl.lines = tl.lines.map(({text, tokens, ...rest}) => ({
    ...rest,
    tokens: tokens.map(({t, ...tok}) => ({k: kindOf(t), ...tok})),
  }));
  fs.writeFileSync(PUBLIC, JSON.stringify(tl));
  console.log(`wrote ${path.relative(process.cwd(), PUBLIC)} (${tl.lines.length} lines, no lyric text)`);
};

const merge = (src) => {
  if (!src) throw new Error('usage: node scripts/lyrics.mjs merge <song.flac | lyrics.lrc>');
  const tl = JSON.parse(fs.readFileSync(PUBLIC, 'utf8'));
  const texts = parseLrc(readLyrics(src));
  if (texts.length !== tl.lines.length) {
    throw new Error(`found ${texts.length} lyric lines, expected ${tl.lines.length}. Use the original release (its embedded lyrics have every line).`);
  }
  tl.lines = tl.lines.map((line, i) => {
    const toks = tokenize(texts[i]);
    const shape = line.tokens.map((t) => t.k).join('');
    if (toks.map(kindOf).join('') !== shape) throw new Error(`line ${i + 1} does not match the timing data: "${texts[i]}"`);
    const {i: idx, tokens, ...rest} = line;
    return {i: idx, text: texts[i], ...rest, tokens: tokens.map(({k, ...tok}, j) => ({t: toks[j], ...tok}))};
  });
  fs.writeFileSync(FULL, JSON.stringify(tl));
  console.log(`wrote ${path.relative(process.cwd(), FULL)} (${tl.lines.length} lines) — keep it local, it is git-ignored`);
};

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'merge') merge(arg);
else if (cmd === 'strip') strip();
else {
  console.log('usage: node scripts/lyrics.mjs merge <song.flac | lyrics.lrc>\n       node scripts/lyrics.mjs strip');
  process.exit(1);
}
