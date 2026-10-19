import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
await build({entryPoints: ['verify/lyrics.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'verify/.out.mjs', loader: {'.json': 'json'}, logLevel: 'error'});
execFileSync('node', ['verify/.out.mjs'], {stdio: 'inherit'});
