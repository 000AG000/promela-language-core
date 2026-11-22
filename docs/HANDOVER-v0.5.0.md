# Handover to the VS Code extension agent — v0.5.0-rc.1

**Purpose:** remove the extension's 250-identifier ceiling by returning semantic
tokens and references in one shared document index, while retaining the P0 API.

## New npm exports

- `LanguageCore.getSemanticTokens(uri): Promise<SemanticTokenResult>`
- `LanguageCore.findReferences(uri, position, includeDeclaration): Promise<ReferenceResult>`
- Types `SemanticTokenInfo`, `SemanticTokenResult`, `ReferenceResult`
- Existing `getDefinition()`, `getDocumentSymbols()`, `openDocument()`,
  `updateDocument()`, `closeDocument()`, and `dispose()` are retained.
- `LanguageSymbol.fullRange` and `.selectionRange` are optional new properties.

See `docs/INTEGRATION-v0.5.0.md` for exact contracts and lifecycle semantics.

## Changes required in the extension

1. Delete the 250-candidate cap and the loop that calls `getDefinition()` per
   candidate identifier. Replace with one `getSemanticTokens(uri)` per document
   version; discard a result if `result.version !== document.version`.
2. Preserve the current `SemanticTokensLegend` mapping. The core returns
   `process`, `variable`, `parameter`, `field`, `inline`, `macro`, `mtype`,
   `label`, `typedef`, and `ltl`; map to the extension's advertised token types.
3. Do not merge results from separate model files; cross-file indexing is deferred.
4. If implementing references, register a `ReferenceProvider` that calls
   `findReferences` and maps `SourceLocation` to `vscode.Location`.
5. For hierarchical Document Symbols, use optional full and selection ranges.
   Keep the existing fallback if an older installed core doesn't expose them.
6. Do not change the extension's TextMate, SPIN simulation, SPIN diagnostics,
   cancellation, or document event ownership.

## Required acceptance checks

- A model containing 2,000 resolved references yields all tokens in one call.
- Declarations vs references are distinguishable; local shadowing is preserved.
- Unicode, CRLF, and unsaved edits yield exact UTF-16 positions and correct
  result versions.
- No token is invented for unknown or unsupported identifiers.
- The package tarball installs into the extension and its bundled WASM loads.
- Actual F12 and Document Symbols providers continue to work.
- TextMate and SPIN behavior remain unchanged.

## Verification status

This handover accompanies a **candidate implementation**. Source type checks,
fixture coverage, benchmark source, and package tests are included. The npm/WASM
suite and actual VS Code extension checks must be executed by the maintainer
before publishing; no benchmark speedup or runtime test success is claimed here.

## Deferred backlog

Include-aware workspace navigation, macro expansion, embedded C, edit-based
incremental analysis, rename, hover, completion, and SPIN integration in the
core are intentionally not part of this release candidate.
