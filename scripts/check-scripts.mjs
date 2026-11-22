import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const scripts = resolve(root, 'scripts');
const paths = readdirSync(scripts).filter(file => file.endsWith('.mjs')).sort();
for (const file of paths) {
  execFileSync(process.execPath, ['--check', resolve(scripts, file)], {stdio: 'inherit'});
}
console.log(`JavaScript syntax OK: ${paths.length} scripts`);
