/**
 * Table-driven grammar contract tests. These cases are positive SPIN syntax
 * examples already exercised by the v0.3.1 feature audit. Known grammar gaps
 * are deliberately excluded and remain visible in `npm run audit`.
 *
 * A successful parse is necessary but not sufficient: each case also asserts
 * the presence of an AST node required by downstream language services.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPromelaParser } from '../src/parser.js';
import { assertSyntax } from './support/syntax-assertions.js';

type AuditCase = { name: string; source: string; expectedValid: boolean };
type Gap = { name: string; source: string; reason: string };
const root = process.cwd();
const allCases = JSON.parse(
  readFileSync(resolve(root, 'fixtures/audit-cases.json'), 'utf8'),
) as AuditCase[];
const gaps = JSON.parse(readFileSync(resolve(root, 'fixtures/known-gaps.json'), 'utf8')) as Gap[];
const knownGaps = new Set(gaps.map((gap) => gap.name));
const expectedNodes: Record<string, string> = {
  'global-variable': 'one_decl',
  'proctype-with-argument': 'proc',
  channels: 'ch_init',
  'ltl-property': 'ltl',
  'user-defined-type': 'utype',
  'goto-label': 'labeled_step',
  'inline-definition': 'inline_definition',
  preprocessor: 'preprocessor_directive',
  unsigned: 'unsigned_decl',
  'guarded-option-assignment': 'option',
  'ltl-temporal-implication': 'ltl_expr',
  'labeled-statement-and-goto': 'labeled_step',
  'unsigned-initializer': 'unsigned_item',
  'preprocessor-conditional': 'preprocessor_directive',
};

const runtimePromise = createPromelaParser();
after(async () => (await runtimePromise).close());

const positive = allCases.filter((entry) => entry.expectedValid && !knownGaps.has(entry.name));
test('conformance fixtures are unique and every supported case has an AST contract', () => {
  assert.equal(new Set(allCases.map((entry) => entry.name)).size, allCases.length);
  for (const entry of positive)
    assert.ok(expectedNodes[entry.name], `Missing AST contract: ${entry.name}`);
  for (const gap of gaps) assert.ok(gap.reason, `Undocumented grammar gap: ${gap.name}`);
});

for (const entry of positive) {
  test(`conformance: ${entry.name}`, async () => {
    const runtime = await runtimePromise;
    const tree = runtime.parse(entry.source);
    try {
      assertSyntax(tree.rootNode, 'valid', entry.name);
      const required = expectedNodes[entry.name]!;
      assert.ok(
        tree.rootNode.descendantsOfType(required).length > 0,
        `Expected ${required} in AST: ${tree.rootNode.toString()}`,
      );
    } finally {
      tree.delete();
    }
  });
}
