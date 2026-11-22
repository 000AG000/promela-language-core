/** Separate installed-consumer smoke test for the v0.4 public document API. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const stage = resolve(root, 'release/promela-language-core');
const manifest = JSON.parse(readFileSync(resolve(stage, 'package.json'), 'utf8'));
if (manifest.name !== 'promela-language-core') throw new Error('Unexpected staged package name');
for (const file of [
  'dist/src/language-core.js',
  'dist/src/language-core.d.ts',
  'dist/src/source-text.js',
  'dist/src/source-text.d.ts',
  'dist/src/semantic-index.js',
  'dist/src/semantic-index.d.ts',
  'assets/tree-sitter-promela.wasm',
]) {
  if (!existsSync(resolve(stage, file))) throw new Error(`Missing v0.4 package module: ${file}`);
}
const tmp = mkdtempSync(join(tmpdir(), 'promela-p0-consumer-'));
try {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', tmp, stage], {
      cwd: root,
      encoding: 'utf8',
    }),
  );
  const tarball = join(tmp, packed[0]?.filename ?? 'missing.tgz');
  if (!existsSync(tarball)) throw new Error(`Missing npm pack tarball: ${tarball}`);
  const consumer = join(tmp, 'consumer');
  execFileSync(
    'npm',
    ['install', '--prefix', consumer, '--no-audit', '--no-fund', '--ignore-scripts', tarball],
    { cwd: root, stdio: 'inherit' },
  );
  writeFileSync(
    join(consumer, 'test-core.mjs'),
    `import assert from 'node:assert/strict';
import {createLanguageCore} from 'promela-language-core';
const core = createLanguageCore();
try {
  await core.initialize();
  const uri = 'file:///consumer.pml';
  const text = 'byte count; init { count = 1; }';
  const first = await core.openDocument({uri, version: 1, text});
  assert.equal(first.hasSyntaxErrors, false);
  const result = await core.getDefinition(uri, {line:0, character:text.lastIndexOf('count')});
  assert.equal(result.status, 'resolved');
  assert.equal(result.version, 1);
  assert.equal(result.locations[0].uri, uri);
  assert.equal(result.locations[0].range.start.character, 5);
  assert.ok((await core.getDocumentSymbols(uri)).some(s=>s.name==='count'));
  const tokens = await core.getSemanticTokens(uri);
  assert.equal(tokens.version, 1);
  assert.equal(tokens.tokens.length, 2);
  assert.equal(tokens.tokens[0].type, 'variable');
  assert.equal(tokens.tokens[0].declaration, true);
  assert.equal(tokens.tokens[1].declaration, false);
  const refs = await core.findReferences(uri, {line:0, character:text.lastIndexOf('count')}, true);
  assert.equal(refs.locations.length, 2);
  const edited = 'byte newer; init { newer = 1; }';
  await core.updateDocument({uri, version: 2, text: edited});
  const after = await core.getDefinition(uri, {line:0, character:edited.lastIndexOf('newer')});
  assert.equal(after.status, 'resolved');
  assert.equal(after.version, 2);
  assert.equal(after.locations[0].range.start.character, 5);
  const newTokens = await core.getSemanticTokens(uri);
  assert.equal(newTokens.version, 2);
  assert.equal(newTokens.tokens.length, 2);
  const newRefs = await core.findReferences(uri, {line:0, character:edited.lastIndexOf('newer')}, false);
  assert.equal(newRefs.version, 2);
  assert.equal(newRefs.locations.length, 1);
  core.closeDocument(uri);
} finally { core.dispose(); }
console.log('Independent consumer: v0.5 semantic tokens + references + packaged WASM OK');
`,
  );
  execFileSync(process.execPath, [join(consumer, 'test-core.mjs')], {
    cwd: consumer,
    stdio: 'inherit',
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
