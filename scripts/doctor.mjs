import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const checks = [
  ['Maintained grammar', 'grammar/grammar.js'],
  ['Original MIT license', 'grammar/LICENSE'],
  ['Agent guidance', 'AGENTS.md'],
  ['Contributor guide', 'CONTRIBUTING.md'],
  ['Core manifest', 'package.json'],
  ['Lockfile (required before public CI/release)', 'package-lock.json'],
  ['Installed dependencies', 'node_modules/web-tree-sitter'],
];
let missingRequired = 0;
for (const [label, path] of checks) {
  const exists = existsSync(resolve(root, path));
  console.log(`${exists ? 'OK  ' : 'MISS'} ${label}`);
  if (!exists && path !== 'package-lock.json' && path !== 'node_modules/web-tree-sitter') missingRequired++;
}
if (!existsSync(resolve(root, 'package-lock.json'))) {
  console.log('NEXT: run npm install, commit package-lock.json, and switch CI to npm ci.');
}
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
console.log(`Project version: ${manifest.version} | Node: ${process.version}`);
if (missingRequired) process.exitCode = 1;
