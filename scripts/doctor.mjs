import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lockfileProblems } from './tooling/lockfile.mjs';

const root = resolve(import.meta.dirname, '..');
const strict = process.argv.includes('--strict');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
let errors = 0;
let warnings = 0;
function report(label, state, detail = '') {
  const tag = state === 'ok' ? 'OK  ' : state === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${tag} ${label}${detail ? ` — ${detail}` : ''}`);
  if (state === 'warn') warnings++;
  if (state === 'fail') errors++;
}
function checkFile(label, path, required = true) {
  const present = existsSync(resolve(root, path));
  report(label, present ? 'ok' : required ? 'fail' : 'warn', present ? '' : `missing ${path}`);
}
const [major, minor] = process.versions.node.split('.').map(Number);
report('Node.js >= 20.11', major > 20 || (major === 20 && minor >= 11) ? 'ok' : 'fail', process.version);
checkFile('Maintained grammar', 'grammar/grammar.js');
checkFile('Original MIT license', 'grammar/LICENSE');
checkFile('Maintainer attribution', 'LICENSE');
checkFile('Agent guidance', 'AGENTS.md');
checkFile('Contributor guide', 'CONTRIBUTING.md');
checkFile('Tree-sitter CLI installed', 'node_modules/.bin/tree-sitter');
checkFile('TypeScript installed', 'node_modules/typescript');
checkFile('WASM runtime installed', 'node_modules/web-tree-sitter');
checkFile('ESLint installed', 'node_modules/eslint');
checkFile('Prettier installed', 'node_modules/prettier');
const lockPath = resolve(root, 'package-lock.json');
if (!existsSync(lockPath)) {
  report('Lockfile', strict ? 'fail' : 'warn', 'run npm install and commit package-lock.json');
} else {
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    const problems = lockfileProblems(manifest, lock);
    report('Lockfile metadata', problems.length ? 'fail' : 'ok', problems.join('; '));
  } catch (error) {
    report('Lockfile readable', 'fail', error.message);
  }
}
checkFile('Built WASM (optional before first build)', 'assets/tree-sitter-promela.wasm', false);
console.log(`Project ${manifest.version} | Node ${process.version} | ${errors} errors, ${warnings} warnings`);
if (errors) process.exitCode = 1;
