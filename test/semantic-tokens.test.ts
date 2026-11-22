import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createLanguageCore,
  type SemanticTokenInfo,
  type LanguageCore,
} from '../src/language-core.js';
import { SourceText } from '../src/source-text.js';

const fixture = (name: string) => readFileSync(resolve(process.cwd(), 'fixtures', name), 'utf8');

async function withDocument(
  text: string,
  verify: (core: LanguageCore, uri: string) => Promise<void>,
): Promise<void> {
  const core = createLanguageCore();
  const uri = 'file:///tokens.pml';
  try {
    const snapshot = await core.openDocument({ uri, version: 1, text });
    assert.equal(snapshot.hasSyntaxErrors, false, 'fixture must be supported ProMeLa');
    await verify(core, uri);
  } finally {
    core.dispose();
  }
}

function tokenAt(
  tokens: SemanticTokenInfo[],
  line: number,
  character: number,
): SemanticTokenInfo | undefined {
  return tokens.find(
    (token) => token.range.start.line === line && token.range.start.character === character,
  );
}

function assertSortedAndDisjoint(tokens: SemanticTokenInfo[], text: string): void {
  const coordinates = new SourceText(text);
  let previousEnd = 0;
  for (const token of tokens) {
    const start = coordinates.offsetAt(token.range.start);
    const end = coordinates.offsetAt(token.range.end);
    assert.notEqual(start, undefined);
    assert.notEqual(end, undefined);
    assert.ok(start! >= previousEnd, `Overlapping or out-of-order token at ${start}`);
    assert.ok(end! > start!, `Empty semantic token at ${start}`);
    previousEnd = end!;
  }
}

test('batch tokens include process/variable declarations and their resolved references', async () => {
  const text = [
    'proctype Worker() {',
    '    int counter = 0;',
    '    counter++;',
    '}',
    'init {',
    '    run Worker();',
    '}',
  ].join('\n');
  await withDocument(text, async (core, uri) => {
    const result = await core.getSemanticTokens(uri);
    assert.equal(result.uri, uri);
    assert.equal(result.version, 1);
    assertSortedAndDisjoint(result.tokens, text);
    assert.equal(result.tokens.length, 4);
    for (const [line, column, kind, declaration] of [
      [0, 9, 'process', true],
      [1, 8, 'variable', true],
      [2, 4, 'variable', false],
      [5, 8, 'process', false],
    ] as const) {
      const token = tokenAt(result.tokens, line, column);
      assert.equal(token?.type, kind);
      assert.equal(token?.declaration, declaration);
    }
  });
});

test('shared index tracks shadowed declarations and Find References by identity', async () => {
  const text = [
    'int counter = 0;',
    'proctype Worker() {',
    '    int counter = 1;',
    '    counter++;',
    '}',
    'init {',
    '    counter++;',
    '}',
  ].join('\n');
  await withDocument(text, async (core, uri) => {
    const first = await core.getSemanticTokens(uri);
    const second = await core.getSemanticTokens(uri);
    assert.deepEqual(second, first);
    assert.equal(first.tokens.filter((token) => token.type === 'variable').length, 4);
    const local = await core.findReferences(uri, { line: 3, character: 5 }, false);
    const global = await core.findReferences(uri, { line: 6, character: 5 }, false);
    assert.deepEqual(
      local.locations.map((location) => location.range.start.line),
      [3],
    );
    assert.deepEqual(
      global.locations.map((location) => location.range.start.line),
      [6],
    );
    const localDeclaration = await core.findReferences(uri, { line: 2, character: 9 }, true);
    assert.deepEqual(
      localDeclaration.locations.map((location) => location.range.start.line),
      [2, 3],
    );
    const globalDeclaration = await core.findReferences(uri, { line: 0, character: 5 }, true);
    assert.deepEqual(
      globalDeclaration.locations.map((location) => location.range.start.line),
      [0, 6],
    );
    const localDef = await core.getDefinition(uri, { line: 3, character: 5 });
    const globalDef = await core.getDefinition(uri, { line: 6, character: 5 });
    assert.equal(localDef.locations[0]?.range.start.line, 2);
    assert.equal(globalDef.locations[0]?.range.start.line, 0);
    const missing = await core.findReferences(uri, { line: 1, character: 0 }, false);
    assert.deepEqual(missing.locations, []);
    const proc = (await core.getDocumentSymbols(uri)).find((symbol) => symbol.name === 'Worker');
    assert.deepEqual(proc?.selectionRange?.start, { line: 1, character: 9 });
    assert.deepEqual(proc?.fullRange?.start, { line: 1, character: 0 });
    assert.equal(proc?.fullRange?.end.line, 4);
  });
});

test('semantic tokens cover typedef fields, parameters, processes and mtype constants', async () => {
  const text = fixture('supported-definitions.pml');
  await withDocument(text, async (core, uri) => {
    const tokens = (await core.getSemanticTokens(uri)).tokens;
    assertSortedAndDisjoint(tokens, text);
    for (const [kind, requiredDeclarations, requiredReferences] of [
      ['typedef', 1, 1],
      ['field', 1, 1],
      ['parameter', 1, 1],
      ['mtype', 2, 1],
      ['process', 1, 1],
    ] as const) {
      assert.ok(
        tokens.filter((token) => token.type === kind && token.declaration).length >=
          requiredDeclarations,
        `${kind} declarations missing`,
      );
      assert.ok(
        tokens.filter((token) => token.type === kind && !token.declaration).length >=
          requiredReferences,
        `${kind} references missing`,
      );
    }
  });
});

test('semantic tokens cover inline definitions, labels, ltl names and macros', async () => {
  const sources = [
    [fixture('inline.pml'), 'inline', true],
    [fixture('definitions.pml'), 'label', true],
    [fixture('ltl-implication.pml'), 'ltl', false],
    ['#define LIMIT 3\nbyte count; init { count = LIMIT; }', 'macro', true],
  ] as const;
  for (const [text, kind, expectReference] of sources) {
    await withDocument(text, async (core, uri) => {
      const tokens = (await core.getSemanticTokens(uri)).tokens;
      assertSortedAndDisjoint(tokens, text);
      assert.ok(
        tokens.some((token) => token.type === kind && token.declaration),
        `${kind} declaration`,
      );
      if (expectReference) {
        assert.ok(
          tokens.some((token) => token.type === kind && !token.declaration),
          `${kind} reference`,
        );
      }
    });
  }
});

test('comments and string literals do not create false semantic tokens', async () => {
  const text = 'byte count; /* count */ init { printf("count"); count = 1; }';
  await withDocument(text, async (core, uri) => {
    const result = await core.getSemanticTokens(uri);
    assertSortedAndDisjoint(result.tokens, text);
    const positions = result.tokens.map((token) => token.range.start.character);
    assert.deepEqual(positions, [5, text.lastIndexOf('count')]);
  });
});

test('UTF-16, CRLF and document versions are preserved after unsaved edits', async () => {
  const core = createLanguageCore();
  const uri = 'untitled:semantic-tokens.pml';
  try {
    const text = '/* 🐱 */ byte old;\r\ninit { old = 1; }';
    await core.openDocument({ uri, version: 7, text });
    const initial = await core.getSemanticTokens(uri);
    assert.equal(initial.version, 7);
    assert.deepEqual(initial.tokens[0]?.range.start, {
      line: 0,
      character: '/* 🐱 */ byte '.length,
    });
    const edited = '/* 🐱 */ byte fresh;\ninit { fresh = 1; }';
    await core.updateDocument({ uri, version: 8, text: edited });
    const updated = await core.getSemanticTokens(uri);
    assert.equal(updated.version, 8);
    assert.equal(updated.tokens.length, 2);
    assert.deepEqual(updated.tokens[0]?.range.start, {
      line: 0,
      character: '/* 🐱 */ byte '.length,
    });
    assert.equal((await core.findReferences(uri, { line: 1, character: 8 }, true)).version, 8);
    assert.equal((await core.getDefinition(uri, { line: 1, character: 8 })).status, 'resolved');
    assert.ok(!(await core.getDocumentSymbols(uri)).some((symbol) => symbol.name === 'old'));
    const otherUri = 'file:///different-model.pml';
    await core.openDocument({ uri: otherUri, version: 1, text: 'byte fresh; init { fresh = 1; }' });
    assert.deepEqual(
      (await core.findReferences(otherUri, { line: 0, character: 5 }, true)).locations.map(
        (location) => location.uri,
      ),
      [otherUri, otherUri],
    );
    core.closeDocument(uri);
    await assert.rejects(core.getSemanticTokens(uri), { code: 'DOCUMENT_NOT_OPEN' });
    await assert.rejects(core.findReferences(uri, { line: 0, character: 0 }, true), {
      code: 'DOCUMENT_NOT_OPEN',
    });
    assert.equal((await core.getSemanticTokens(otherUri)).version, 1);
  } finally {
    core.dispose();
  }
});

test('unresolved names cannot become fabricated tokens or unrelated references', async () => {
  const text = 'init { run Missing(); }';
  await withDocument(text, async (core, uri) => {
    const semantic = await core.getSemanticTokens(uri);
    assert.equal(semantic.tokens.length, 0);
    assert.deepEqual(
      (await core.findReferences(uri, { line: 0, character: 12 }, true)).locations,
      [],
    );
    assert.equal((await core.getDefinition(uri, { line: 0, character: 12 })).status, 'unresolved');
  });
});

test('2,000 resolved references are returned without a candidate cap', async () => {
  const lines = Array.from({ length: 1_000 }, () => '  counter = counter + 1;');
  const text = ['int counter;', 'init {', ...lines, '}'].join('\n');
  await withDocument(text, async (core, uri) => {
    const tokens = await core.getSemanticTokens(uri);
    assert.equal(tokens.tokens.length, 2_001);
    assert.equal(tokens.tokens.filter((token) => token.declaration).length, 1);
    assert.equal(tokens.tokens.filter((token) => !token.declaration).length, 2_000);
    assertSortedAndDisjoint(tokens.tokens, text);
    const refs = await core.findReferences(uri, { line: 0, character: 4 }, false);
    assert.equal(refs.locations.length, 2_000);
    const full = await core.findReferences(uri, { line: 0, character: 4 }, true);
    assert.equal(full.locations.length, 2_001);
    const later = await core.getDefinition(uri, { line: 999, character: 3 });
    assert.equal(later.status, 'resolved');
    assert.deepEqual(later.locations[0]?.range.start, { line: 0, character: 4 });
  });
});

test('ambiguous bindings are not represented as resolved semantic reference tokens', async () => {
  const text = 'byte duplicate; byte duplicate; init { duplicate = 1; }';
  await withDocument(text, async (core, uri) => {
    const tokens = await core.getSemanticTokens(uri);
    assert.equal(
      tokens.tokens.filter((token) => token.declaration && token.type === 'variable').length,
      2,
    );
    assert.equal(tokens.tokens.filter((token) => !token.declaration).length, 0);
    const index = text.lastIndexOf('duplicate');
    const definition = await core.getDefinition(uri, { line: 0, character: index });
    assert.equal(definition.status, 'ambiguous');
    assert.equal(definition.locations.length, 2);
    const references = await core.findReferences(uri, { line: 0, character: index }, true);
    assert.deepEqual(references.locations, []);
  });
});
