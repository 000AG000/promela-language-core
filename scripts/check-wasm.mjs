import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { artifactSignature } from './artifact-signature.mjs';

const root = resolve(import.meta.dirname, '..');
const stamp = resolve(root, 'assets/tree-sitter-promela.build.sha256');
try {
  const expected = readFileSync(stamp, 'utf8').trim();
  const actual = artifactSignature(root);
  if (expected !== actual)
    throw new Error('Build fingerprint differs from grammar and WASM inputs');
  console.log('WASM artifact fingerprint matches current grammar and generated parser.');
} catch (error) {
  console.error(`WASM artifact is missing or stale: ${error.message}`);
  console.error('Run "npm run build:wasm" and fix any generation errors before parsing.');
  process.exitCode = 1;
}
