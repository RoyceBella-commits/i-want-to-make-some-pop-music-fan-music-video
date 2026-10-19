import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
await build({entryPoints: ['verify/blank.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'verify/.blank.mjs', loader: {'.json': 'json'}, logLevel: 'error'});
execFileSync('node', ['verify/.blank.mjs', process.argv[2]], {stdio: 'inherit'});
