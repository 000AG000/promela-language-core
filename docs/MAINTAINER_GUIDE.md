# Maintainer guide — architecture and invariants

## What exists today

The repository is a **Node/TypeScript language-core prototype** rather than a
complete SPIN compiler or published VS Code extension. A successfully built
v0.3.1 baseline was tested by the project owner: 17 Node tests passed and
`npm pack --dry-run` listed the intended WASM and license files. The additions
in this maintainer pass require another full validation.

### Source-to-distribution flow

```text
grammar/grammar.js (CommonJS, start rule `program`)
  │ tree-sitter generate
  └─> grammar/src/parser.c + node-types.json [generated; do not edit]
        │ tree-sitter build --wasm
        └─> assets/tree-sitter-promela.wasm [generated]
              │ web-tree-sitter@0.27.2
              └─> src/parser.ts: createPromelaParser()
                    │ Tree
                    └─> src/definitions.ts: indexDefinitions / definitionAt
                          │ exported from src/index.ts
                          └─> release/promela-language-core/
                                │ npm pack / independent consumer smoke test
                                └─> a future VS Code workspace extension
```

### Components

| Path | Owner responsibility | Important caution |
| --- | --- | --- |
| `grammar/grammar.js` | syntax nodes, disambiguation | first rule is start symbol; valid syntax must not yield errors |
| `grammar/queries` | highlighting queries | not a semantic symbol index |
| `src/parser.ts` | WASM loading and parser lifecycle | `close()` frees parser; callers free each `Tree` |
| `src/definitions.ts` | single-file declarations and navigation | scope IDs use AST positions; not cross-file or full lexical scopes |
| `src/index.ts` | public npm API | changing this is a consumer-facing API change |
| `src/audit.ts` | exploratory compatibility reporting | audit intentionally reports known gaps |
| `scripts/` | generate/compile/stage and fingerprint | never fall back to stale WASM |
| `test/` | runtime AST contracts | assert node shapes, not just `hasError` |
| `grammar/test/corpus` | CLI-native grammar snapshots | snapshots are an API contract; review updates |
| `integration/vscode-extension-sample/` | optional Node host adapter | not a tested production VSIX |

### Position model

Tree-sitter nodes expose positions and indexes. VS Code's `Position.character`
uses UTF-16 code units. Non-ASCII, CRLF, document edits, byte/code-unit
translations, and nested parsing require dedicated tests before offering a
reliable editor-wide API. The current Node sample handles simple ASCII tests.

### Current semantic limits

- `preprocessor_directive` nodes do not expand `#define`, resolve active `#if`
  branches, or implement search paths for `#include`.
- `definitionAt` constructs a fresh symbol index per call and uses AST-offset-
  based scope strings. This is acceptable for small tests but not large files.
- Definition resolution handles some field accesses, labels and inline
  parameters, but not nested types, complete lexical blocks, workspace include
  graphs, cross-file symbol visibility, or semantic renames.
- The extension sample caches syntax trees by document version and reparses
  full text rather than feeding incremental edits through `Tree.edit`.
- Error-free Tree-sitter parses do not prove a program is valid SPIN input.

### Next architecture milestone (after release validation)

Introduce `DocumentAnalysis` (text version, tree, symbol table, diagnostics)
and explicit `Scope`/`SymbolId` types, then workspace include and macro
resolution. Preserve the lightweight VS Code-facing provider boundary. Switch
to an LSP server only if multi-file analysis, other editors, or background
processing justify the extra deployment complexity.

### Releases

1. Run full tests and audit; investigate changes to known-good fixtures.
2. Stage the core; inspect `npm pack --dry-run` for JS/WASM/licenses only.
3. Run the isolated consumer smoke test; it installs the produced `.tgz`.
4. Test the VS Code Extension Development Host with that immutable package.
5. Review licenses, author attributions and dependency versions.
6. Only then create tags, a remote repository or publication artifacts.

Read `docs/PROVENANCE.md`, `docs/TESTING.md`, and `CONTRIBUTING.md`.
