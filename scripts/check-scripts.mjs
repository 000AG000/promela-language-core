import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const scripts = resolve(root, 'scripts');
const paths = [
  ...readdirSync(scripts).filter(file => file.endsWith('.mjs')).map(file => resolve(scripts, file)),
  ...readdirSync(resolve(scripts, 'tooling')).filter(file => file.endsWith('.mjs')).map(file => resolve(scripts, 'tooling', file)),
  resolve(root, 'eslint.config.mjs'),
];
for (const path of paths) {
  execFileSync(process.execPath, ['--check', path], {stdio: 'inherit'});
}
console.log(`JavaScript syntax OK: ${paths.length} files`);
