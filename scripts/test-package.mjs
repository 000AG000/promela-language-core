// Real consumer smoke test: install the staged tarball into an isolated temp
// project, import by package NAME, load the packaged WASM, and resolve a symbol.
// This must never run npm publish or modify a user's VS Code extension.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const stage = resolve(root, 'release/promela-language-core');
if (!existsSync(resolve(stage, 'package.json'))) {
  throw new Error('Missing release package. Run npm run stage:core first.');
}
const manifest = JSON.parse(readFileSync(resolve(stage, 'package.json'), 'utf8'));
if (manifest.name !== 'promela-language-core') throw new Error('Unexpected release package name');
for (const file of [
  'assets/tree-sitter-promela.wasm',
  'dist/src/index.js',
  'dist/src/index.d.ts',
  'LICENSE',
  'THIRD_PARTY_LICENSES/siraben-tree-sitter-promela-MIT.txt',
  'THIRD_PARTY_LICENSES/web-tree-sitter-MIT.txt',
]) {
  if (!existsSync(resolve(stage, file))) throw new Error(`Missing release file: ${file}`);
}
for (const unexpected of ['dist/src/audit.js', 'dist/src/cli.js']) {
  if (existsSync(resolve(stage, unexpected)))
    throw new Error(`Development module leaked: ${unexpected}`);
}
const tmp = mkdtempSync(join(tmpdir(), 'promela-core-consumer-'));
try {
  const json = execFileSync('npm', ['pack', '--json', '--pack-destination', tmp, stage], {
    cwd: root,
    encoding: 'utf8',
  });
  const packed = JSON.parse(json);
  const tarball = join(tmp, packed[0]?.filename ?? 'missing.tgz');
  if (!existsSync(tarball)) throw new Error(`Tarball was not created: ${tarball}`);
  const consumer = join(tmp, 'consumer');
  // npm creates consumer; dependency install is ordinary local-package testing,
  // not a registry publication. The npm registry may be used for web-tree-sitter.
  execFileSync(
    'npm',
    ['install', '--prefix', consumer, '--no-audit', '--no-fund', '--ignore-scripts', tarball],
    { cwd: root, stdio: 'inherit' },
  );
  writeFileSync(
    join(consumer, 'smoke.mjs'),
    `
import assert from 'node:assert/strict';
import { createPromelaParser, definitionAt, indexDefinitions } from 'promela-language-core';
const runtime = await createPromelaParser();
try {
  const source = 'byte counter; init { counter = 1; }';
  const tree = runtime.parse(source);
  try {
    assert.equal(tree.rootNode.type, 'program');
    assert.equal(tree.rootNode.hasError, false);
    assert.ok(indexDefinitions(tree).some(x => x.name === 'counter' && x.kind === 'variable'));
    const ref = definitionAt(tree, 0, source.lastIndexOf('counter'));
    assert.equal(ref?.name, 'counter');
  } finally { tree.delete(); }
} finally { runtime.close(); }
console.log('Independent consumer: packaged JS + WASM + navigation OK');
`,
  );
  execFileSync(process.execPath, [join(consumer, 'smoke.mjs')], {
    cwd: consumer,
    stdio: 'inherit',
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
