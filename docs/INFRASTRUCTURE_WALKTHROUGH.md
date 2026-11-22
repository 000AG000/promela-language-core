# Infrastructure walkthrough — ProMeLa Language Core

The source repository is independent of VS Code and does not need a remote GitHub
repository or npm publication to be developed locally. It has **two build products**:
a generated parser (WASM) and a compiled TypeScript library. A **third artifact**,
a staged npm package, combines them for consumers.

## 1. From grammar source to WASM

```text
grammar/grammar.js (CommonJS)
   |  tree-sitter generate (scripts/generate.mjs)
   v
grammar/src/parser.c + grammar/src/node-types.json  [generated]
   |  tree-sitter build --wasm (scripts/build-wasm.mjs)
   v
assets/tree-sitter-promela.wasm                    [generated]
```

- `grammar/grammar.js` defines syntax and AST node names, **not** name resolution.
- `grammar/package.json` isolates the CommonJS grammar from the ESM project.
- `program` must be the first rule; it is Tree-sitter's start symbol.
- `grammar/src/` and `assets/*.wasm` are **not manually edited**. They are build outputs.
- `scripts/check-grammar.mjs` performs quick structure checks, but real conflict
  detection requires `tree-sitter generate`.
- `assets/tree-sitter-promela.build.sha256` detects stale local build artifacts.
  It is not a signature or proof of reproducible builds.

## 2. Query files are separate from the parser

`grammar/queries/highlights.scm` describes syntax-highlighting captures over the
resulting AST. It does not change what source code the parser accepts. Node names
in query patterns must match generated grammar symbols:

```scheme
(break) @keyword       ; named grammar rule
"proctype" @keyword   ; anonymous literal in a proc declaration
```

The v0.3.2 test failure was precisely such a mismatch: the grammar exposes the
named `break` rule, but the query used the anonymous `"break"` pattern. The CLI
`tree-sitter test` validates registered queries **after** corpus tests.
`test/highlights.test.ts` now independently compiles and executes the query
against the WebAssembly grammar.

## 3. At runtime: TypeScript language core

```text
source text
  | src/parser.ts: Parser.init() + Language.load(.wasm)
  v
web-tree-sitter Tree with Node hierarchy
  | src/definitions.ts: indexDefinitions(tree), definitionAt(tree, row, col)
  v
single-document symbols / definition locations
  | src/index.ts exports public API
  v
Node.js consumer (e.g. the VS Code workspace extension)
```

- `src/parser.ts` finds WASM **relative to its own installed module**, not the
  caller's current working directory. It returns a parser instance with
  `parse(source)` and `close()`. Callers must free the returned `Tree` using
  `tree.delete()`.
- `src/definitions.ts` inspects the AST and resolves some declarations by name,
  kind, and syntactic scope. It is a **prototype single-file resolver**: it does
  not perform full preprocessing, cross-file analysis, or full type checking.
- `src/index.ts` is the public entry point. `src/cli.ts` and `src/audit.ts` are
  internal development utilities and should not be shipped in the runtime package.

## 4. Test driver: why the order matters

`npm test` invokes (in order):

1. `npm run build:wasm` — structural grammar checks, parser generation, WASM build.
2. `npm run build` — TypeScript compilation into `dist/`.
3. `npm run test:grammar` — native Tree-sitter AST corpus **and configured queries**.
4. `npm run test:unit` — Node.js `node:test` tests against the actual WASM runtime.

A failure at any stage stops later stages. Your v0.3.2 output showed two corpus
cases passing but query validation failing, so the TypeScript/WASM unit tests
were **not** reached in that invocation.

Other test layers:

| Command | Purpose |
| --- | --- |
| `npm run check:fast` | grammar structure, TypeScript type checking, script syntax |
| `npm run audit` | informational support matrix, including known unsupported constructs |
| `npm run test:coverage` | Node test coverage; not grammar or SPIN conformance |
| `npm run stage:core` | stage distributable JS/WASM and MIT notices |
| `npm run test:package` | build a tarball, install in temporary consumer, import by package name |
| `npm run test:all` | full test chain, staging, isolated consumer installation |

The coverage report is **not** semantic coverage of all valid ProMeLa programs.
For that, add real-world models and a differential test driver using the SPIN
executable. Error-free parsing alone is not proof that SPIN accepts a model.

## 5. Distribution and VS Code

```text
npm run stage:core
  -> release/promela-language-core/
      dist/src/{index,parser,definitions}.{js,d.ts,...}
      assets/tree-sitter-promela.wasm
      package.json + THIRD_PARTY_LICENSES/
  -> npm pack (local .tgz)
  -> VS Code extension installs a pinned tarball/package version
```

The VS Code extension is an **adapter**, not a second grammar implementation.
It registers `DefinitionProvider` and `DocumentSymbolProvider`, holds the parser
lifecycle, and caches documents. Keep `vscode` out of core source.

This implementation targets a Node-based VS Code extension host. A web extension
requires a different WASM-loading strategy. The sample extension is **not yet an
extension-host-tested distributable**. Do not publish it as a finished VSIX.

For production: separate `DocumentAnalysis` (tree + symbol index + version) from
VS Code APIs; replace position-string scopes with explicit scope identities;
add UTF-16 / Unicode / CRLF position tests; add cross-file include and macro
resolution; validate in a real VS Code extension host.

## 6. Local Git and agent-friendly maintenance

A Git remote is unnecessary. Initialize locally when ready:

```bash
git init -b main
npm install
npm run check:fast
npm test
npm run test:all
npm run hooks:install  # optional, after git init
```

- `AGENTS.md` communicates invariants to coding agents; `CONTRIBUTING.md`
  records the human contribution workflow.
- Commit `package-lock.json` and use `npm ci` in CI for reproducible dependency
  resolution. The source archive cannot produce a trusted lockfile without
  installing the actual dependencies.
- Preserve `grammar/LICENSE` and attribution for upstream
  `siraben/tree-sitter-promela` (MIT). Review the root contributor attribution
  before publishing. No GitHub or npm publication is required for local testing.
