# ProMeLa Language Core v0.5.0-rc.1 — semantic APIs

## Scope and compatibility

This release candidate preserves the v0.4.0 document lifecycle, `getDefinition()`, and
`getDocumentSymbols()` APIs. It introduces a document-level semantic index that is built
exactly once for each successful open/update and discarded on close/dispose/update.
The index shares the existing `definitionAt()` scope-resolution rules; it is not a
second resolver. No `vscode` dependency is present.

**No full preprocessing, SPIN execution, workspace-wide symbol merging, or native
runtime compilation is added.** The parser continues to accept the grammar's
supported ProMeLa subset. Unsupported or ambiguous reference classifications are
not emitted as semantic tokens.

## Public TypeScript API

```typescript
interface SemanticTokenInfo {
  range: SourceRange;
  type: 'process' | 'variable' | 'parameter' | 'field' | 'inline'
    | 'macro' | 'mtype' | 'label' | 'typedef' | 'ltl';
  declaration: boolean;
}
interface SemanticTokenResult {
  uri: string;
  version: number;
  tokens: SemanticTokenInfo[];
}
interface ReferenceResult {
  uri: string;
  version: number;
  locations: SourceLocation[];
}
interface LanguageCore {
  getSemanticTokens(uri: string): Promise<SemanticTokenResult>;
  findReferences(
    uri: string, position: SourcePosition, includeDeclaration: boolean
  ): Promise<ReferenceResult>;
}
```

Both methods require an open document and reject with `DOCUMENT_NOT_OPEN` when the
URI is closed. They return **snapshot version numbers**, so the extension can discard
responses that do not match the current `TextDocument.version`.

**Position convention:** UTF-16 code units, zero-based lines/characters, end-exclusive
ranges. Semantic tokens are sorted and non-overlapping. No strings or comments are
scanned with regular expressions; resolved identifiers come from the Tree-sitter AST.

`getDocumentSymbols()` additionally provides optional `fullRange` and
`selectionRange`. For processes, inline definitions, and typedefs, `fullRange`
contains the full syntactic construct; `selectionRange` covers the declaration
identifier. Other symbol kinds use the declaration range for both.

### Usage

```typescript
import { createLanguageCore } from 'promela-language-core';

const core = createLanguageCore();
try {
  await core.openDocument({
    uri: 'file:///example.pml', version: 1,
    text: 'int x; init { x = x + 1; }',
  });
  const { version, tokens } = await core.getSemanticTokens('file:///example.pml');
  // Check `version` against the editor's current document version.
  const references = await core.findReferences(
    'file:///example.pml', { line: 0, character: 14 }, true,
  );
} finally {
  core.dispose();
}
```

The extension translates `SemanticTokenInfo.type` to its registered
`SemanticTokensLegend` and converts `range` to `vscode.Range`. It must **not** repeat
`getDefinition()` per identifier. For references, it registers its own
`vscode.ReferenceProvider`; the core returns editor-independent locations only.

### Resolution boundaries

- Declarations and unambiguous, resolved references receive tokens.
- Unknown identifiers produce no semantic token and no unrelated references.
- Ambiguous references can be reported as ambiguous by `getDefinition()`; they
  are not classified as if the binding were known.
- Reference results initially cover one open document, not include graphs.
- Underlying ProMeLa grammar gaps remain (embedded C, multiline macros and
  general preprocessing are outside this release).
- Full-text `updateDocument()` remains the supported update mechanism.

## Shared index architecture

```text
openDocument/updateDocument
  -> parser.parse(text)
  -> indexDefinitions(tree) exactly once
  -> resolve named AST identifiers with that declaration set
  -> immutable DocumentSemanticIndex snapshot
       -> getDefinition(): binary-search occurrence
       -> getDocumentSymbols(): declarations, containers and full spans
       -> getSemanticTokens(): sorted resolved occurrences
       -> findReferences(): symbol-identity reverse map
```

An update swaps the complete parsed document and index only after successful
construction. Stale/duplicate versions are rejected. Tree-sitter nodes are not
retained in the index, so the old parse tree can be deleted safely.

## Build, test, package

```bash
npm install
npm run format:write
npm run check:quality
npm run test:all
npm run benchmark:semantic
npm run pack:core
```

`npm run test:all` includes independent installation of the staged package and
smoke tests of the new methods. The deterministic benchmark generates an `init`
body with 2,000 references and prints observed parse/index time, median time for
one batch query, and median time for 2,000 `getDefinition()` calls.

`npm run pack:core` creates `release/promela-language-core-0.5.0-rc.1.tgz` from the
staged runtime package. The resulting tarball includes JavaScript, TypeScript
`.d.ts`, and the grammar WASM. Do not run `npm pack` at the repository root.

## Acceptance boundary

Source-level and mocked type checks are **not** a substitute for executing the
WASM suite on Linux/Node with installed npm dependencies. Release only after the
new tests, reference VS Code adapter, independently installed package, and VSIX
integration have passed against the same staged artifact.
