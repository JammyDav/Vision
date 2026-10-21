import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : `${directory}/${entry.name}`))).flat();
}
const files = (await Promise.all(['public', 'server', 'scripts', 'test'].map(walk))).flat();
for (const file of files.filter(file => /\.(js|mjs)$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
for (const file of files.filter(file => file.startsWith('public/'))) {
  const source = await readFile(file, 'utf8');
  assert(!/sk-[A-Za-z0-9_-]{20,}/.test(source), `Possible provider key in ${file}`);
  if (file.endsWith('.js')) assert(!/api\.openai\.com/.test(source), `Direct provider call in ${file}`);
}
console.log('JavaScript syntax and static publication boundaries passed.');
