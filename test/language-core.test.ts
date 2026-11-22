import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageCore, LanguageCoreError } from '../src/language-core.js';
import { SourceText } from '../src/source-text.js';

function expectsCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof LanguageCoreError && error.code === code;
}

test('source positions are zero-based UTF-16 with CRLF and end-exclusive ranges', () => {
  const content = new SourceText('x🐱y\r\n\r\nz\n');
  assert.equal(content.offsetAt({ line: 0, character: 1 }), 1);
  assert.equal(content.offsetAt({ line: 0, character: 3 }), 3);
  assert.equal(content.offsetAt({ line: 0, character: 4 }), 4);
  assert.equal(content.offsetAt({ line: 1, character: 0 }), 6);
  assert.deepEqual(content.positionAt(4), { line: 0, character: 4 });
  assert.deepEqual(content.positionAt(5), { line: 0, character: 4 });
  assert.deepEqual(content.positionAt(6), { line: 1, character: 0 });
  assert.deepEqual(content.positionAt(8), { line: 2, character: 0 });
  assert.deepEqual(content.range(8, 9), {
    start: { line: 2, character: 0 },
    end: { line: 2, character: 1 },
  });
  assert.equal(content.offsetAt({ line: 0, character: 5 }), undefined);
  assert.equal(content.offsetAt({ line: 99, character: 0 }), undefined);
  assert.throws(() => content.positionAt(999), RangeError);
});

test('initialization is repeatable; missing WASM is a controlled failure', async () => {
  const missing = createLanguageCore({ projectRoot: '/missing-promela-language-core-assets' });
  await assert.rejects(missing.initialize(), /No language WASM/);
  missing.dispose();

  const core = createLanguageCore();
  try {
    await Promise.all([core.initialize(), core.initialize(), core.initialize()]);
    const snapshot = await core.openDocument({
      uri: 'file:///one.pml',
      version: 1,
      text: 'byte count;',
    });
    assert.deepEqual(snapshot, {
      uri: 'file:///one.pml',
      version: 1,
      hasSyntaxErrors: false,
    });
  } finally {
    core.dispose();
    core.dispose();
  }
  await assert.rejects(core.initialize(), expectsCode('DISPOSED'));
});

test('unsaved updates supersede previous snapshots, while stale and duplicate versions fail', async () => {
  const core = createLanguageCore();
  const uri = 'untitled:unsaved.pml';
  try {
    await core.initialize();
    await core.openDocument({ uri, version: 1, text: 'byte old; init { old = 1; }' });
    await assert.rejects(
      core.openDocument({ uri, version: 1, text: 'byte duplicate;' }),
      expectsCode('DOCUMENT_ALREADY_OPEN'),
    );
    const next = await core.updateDocument({
      uri,
      version: 2,
      text: 'byte fresh; init { fresh = 1; }',
    });
    assert.equal(next.version, 2);
    await assert.rejects(
      core.updateDocument({ uri, version: 1, text: 'byte obsolete;' }),
      expectsCode('STALE_DOCUMENT_VERSION'),
    );
    await assert.rejects(
      core.updateDocument({ uri, version: 2, text: 'byte conflicting;' }),
      expectsCode('STALE_DOCUMENT_VERSION'),
    );
    const definition = await core.getDefinition(uri, { line: 0, character: 19 });
    assert.equal(definition.version, 2);
    assert.equal(definition.status, 'resolved');
    assert.equal(definition.locations[0]?.range.start.character, 5);
    const symbols = await core.getDocumentSymbols(uri);
    assert.ok(symbols.some((s) => s.name === 'fresh' && s.version === 2));
    assert.ok(!symbols.some((s) => s.name === 'old'));
    core.closeDocument(uri);
    core.closeDocument(uri);
    await assert.rejects(core.getDocumentSymbols(uri), expectsCode('DOCUMENT_NOT_OPEN'));
  } finally {
    core.dispose();
  }
});

test('multiple same-named documents do not mix symbols or navigation targets', async () => {
  const core = createLanguageCore();
  const source = 'byte shared; init { shared = 1; }';
  try {
    const uris = ['file:///first.pml', 'file:///second.pml'];
    for (const uri of uris) await core.openDocument({ uri, version: 1, text: source });
    for (const uri of uris) {
      const resolved = await core.getDefinition(uri, {
        line: 0,
        character: source.lastIndexOf('shared'),
      });
      assert.equal(resolved.status, 'resolved');
      assert.equal(resolved.locations[0]?.uri, uri);
    }
    const first = await core.getDocumentSymbols(uris[0]!);
    const second = await core.getDocumentSymbols(uris[1]!);
    assert.notEqual(
      first.find((s) => s.name === 'shared')?.id,
      second.find((s) => s.name === 'shared')?.id,
    );
  } finally {
    core.dispose();
  }
});

test('F12 returns correct declaration for process calls, local shadowing, and globals', async () => {
  const core = createLanguageCore();
  const uri = 'file:///scope.pml';
  const source = [
    'byte counter;',
    'proctype Worker() {',
    '  byte counter;',
    '  counter = 1;',
    '}',
    'init {',
    '  counter = 2;',
    '  run Worker();',
    '}',
  ].join('\n');
  try {
    await core.openDocument({ uri, version: 3, text: source });
    const local = await core.getDefinition(uri, { line: 3, character: 4 });
    const global = await core.getDefinition(uri, { line: 6, character: 4 });
    const process = await core.getDefinition(uri, { line: 7, character: 7 });
    assert.equal(local.status, 'resolved');
    assert.equal(global.status, 'resolved');
    assert.equal(process.status, 'resolved');
    assert.deepEqual(local.locations[0]?.range.start, { line: 2, character: 7 });
    assert.deepEqual(global.locations[0]?.range.start, { line: 0, character: 5 });
    assert.deepEqual(process.locations[0]?.range.start, { line: 1, character: 9 });
    const symbols = await core.getDocumentSymbols(uri);
    const scopes = symbols.filter((s) => s.name === 'counter');
    assert.equal(scopes.length, 2);
    assert.notEqual(scopes[0]?.id, scopes[1]?.id);
    const proc = symbols.find((s) => s.name === 'Worker');
    assert.equal(proc?.kind, 'process');
    assert.equal(scopes[1]?.containerId, proc?.id);
    assert.equal((await core.getDefinition(uri, { line: 7, character: 1 })).status, 'unresolved');
    assert.equal((await core.getDefinition(uri, { line: 0, character: 12 })).status, 'unresolved');
  } finally {
    core.dispose();
  }
});

test('UTF-16 locations remain exact after emoji, LF/CRLF, and edited text', async () => {
  const core = createLanguageCore();
  const uri = 'file:///unicode.pml';
  try {
    for (const [version, newline] of [
      [1, '\n'],
      [2, '\r\n'],
    ] as const) {
      const source = [`/* 🐱 */ byte count;`, `init { count = 1; }`].join(newline);
      const input = { uri, version, text: source };
      if (version === 1) await core.openDocument(input);
      else await core.updateDocument(input);
      const reference = await core.getDefinition(uri, { line: 1, character: 8 });
      assert.equal(reference.status, 'resolved');
      assert.equal(reference.version, version);
      assert.deepEqual(reference.locations[0]?.range, {
        start: { line: 0, character: '/* 🐱 */ byte '.length },
        end: { line: 0, character: '/* 🐱 */ byte count'.length },
      });
    }
  } finally {
    core.dispose();
  }
});

test('syntax errors are reported in snapshots and valid recovered declarations remain usable', async () => {
  const core = createLanguageCore();
  const uri = 'file:///error.pml';
  try {
    const snapshot = await core.openDocument({
      uri,
      version: 1,
      text: 'int before;\n$\nint after;\ninit { after = 1; }',
    });
    assert.equal(snapshot.hasSyntaxErrors, true);
    const recovered = await core.getDefinition(uri, { line: 3, character: 8 });
    assert.equal(recovered.status, 'resolved');
    assert.deepEqual(recovered.locations[0]?.range.start, { line: 2, character: 4 });
    const symbols = await core.getDocumentSymbols(uri);
    assert.ok(symbols.some((s) => s.name === 'before'));
    assert.ok(symbols.some((s) => s.name === 'after'));
  } finally {
    core.dispose();
  }
});

test('unknown references return unresolved, not invented locations', async () => {
  const core = createLanguageCore();
  const uri = 'file:///missing.pml';
  try {
    await core.openDocument({ uri, version: 1, text: 'init { run Missing(); }' });
    const result = await core.getDefinition(uri, { line: 0, character: 12 });
    assert.equal(result.status, 'unresolved');
    assert.deepEqual(result.locations, []);
    const invalidPosition = await core.getDefinition(uri, { line: 7, character: 999 });
    assert.equal(invalidPosition.status, 'unresolved');
  } finally {
    core.dispose();
  }
});
