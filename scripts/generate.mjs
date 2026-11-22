import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'node_modules/.bin/tree-sitter');
if (!existsSync(cli)) throw new Error('Missing tree-sitter CLI: run npm install first.');
const cwd = resolve(root, 'grammar');
execFileSync(cli, ['generate'], {cwd, stdio: 'inherit'});
console.log('Generated grammar/src/parser.c and grammar/src/node-types.json');
