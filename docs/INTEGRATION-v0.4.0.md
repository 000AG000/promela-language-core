# v0.4.0 P0 language-core integration contract (release candidate)

**Status:** `0.4.0-rc.2` — candidate implementation of the interface requested by
`Eingefügter Text(20261121-190930).txt`. It is **not** a verified production
extension release. The project owner must run the WASM, installed-package and
Extension Host tests and then integrate the API into the *real* extension.

## Responsibilities

| Language core (no `vscode` dependency) | VS Code extension |
| --- | --- |
| Load packaged ProMeLa WASM | Register ProMeLa language, TextMate grammar and providers |
| Hold versioned in-memory document snapshots | Subscribe to document lifecycle events |
| Index definitions and resolve one-file references | Convert `SourceLocation` into `vscode.Location` |
| Return UTF-16 ranges and source versions | Reject provider responses for obsolete document versions |
| Dispose parser and document syntax trees | Preserve SPIN simulation, SPIN diagnostics and process cancellation |

No cross-file navigation, full preprocessor evaluation, SPIN execution, semantic
validation, semantic tokens or rename is added by this release candidate.
The original `createPromelaParser`, `indexDefinitions`, `definitionAt` and
`positionOf` remain available for existing consumers.

## Public API

```ts
import { createLanguageCore } from 'promela-language-core';

const core = createLanguageCore();
try {
  await core.initialize();
  const uri = 'file:///example.pml';
  const snapshot = await core.openDocument({
    uri,
    version: 1,
    text: 'byte counter; init { counter = 1; }',
  });
  // snapshot: {uri, version: 1, hasSyntaxErrors: false}

  const result = await core.getDefinition(uri, {line: 0, character: 21});
  // result.status: resolved | unresolved | ambiguous | unsupported
  // result.locations: [{uri, range: {start: {line,character}, end: ...}}]
  // end is exclusive; all characters count UTF-16 code units.
  const symbols = await core.getDocumentSymbols(uri);

  await core.updateDocument({
    uri,
    version: 2,
    text: 'byte updated; init { updated = 1; }',
  });
  core.closeDocument(uri);
} finally {
  core.dispose();
}
```

Core configuration may specify a `projectRoot` directory containing
`assets/tree-sitter-promela.wasm`; absent that option the default **package-
relative** asset path is used. No runtime downloads or native compiler steps.
Parser initialization is asynchronous and coalesced per core instance.
`dispose` is idempotent; a disposed core cannot be reopened.

## Document and version semantics

- Each URI identifies an independent document, even when filenames or symbol
  names are identical.
- `openDocument` opens a new URI; reopening an already opened URI throws
  `LanguageCoreError` with `code = 'DOCUMENT_ALREADY_OPEN'`.
- `updateDocument` requires a strictly greater **integer** version for an
  already opened URI. Equal/older updates throw `STALE_DOCUMENT_VERSION`.
- Updates parse the supplied in-memory source, not a disk file. P0 deliberately
  uses full-text reparses; incremental optimizations remain P1.
- A failed parse/update does not destroy the previous successful snapshot.
- `getDefinition` embeds `version` in every result. `LanguageSymbol` embeds the
  version and has a snapshot-unique ID, not a persistent ID across edits.
- `closeDocument` is idempotent and deletes its Tree-sitter syntax tree.
- `getDefinition` and `getDocumentSymbols` require an opened URI and reject
  a closed one with `DOCUMENT_NOT_OPEN`.
- Technical misuse/lifecycle failures throw a typed `LanguageCoreError`.
  Normal unknown references return `unresolved`, not an exception.

## Coordinates, errors and limitations

All external source positions are 0-based, UTF-16, and end-exclusive. This
matches `vscode.Position` / `vscode.Range`. Source text coordinates are derived
from JS UTF-16 string offsets using `SourceText`, which treats `\r\n` as a
single line break. A supplementary-plane emoji consumes **two** UTF-16
code units. The web binding's indices/position semantics must remain covered by
runtime regression tests whenever `web-tree-sitter` changes.

`DefinitionResult.status` means:

- `resolved`: a single known declaration.
- `ambiguous`: more than one same-scope/same-kind declaration; `locations`
  contains those candidates rather than choosing one silently.
- `unresolved`: the cursor has no known definition (including an unknown
  process), with `locations: []`.
- `unsupported`: the requested position is within an `ERROR` or missing
  grammar node; no guessed location is returned.

`DocumentSnapshot.hasSyntaxErrors` reports **Tree-sitter** errors, not SPIN
semantic errors. Unsupported valid SPIN grammar constructs can also cause
syntax errors here. The extension must not present this boolean as a definitive
SPIN diagnostic. SPIN validation remains owned by the extension.

The established resolver is deliberately reused for P0. It supports tested
single-document symbol cases, including process calls, variable shadowing,
labels, inlines, typedef fields and simple macros. It is not a complete
semantic model; conditional preprocessing, nested struct resolution, includes,
and multi-file symbol resolution remain outside this API.

## Integration and acceptance tests

From the root:

```sh
npm install                     # updates/creates an authentic lockfile if needed
npm run check:quality
npm run test:all                 # compile WASM, 5 corpus tests, Node tests, package smoke
```

The Node tests in `test/language-core.test.ts` exercise initialization,
version rejection, close/dispose, separate URIs, shadowing, unsaved edits,
invalid source recovery, and UTF-16 positions after emoji and CRLF.
`scripts/test-package.mjs` **installs a real npm tarball** and tests both
legacy and P0 APIs. No npm publication is required.

For the **reference-only** extension:

```sh
npm run stage:core
cd integration/vscode-extension-sample
npm run sync:core
npm run check:types
npm run build
npm run test:extension-host   # requires desktop VS Code and GUI/display
```

The host test calls `vscode.executeDefinitionProvider` and then repeats the
navigation after an unsaved editor edit. It does not exercise your real
extension's SPIN features. For Linux headless CI, configure Xvfb; the test
runner may download a VS Code build.

**Still required to satisfy the full v0.4.0 Definition of Done:** apply the
adapter contract to your actual extension, preserve its TextMate and SPIN
features, and test navigation and simulations in a clean installed VSIX on
Linux, Windows and macOS. The real extension repository was not supplied for
this candidate, so that acceptance gate has not been completed.

## Scope deferred beyond P0

Find References, semantic tokens, workspace dependencies, edit-based
incremental updates, syntax-issue APIs, macro expansion, embedded C, semantic
validation, full SPIN type checking, browser compatibility and rename are P1/P2.
Avoid building these into the core until the extension's actual needs are
validated.
