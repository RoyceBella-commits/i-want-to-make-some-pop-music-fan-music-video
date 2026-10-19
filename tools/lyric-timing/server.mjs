// Tiny local server for the lyric timing editor: static files, ranged audio, overrides save.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const PORT = Number(process.env.PORT || 5177);
const OVERRIDES = path.join(root, 'data/lyrics_overrides.json');

const FILES = {
  '/': [path.join(here, 'index.html'), 'text/html; charset=utf-8'],
  '/timeline.json': [path.join(root, 'story/public/data/timeline.json'), 'application/json'],
  '/features.json': [path.join(root, 'story/public/data/features.json'), 'application/json'],
  '/features.bin': [path.join(root, 'story/public/data/features.bin'), 'application/octet-stream'],
  '/audio.wav': [path.join(root, 'data/mix.wav'), 'audio/wav'],
};

const sendFile = (req, res, file, type) => {
  const {size} = fs.statSync(file);
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    });
    fs.createReadStream(file, {start, end}).pipe(res);
    return;
  }
  res.writeHead(200, {'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store'});
  fs.createReadStream(file).pipe(res);
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/overrides' && req.method === 'GET') {
      res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
      res.end(fs.existsSync(OVERRIDES) ? fs.readFileSync(OVERRIDES) : '{"tokens":{},"reviewed":[]}');
      return;
    }
    if (url.pathname === '/overrides' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 2e6) req.destroy();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          fs.writeFileSync(OVERRIDES, JSON.stringify(data, null, 1));
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end('{"ok":true}');
        } catch (e) {
          res.writeHead(400);
          res.end(String(e));
        }
      });
      return;
    }
    const entry = FILES[url.pathname];
    if (!entry) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    sendFile(req, res, ...entry);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`lyric timing editor on http://localhost:${PORT}`));
