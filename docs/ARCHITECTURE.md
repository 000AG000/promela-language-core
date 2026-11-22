# Architecture and release process

## Boundaries

1. `grammar/`: maintained MIT-derived Tree-sitter grammar and highlight queries.
2. `src/`: VS Code-independent Node library (`createPromelaParser`, definitions).
3. `assets/`: generated grammar WASM; **never edit or hand-copy**.
4. `release/promela-language-core`: versioned npm package staged from a tested build.
5. `integration/vscode-extension-sample`: adapter for Node/workspace extension host.
6. Future `preprocessor/`: include graph, macro resolver, conditional evaluation;
   do not treat raw preprocessor AST as a semantically expanded model.

## Professional workflow

- Keep this parser in its own Git repository with reviewed PRs, protected main,
  and pinned `tree-sitter-cli`/`web-tree-sitter` versions.
- Use a semver tag and immutable npm tarball/version for every tested release.
- A release builds `parser.c` and WASM from tracked grammar.js, runs grammar
  corpus and Node WASM tests, checks against SPIN, runs release staging and
  npm pack inspection, then tests the *consumer* extension with that tarball.
- Consumer extension uses a pinned dependency version (or pinned tarball). For a VSIX build, install a tarball, not a symlinked `file:` directory dependency.
  Do **not** fetch a floating GitHub `main` on every extension build.
- When vendoring generated WASM, preserve its source revision, compiler/ABI
  versions and SHA-256. The `check:wasm` script prevents stale artifacts.
- Release gates: grammar generation, WASM rebuild, unit tests, SPIN differential
  parsing/semantic validation, VS Code extension-host smoke tests, VSIX audit,
  third-party attribution and dependency review.
- Add CI upload artifacts for `.tgz` and `.vsix`, use manual approval for
  publishing. `npm pack --dry-run` alone does not test actual VSIX inclusion.

## Preprocessing design

This version accepts single-line `#` directives as named *extra* nodes in the
raw source tree. It does not expand macros or exclude disabled `#if` branches.
SPIN is the authority on expanded semantics. For future navigation, build a
workspace include dependency graph, parse directives with a dedicated scanner,
then use SPIN/cpp diagnostics and source maps for expanded code. Do not apply
compiler diagnostics from expanded offsets directly to original documents.

## Scope limitations

The VS Code sample additionally opens quoted relative #include targets when they exist (no SPIN include-path search). The resolver is still a syntactic same-document prototype. It is **not** a
correct cross-file resolver, type checker, or full SPIN frontend. It will not
correctly resolve nested fields, macro shadowing/redefinition, preprocessor
visibility, or disabled branches. Do not enable Rename Symbol based on this
index until false positives are addressed.

## Licensing

The derived siraben grammar is MIT and its original LICENSE is preserved.
Tree-sitter/web-tree-sitter are MIT and the runtime's license must accompany
redistributed WASM/JS. The generated grammar WASM is derived from the grammar
and Tree-sitter parser runtime. Do not bundle the SPIN executable without
separately reviewing the SPIN BSD-3-Clause license and its notice terms.
The root `LICENSE` covers new source contributions; change the placeholder
copyright attribution to your real project/author when publishing.
License verification is not legal advice.

## Integration into your existing extension

- Prefer importing `promela-language-core` from a pinned internal package.
- Register language id `promela` **once** in the existing VS Code extension.
- Reuse `registerDefinitionProvider` / `registerDocumentSymbolProvider`
  handlers from `integration/vscode-extension-sample/src/extension.ts`.
- Cache one syntax tree per document/version; handle changed documents,
  deletions and extension disposal. The example reparses on document versions,
  not a real incremental edit pipeline yet.
- For file-backed and untitled editor documents, map Tree-sitter positions to
  `vscode.Position`; test non-ASCII UTF-16 positions before shipping.
- For full workspace includes/macro resolution, use an LSP server only if
  cross-file indexing, background analyses or multiple editor clients justify it.
  VS Code's native providers are sufficient for the current requirements.
