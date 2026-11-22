# ProMeLa Language Core — v0.4.0 P0 integration candidate

**New in 0.4.0-rc.2:** `createLanguageCore()` provides an editor-independent, versioned document lifecycle, UTF-16 source locations, single-file Go to Definition and document symbols. The existing parser API remains compatible. See [`docs/INTEGRATION-v0.4.0.md`](docs/INTEGRATION-v0.4.0.md) and [`docs/VERIFICATION-v0.4.0.md`](docs/VERIFICATION-v0.4.0.md). **This is a candidate, not yet validated in the real VS Code extension or installed VSIX.**

A Node.js/TypeScript language-core prototype for [SPIN's ProMeLa language](https://spinroot.com/spin/Man/promela.html), powered by a maintained WebAssembly Tree-sitter grammar. The package is intended for a future **VS Code workspace extension**, but contains no `vscode` runtime dependency.

**Baseline:** The project owner verified v0.3.6 with the recovery-word grammar change: 46 passing Node tests, five native corpus tests, a clean npm audit, and independent installed-package navigation. v0.4.0-rc.2 adds a new language-service API; its expanded tests and Extension Host integration require fresh verification. No public npm publication is claimed.

## Architecture at a glance

```text
grammar/grammar.js --generate--> grammar/src/parser.c --build --wasm-->
assets/tree-sitter-promela.wasm --web-tree-sitter--> src/parser.ts
  --> src/definitions.ts (single-document indexing/navigation)
  --> src/index.ts (public npm API)
  --> staged npm package --> future VS Code extension
```

The grammar derives from Ben Siraphob's MIT-licensed `tree-sitter-promela` at commit `91da8f1`; see `grammar/LICENSE` and `docs/PROVENANCE.md`. The source grammar remains CommonJS (`grammar/package.json`) while the TypeScript library is ESM. The `program` rule must remain first.

### What works and what remains experimental

- Grammar generation and WebAssembly parsing; proctype/inline/typedef/label/unsigned structures, guarded `->`, LTL, and syntax-only preprocessor directives.
- AST-backed **single-document** definitions: local/global variables, shadowing, proctypes, inline calls/parameters, labels, first-level fields, some macros.
- **Not implemented:** C blocks, multiline macro expansion, conditional compilation evaluation, cross-file semantic resolution, nested type checking, production-quality rename, and browser-host VS Code support.
- An error-free AST is **not** proof that SPIN accepts a model.

For the build and test architecture, see [`docs/INFRASTRUCTURE_WALKTHROUGH.md`](docs/INFRASTRUCTURE_WALKTHROUGH.md).

See [`docs/MAINTAINER_GUIDE.md`](docs/MAINTAINER_GUIDE.md), [`docs/TESTING.md`](docs/TESTING.md), and [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md).

## Local development (no remote needed)

Requires Node.js >=20.11, npm, and network access for initial dependency/toolchain downloads.

```bash
npm install
npm run doctor
npm run check:fast
npm test
npm run audit
# After the full build, optionally rerun only malformed-input tests:
npm run test:negative
```

`npm test` **always** regenerates the C parser, compiles WASM, compiles TypeScript, executes native grammar corpus tests, and runs all Node tests. A failed parser generation stops the test run. `npm run audit` reports known gaps without treating them as surprises.

```bash
npm run parse -- fixtures/definitions.pml --tree
npm run test:package
```

`test:package` first validates/recreates the release staging directory, then builds and installs a real npm tarball in a temporary directory and tests the **packaged** JS+WASM APIs. It does not publish anything. `npm run test:all` combines the full suite with automatically refreshed package staging and package smoke testing.

For more commands, including the dedicated negative-syntax tests and error-recovery expectations, see [`docs/TESTING.md`](docs/TESTING.md).

## Local Git and commit hooks

GitHub is optional. To enable version control locally:

```bash
git init -b main
npm run hooks:install    # explicit opt-in; local git config only
npm run check:fast
git add .
git commit -m "Initialize ProMeLa language core"
```

The tracked `pre-commit` hook runs quick checks; `pre-push` runs the full test suite. They do not publish or push your code. Uninstall with `git config --local --unset core.hooksPath`. Hooks require installed development dependencies.

**Before a public release:** generate and commit `package-lock.json` (`npm install`), then switch CI from `npm install` to `npm ci`. Review owner attribution in the root MIT license. Also test the versioned tarball in a real VS Code Extension Development Host. `docs/TESTING.md` contains the release checklist.

## Public TypeScript API

```typescript
import { createPromelaParser, definitionAt, indexDefinitions } from 'promela-language-core';

const runtime = await createPromelaParser();
try {
  const tree = runtime.parse('byte counter; init { counter = 1; }');
  try {
    console.log(indexDefinitions(tree));
    console.log(definitionAt(tree, 0, 21));
  } finally { tree.delete(); }
} finally { runtime.close(); }
```

The staged package keeps the WASM at a location resolved **relative to the installed module**, not the consumer's working directory. The library is designed for the Node/workspace extension host, not yet a VS Code web extension.

## Docs for maintainers and AI agents

- [`AGENTS.md`](AGENTS.md) — portable repository instructions for coding agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contributor workflow and optional hooks.
- [`docs/MAINTAINER_GUIDE.md`](docs/MAINTAINER_GUIDE.md) — architecture, public API, invariants and known limitations.
- [`docs/INFRASTRUCTURE_WALKTHROUGH.md`](docs/INFRASTRUCTURE_WALKTHROUGH.md) — worked build, execution, testing and distribution walkthrough.
- [`docs/TESTING.md`](docs/TESTING.md) — test driver, conformance cases, package test and release gates.
- [`docs/PROVENANCE.md`](docs/PROVENANCE.md) — upstream derivation and license handling.
- [`docs/PREPUBLICATION_REVIEW.md`](docs/PREPUBLICATION_REVIEW.md) — risks and publication checklist.
- [`docs/VERIFICATION-v0.3.3.md`](docs/VERIFICATION-v0.3.3.md) — exactly which checks ran for this candidate.

`integration/vscode-extension-sample` is an example adapter, not an independently verified publishable extension. Keep the actual VS Code project separate and consume a tested, pinned core package.

### v0.3.5.1 testing note

The negative suite tracks one known top-level error-recovery limitation
as a TODO. See [error recovery](docs/ERROR_RECOVERY.md). Incremental
repairs are compared against fresh parses rather than a hardcoded AST
node count. The VS Code sample uses a separate dependency installation.

## Developer tooling (v0.3.6)

See [docs/TOOLING-v0.3.6.md](docs/TOOLING-v0.3.6.md). After applying the
patch, run `npm install` to update the local lockfile, then
`npm run doctor -- --strict`, `npm run check:quality`, and `npm run test:all`.
CI requires a committed `package-lock.json` and uses `npm ci`. Prettier is
configured but intentionally not enforced until a separate formatting commit.

## v0.5.0 semantic tokens and references (release candidate)

The document API now supports `getSemanticTokens(uri)` and
`findReferences(uri, position, includeDeclaration)` using one shared semantic
index per document version. The 250-candidate limit formerly applied by the
reference extension is not part of the core. See
[docs/INTEGRATION-v0.5.0.md](docs/INTEGRATION-v0.5.0.md).

Build and verify with `npm run test:all`, measure with
`npm run benchmark:semantic`, and generate a distributable npm tarball using
`npm run pack:core` (requires installed npm dependencies and compiled WASM).
