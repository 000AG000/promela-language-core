/**
 * Rejection and error-recovery contracts for the SAME compiled WASM grammar
 * used by the positive tests. These are malformed ProMeLa examples, not valid
 * SPIN constructs missing from our grammar. Keep known gaps separate.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Edit } from 'web-tree-sitter';
import { createPromelaParser } from '../src/parser.js';
import { assertSyntax } from './support/syntax-assertions.js';

type InvalidFixture = { name: string; source: string; reason: string };
type NamedFixture = { name: string };
const fixture = (name: string) => JSON.parse(
  readFileSync(resolve(process.cwd(), 'fixtures', name), 'utf8'),
) as NamedFixture[];
const invalid = JSON.parse(
  readFileSync(resolve(process.cwd(), 'fixtures/invalid-cases.json'), 'utf8'),
) as InvalidFixture[];

const runtimePromise = createPromelaParser();
after(async () => (await runtimePromise).close());

test('invalid fixtures are unique, explained, and do not overlap supported or known-gap cases', () => {
  assert.ok(invalid.length >= 5, 'Keep multiple independent rejection cases');
  const names = invalid.map(item => item.name);
  assert.equal(new Set(names).size, names.length, 'Duplicate invalid test names');
  const supported = new Set(fixture('audit-cases.json').map(item => item.name));
  const gaps = new Set(fixture('known-gaps.json').map(item => item.name));
  for (const item of invalid) {
    assert.ok(item.name.trim(), 'Invalid test name is empty');
    assert.ok(item.source.trim(), `${item.name}: empty input is valid in this grammar`);
    assert.ok(item.reason.trim(), `${item.name}: explain why the syntax is invalid`);
    assert.ok(!supported.has(item.name), `${item.name}: overlaps supported-case catalogue`);
    assert.ok(!gaps.has(item.name), `${item.name}: grammar gap is not invalid SPIN syntax`);
  }
});

for (const item of invalid) {
  test(`rejects malformed syntax: ${item.name}`, async () => {
    const runtime = await runtimePromise;
    const tree = runtime.parse(item.source);
    try {
      assertSyntax(tree.rootNode, 'invalid', item.name);
    } finally {
      tree.delete();
    }
  });
}

test('test harness rejects inverted validity expectations (anti-vacuity guard)', async () => {
  const runtime = await runtimePromise;
  const valid = runtime.parse('int count; init { count = 1; }');
  const malformed = runtime.parse('init { goto ; }');
  try {
    assertSyntax(valid.rootNode, 'valid', 'valid-control');
    assertSyntax(malformed.rootNode, 'invalid', 'invalid-control');
    assert.throws(() => assertSyntax(valid.rootNode, 'invalid', 'inverted-valid'),
      /malformed source was accepted/);
    assert.throws(() => assertSyntax(malformed.rootNode, 'valid', 'inverted-invalid'),
      /unexpected syntax error|expected program root/);
  } finally {
    valid.delete();
    malformed.delete();
  }
});

test('reports an unexpected top-level token without losing earlier declarations', async () => {
  const runtime = await runtimePromise;
  const source = 'int before;\n$\nint after;';
  const tree = runtime.parse(source);
  const independentSuffix = runtime.parse('int after;');
  try {
    // The suffix is valid by itself; failure to recover it in the original
    // source is a known grammar-recovery limitation, not invalid ProMeLa.
    assertSyntax(independentSuffix.rootNode, 'valid', 'later declaration in isolation');
    assertSyntax(tree.rootNode, 'invalid', 'unexpected top-level token');
    const names = tree.rootNode.descendantsOfType('one_decl').map(node => node.text);
    assert.ok(names.some(text => text.includes('before')),
      `Unexpected token destroyed preceding declaration: ${tree.rootNode}`);
  } finally {
    tree.delete();
    independentSuffix.delete();
  }
});

// Pending grammar improvement: in v0.3.5 an unexpected '$' between two
// top-level declarations consumes the later declaration during recovery.
// Keep this visible; do not quietly classify the later declaration as invalid.
test.todo('known grammar gap: retain later declarations after illegal top-level token');

test('incremental reparse repairs an invalid token and clears syntax errors', async () => {
  const runtime = await runtimePromise;
  const broken = 'init { goto @; end: skip; }';
  const repaired = 'init { goto e; end: skip; }';
  const index = broken.indexOf('@');
  const oldTree = runtime.parse(broken);
  try {
    assertSyntax(oldTree.rootNode, 'invalid', 'before token repair');
    oldTree.edit(new Edit({
      startIndex: index,
      oldEndIndex: index + 1,
      newEndIndex: index + 1,
      startPosition: { row: 0, column: index },
      oldEndPosition: { row: 0, column: index + 1 },
      newEndPosition: { row: 0, column: index + 1 },
    }));
    const newTree = runtime.parser.parse(repaired, oldTree);
    assert.ok(newTree, 'Incremental parse returned null');
    const freshTree = runtime.parse(repaired);
    try {
      assertSyntax(newTree.rootNode, 'valid', 'after incremental token repair');
      assertSyntax(freshTree.rootNode, 'valid', 'fresh parse of repaired source');
      // Incremental reuse should not alter the visible tree. This is stronger
      // than guessing how many labeled_step nodes a GLR grammar may expose.
      assert.equal(newTree.rootNode.toString(), freshTree.rootNode.toString(),
        `Incremental AST differs from fresh parse:\nincremental: ${newTree.rootNode}\nfresh: ${freshTree.rootNode}`);
      const labels = newTree.rootNode.descendantsOfType('labeled_step');
      assert.ok(labels.some(node => node.childForFieldName('name')?.text === 'end'),
        `Repaired label was not recognized: ${newTree.rootNode}`);
      assert.ok(newTree.rootNode.descendantsOfType('goto').some(node => node.text.includes('goto e')),
        `Repaired goto was not recognized: ${newTree.rootNode}`);
    } finally {
      freshTree.delete();
      newTree.delete();
    }
  } finally {
    oldTree.delete();
  }
});
