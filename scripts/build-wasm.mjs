import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { artifactSignature } from './artifact-signature.mjs';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'node_modules/.bin/tree-sitter');
const wasm = resolve(root, 'assets/tree-sitter-promela.wasm');
if (!existsSync(resolve(root, 'grammar/src/parser.c'))) {
  throw new Error('Missing generated parser. Run npm run generate first.');
}
mkdirSync(resolve(root, 'assets'), { recursive: true });
execFileSync(cli, ['build', '--wasm', '--output', wasm], {
  cwd: resolve(root, 'grammar'),
  stdio: 'inherit',
});
if (!existsSync(wasm)) throw new Error('WASM build returned without producing ' + wasm);
writeFileSync(
  resolve(root, 'assets/tree-sitter-promela.build.sha256'),
  artifactSignature(root) + '\n',
);
console.log(`Built ${wasm}`);
