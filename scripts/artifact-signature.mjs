import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Detect stale language WASM (or a stale generated C parser). This is more
// reliable than timestamps and prevents tests from accidentally using a
// previously built grammar after `tree-sitter generate` fails.
const inputs = [
  'grammar/grammar.js',
  'grammar/package.json',
  'grammar/src/parser.c',
  'assets/tree-sitter-promela.wasm',
];

export function artifactSignature(root) {
  const hash = createHash('sha256');
  for (const path of inputs) {
    hash.update(path + '\0');
    hash.update(readFileSync(resolve(root, path)));
    hash.update('\0');
  }
  return hash.digest('hex');
}
