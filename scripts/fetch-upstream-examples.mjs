import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'vendor/tree-sitter-promela');
const ref = '91da8f141c3c4c695eb71018c8a7b2e7ea39c167';
mkdirSync(resolve(root, 'vendor'), { recursive: true });
const run = (args, cwd = root) => execFileSync('git', args, { cwd, stdio: 'inherit' });
if (!existsSync(resolve(dir, '.git')))
  run(['clone', 'https://github.com/siraben/tree-sitter-promela.git', dir]);
run(['fetch', 'origin', ref], dir);
run(['checkout', '--detach', ref], dir);
console.log('Downloaded upstream examples for AUDITING ONLY. Not used for grammar generation.');
