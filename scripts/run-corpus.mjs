import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'node_modules/.bin/tree-sitter');
if (!existsSync(cli)) throw new Error('Tree-sitter CLI missing; run npm install first');
// Run against the maintained grammar, not the repository root.
execFileSync(cli, ['test'], { cwd: resolve(root, 'grammar'), stdio: 'inherit' });
