# Pre-publication review — v0.3.1 baseline → v0.3.2 maintenance candidate

This review is based on the actual v0.3.1 source archive and the owner's
successful local test log. It is not a certification of full SPIN compatibility.

## Decision

**Keep developing locally; do not publish yet.** The grammar, WASM build,
Node parser and basic single-file symbol resolution form a sound prototype.
Next, stabilize the repository and confirm packaged consumption in isolation.

## Architecture (current code)

- `grammar/grammar.js`: derivative of siraben's MIT grammar; Tree-sitter DSL.
  `program` must be first; CommonJS package scope is intentional.
- `scripts/generate.mjs`: runs the pinned Tree-sitter CLI in `grammar/`.
- `scripts/build-wasm.mjs`: compiles `assets/tree-sitter-promela.wasm` and
  records a SHA-256 fingerprint of grammar, generated C parser and WASM.
- `src/parser.ts`: initializes `web-tree-sitter`, loads WASM module-relatively,
  returns a parser with explicit `close()` lifecycle.
- `src/definitions.ts`: walks AST declarations, indexes their names, chooses
  declarations by syntactic scope and syntax context. Only same-document.
- `src/index.ts`: small public interface for package consumers.
- `scripts/stage-core.mjs`: assembles npm package with licenses and assets.
- `integration/vscode-extension-sample`: a Node extension-host adapter, NOT a
  full tested VSIX or a web-extension implementation.

## Strengths already supported by user tests

- v0.3.1: 17 tests passed; no failures.
- Grammar generator, WASM compilation, TS compilation and WASM fingerprints
  worked in the user's Node environment.
- Parser supports tested labels, guarded `->`, LTL, inline definitions,
  unsigned declarations, basic macros and several navigation cases.
- npm package staging and `npm pack --dry-run` completed with license notices.

## Release risks

1. **Reproducibility:** root ignores package lock in v0.3.1; fix in v0.3.2,
   generate a real lockfile on a networked machine, commit it, use `npm ci`.
2. **Package consumer:** `npm pack --dry-run` does not import the installed
   package. Run isolated consumer smoke and VS Code extension-host test.
3. **Grammar test depth:** one Node test file (17 tests) is insufficient as
   grammar/API documentation; add native corpus and table-driven AST contracts.
4. **AST/semantic API:** prototype uses position-based scope IDs and rebuilds
   symbol index on each definition lookup; plan explicit scope and cache types.
5. **Preprocessing:** directives recognized, but no expansion, include graph,
   conditional evaluation or source mapping. Do not claim complete support.
6. **Embedded C and multiline macros:** known unsupported valid syntax.
7. **Unicode:** VS Code positions use UTF-16; test offsets, CRLF and edits.
8. **Licensing:** preserve original grammar MIT notice; root generic
   contributor copyright needs human review before publication.
9. **CI:** add pinned lockfile, native grammar corpus, tarball consumer test,
   editor-host test; only then release/tag. Current CI still installs without
   a lockfile until the developer generates/commits one.
10. **Style tooling:** editor settings exist in v0.3.2; decide on Prettier/
    ESLint rules before enforcing formatter checks to avoid unrelated churn.

## Improvements in v0.3.2 candidate

- `AGENTS.md`, `CONTRIBUTING.md`, maintainer/test/provenance documentation.
- Native Tree-sitter corpus under `grammar/test/corpus/`.
- Table-driven AST conformance tests on previously accepted audit cases.
- Isolated npm pack/install/import/WASM/navigation smoke driver.
- Public release folder no longer contains development `audit` and `cli` JS.
- Opt-in tracked Git hooks (fast checks pre-commit; full WASM suite pre-push).
- `.editorconfig`, `.gitattributes`, PR template, README overhaul, doctor.

**Not changed:** grammar, parser runtime, semantic resolution algorithms.
This limits the risk to build/test/docs/package engineering.

## Before the first public push

- [ ] `npm install` (commit resulting `package-lock.json`).
- [ ] Change GitHub Actions from `npm install` to `npm ci`.
- [ ] `npm run check:fast`, `npm test`, `npm run audit`.
- [ ] `npm run stage:core && npm run test:package`.
- [ ] Run a real VS Code Extension Development Host test from a packed tarball.
- [ ] Add SPIN differential tests for a curated valid-model corpus.
- [ ] Review/replace placeholder root copyright, attribution and README.
- [ ] Document release version/CLI/runtime ABIs, checksum and final VSIX files.
- [ ] Choose a public GitHub/repository name and npm scope only after review.
