/**
 * Lightweight, genuine-provider integration test. No downloaded VS Code.
 * Uses the actual installed ProMeLa core and a minimal VS Code API shim.
 * Tests the same provider implementation registered by extension.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageCore } from 'promela-language-core';
import { registerLanguageFeatures } from '../dist/providers.js';

class Position {
  constructor(line, character) { this.line = line; this.character = character; }
}
class Range {
  constructor(startLine, startCharacter, endLine, endCharacter) {
    this.start = new Position(startLine, startCharacter);
    this.end = new Position(endLine, endCharacter);
  }
  union(other) {
    const first = (this.start.line < other.start.line ||
      (this.start.line === other.start.line && this.start.character <= other.start.character)) ? this.start : other.start;
    const last = (this.end.line > other.end.line ||
      (this.end.line === other.end.line && this.end.character >= other.end.character)) ? this.end : other.end;
    return new Range(first.line, first.character, last.line, last.character);
  }
}
class Location {
  constructor(uri, rangeOrPosition) {
    this.uri = uri;
    this.range = rangeOrPosition instanceof Range
      ? rangeOrPosition
      : new Range(rangeOrPosition.line, rangeOrPosition.character, rangeOrPosition.line, rangeOrPosition.character);
  }
}
class DocumentSymbol {
  constructor(name, detail, kind, range, selectionRange) {
    Object.assign(this, { name, detail, kind, range, selectionRange, children: [] });
  }
}
class Disposable {
  constructor(dispose) { this.cleanup = dispose; }
  dispose() { this.cleanup?.(); this.cleanup = undefined; }
}

function mockVSCode() {
  const providers = {};
  const closeListeners = new Set();
  const api = {
    Position, Range, Location, DocumentSymbol, Disposable,
    SymbolKind: { Function: 11, Struct: 22, Field: 8, Variable: 12, Constant: 13, Namespace: 2 },
    Uri: {
      parse: (text) => ({ scheme: text.split(':')[0], toString: () => text }),
      joinPath: (uri, ...parts) => ({ scheme: uri.scheme, toString: () => parts.join('/') }),
    },
    workspace: {
      fs: { stat: async () => { throw new Error('No such file'); } },
      onDidCloseTextDocument(listener) {
        closeListeners.add(listener);
        return new Disposable(() => closeListeners.delete(listener));
      },
    },
    languages: {
      registerDefinitionProvider(_selector, provider) {
        providers.definition = provider;
        return new Disposable(() => { delete providers.definition; });
      },
      registerDocumentSymbolProvider(_selector, provider) {
        providers.symbols = provider;
        return new Disposable(() => { delete providers.symbols; });
      },
    },
  };
  return { api, providers, close: (document) => { for (const listener of closeListeners) listener(document); } };
}

function document(text, version = 1, url = 'untitled:sample.pml') {
  return {
    uri: { scheme: url.split(':')[0], toString: () => url },
    languageId: 'promela', version, text,
    getText() { return this.text; },
    lineAt(line) { return { text: this.text.split(/\r\n|\r|\n/)[line] }; },
  };
}
const active = { isCancellationRequested: false };
const cancelled = { isCancellationRequested: true };

// A full Node+WASM integration without the ~hundreds-of-MB Electron download.
test('real core + actual adapter: F12, unsaved edits, symbols, cancellation and disposal', async () => {
  const core = createLanguageCore();
  const mock = mockVSCode();
  let registration;
  try {
    await core.initialize();
    registration = registerLanguageFeatures(mock.api, core);
    assert.ok(mock.providers.definition, 'DefinitionProvider was not registered');
    assert.ok(mock.providers.symbols, 'DocumentSymbolProvider was not registered');

    const text = 'byte counter; init { counter = 1; }';
    const doc = document(text);
    const provider = mock.providers.definition;
    const locations = await provider.provideDefinition(
      doc, new Position(0, text.lastIndexOf('counter')), active,
    );
    assert.equal(locations.length, 1);
    assert.equal(locations[0].uri.toString(), doc.uri.toString());
    assert.deepEqual([locations[0].range.start.line, locations[0].range.start.character], [0, 5]);

    const symbols = await mock.providers.symbols.provideDocumentSymbols(doc, active);
    assert.ok(symbols.some((symbol) => symbol.name === 'counter'));

    doc.text = 'byte updated; init { updated = 1; }';
    doc.version = 2;  // Unsaved update: no filesystem involvement.
    const after = await provider.provideDefinition(
      doc, new Position(0, doc.text.lastIndexOf('updated')), active,
    );
    assert.equal(after.length, 1);
    assert.deepEqual([after[0].range.start.line, after[0].range.start.character], [0, 5]);

    const cancelledLocations = await provider.provideDefinition(doc, new Position(0, 22), cancelled);
    assert.equal(cancelledLocations, undefined);
    const cancelledSymbols = await mock.providers.symbols.provideDocumentSymbols(doc, cancelled);
    assert.deepEqual(cancelledSymbols, []);

    const missing = document('init { run Missing(); }', 1, 'untitled:missing.pml');
    const unresolved = await provider.provideDefinition(
      missing, new Position(0, missing.text.indexOf('Missing')), active,
    );
    assert.equal(unresolved, undefined, 'Unknown names must not receive invented destinations');

    mock.close(doc);
    // Allow queued close callbacks to run. Separate document remains independent.
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    registration?.dispose();
    core.dispose();
  }
  assert.equal(mock.providers.definition, undefined, 'Disposal must deregister providers');
  assert.equal(mock.providers.symbols, undefined, 'Disposal must deregister providers');
});
