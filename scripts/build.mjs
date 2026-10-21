import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
// Only this explicit allowlist reaches GitHub Pages. Server files and secrets never do.
const output = path.resolve('dist');
if (path.dirname(output) !== process.cwd() || path.basename(output) !== 'dist') throw new Error('Unexpected output path.');
await rm(output, { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
console.log('Static site copied from public/ to dist/.');
