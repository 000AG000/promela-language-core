# ProMeLa Language Core

**Current version:** `0.5.0-rc.1` (release candidate) · **License:** MIT · **Runtime:** Node.js ≥ 20.11

A reusable, editor-independent language core for **ProMeLa**, the modeling language used by [SPIN](https://spinroot.com/spin/Man/promela.html). It combines a maintained [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar, a WebAssembly parser, and a versioned semantic index for editor features.

The library is suitable for a **VS Code desktop extension host**, but has **no `vscode` dependency**. This repository contains the language core and a reference VS Code adapter—not the complete production extension. `0.5.0-rc.1` is a pre-release, not a claim of complete SPIN language compatibility.

## Features

- **Parsing:** Tree-sitter syntax trees for the tested ProMeLa subset, with error recovery while editing.
- **Versioned documents:** `openDocument`, `updateDocument`, and `closeDocument`; unsaved content is analyzed directly.
- **Go to Definition:** Single-document, scope-aware navigation for supported symbols, including local/global shadowing.
- **Document Symbols:** Declarations with symbol kinds, container identities, and source/selection ranges.
- **Batch Semantic Tokens:** Declarations and confidently resolved references in one call, without an arbitrary per-document identifier cap.
- **Find References:** Single-document references grouped by resolved symbol identity, with optional declaration inclusion.
- **Editor-safe positions:** Zero-based UTF-16 positions and end-exclusive ranges, including CRLF handling.
- **Portable distribution:** Compiled ESM JavaScript, TypeScript declarations, the ProMeLa WASM grammar, and third-party license notices in the staged npm package.

The batch semantic-token and reference APIs reuse a **shared semantic index per document version** instead of independently rebuilding symbol information for each lookup. See [v0.5.0 integration and API notes](docs/INTEGRATION-v0.5.0.md).

## Installation

The **root project is a private development package**, named `promela-tree-sitter-wasm-lab`. Consumers should install the separately staged **`promela-language-core`** package. A public npm-registry release is not required.

From this repository, with Node.js ≥ 20.11, npm dependencies, and the development toolchain installed:

```bash
npm ci
npm run test:all
npm run pack:core
```

This produces `release/promela-language-core-0.5.0-rc.1.tgz`. In the consuming project, install that exact tarball:

```bash
npm install /absolute/path/to/promela-language-core-0.5.0-rc.1.tgz
```

The **consumer** does not need Tree-sitter CLI or a native compiler: the tarball includes the built ProMeLa WASM grammar. The package depends on `web-tree-sitter@0.27.2` at runtime. Do not run plain `npm pack` at the repository root; it is not the distributable package.

## Quick start

```typescript
import { createLanguageCore } from 'promela-language-core';

const core = createLanguageCore();
const uri = 'file:///example.pml';

try {
  await core.initialize();
  await core.openDocument({
    uri,
    version: 1,
    text: 'int counter = 0;\ninit {\n  counter++;\n}\n',
  });

  // All results are tied to a document version.
  const definition = await core.getDefinition(uri, { line: 2, character: 3 });
  const symbols = await core.getDocumentSymbols(uri);
  const semantic = await core.getSemanticTokens(uri);
  const references = await core.findReferences(uri, { line: 2, character: 3 }, true);

  console.log(definition.status, definition.locations);
  console.log(symbols, semantic.version, semantic.tokens, references.locations);

  // Send a new version to analyze unsaved edits; older versions are rejected.
  await core.updateDocument({
    uri,
    version: 2,
    text: 'int counter = 0;\ninit {\n  counter = 1;\n}\n',
  });
} finally {
  core.closeDocument(uri);
  core.dispose();
}
```

Positions are **zero-based UTF-16 code-unit offsets per line**; range ends are exclusive. Query results include a version so editor integrations can discard stale responses. Ordinary unresolved names do not produce invented definition targets.

For low-level Tree-sitter use, the legacy `createPromelaParser()`, `indexDefinitions()`, and `definitionAt()` APIs remain available. See [v0.4.0 integration contract](docs/INTEGRATION-v0.4.0.md) and [v0.5.0 API notes](docs/INTEGRATION-v0.5.0.md).

## Architecture

```text
grammar/grammar.js
    │ Tree-sitter generation / WASM build
    ▼
assets/tree-sitter-promela.wasm
    │ web-tree-sitter@0.27.2
    ▼
src/parser.ts ── AST + source text ──► src/semantic-index.ts
                                          │ shared per document version
                                          ▼
                                  src/language-core.ts
                                  ├── getDefinition()
                                  ├── getDocumentSymbols()
                                  ├── getSemanticTokens()
                                  └── findReferences()
                                          │
                                          ▼
                           staged npm package / editor adapter
```

`src/definitions.ts` retains the existing declaration and scope-resolution foundation, and `src/index.ts` exports the public API. A document update replaces its semantic snapshot; closing a document releases its parser-tree state. The grammar is derived from an MIT-licensed upstream project; see [provenance and attribution](docs/PROVENANCE.md).

## Limitations

- **Single-document semantics:** No include-aware workspace graph or cross-file symbol resolution yet.
- **Preprocessor:** Directives are recognized syntactically, but macros and conditional compilation are not fully evaluated; multiline expansion and source mapping are incomplete.
- **Embedded C:** `c_code` and related constructs are not fully supported.
- **Semantic coverage:** Navigation, highlighting, and references apply only where the grammar and resolver can classify symbols confidently. Full type checking, rename, hover, and completion are outside this release.
- **SPIN remains authoritative:** An error-free parse does not prove that SPIN accepts the model. This package does not bundle or run SPIN.
- **Runtime:** Designed for Node.js/desktop extension hosts; VS Code web-extension/browser support is not established.

See [compatibility](docs/COMPATIBILITY.md) and [known gaps/error recovery](docs/ERROR_RECOVERY.md).

## Development and tests

```bash
npm ci
npm run doctor -- --strict
npm run check:quality
npm run test:all
npm run benchmark:semantic
npm audit --omit=dev
```

`npm run test:all` regenerates the parser, builds WebAssembly and TypeScript, runs Tree-sitter corpus and Node tests, and installs the staged npm tarball in independent consumer tests. `npm run benchmark:semantic` measures initial indexing versus batch tokens and repeated definition queries; performance depends on the model and machine.

The reference VS Code integration is in [`integration/vscode-extension-sample`](integration/vscode-extension-sample). For fast local adapter verification, use its `npm run sync:core` and `npm run test:adapter` commands after building the core; a real installed-VS-Code Extension Host test is available separately. The sample is not the production extension.

Contributor information: [CONTRIBUTING.md](CONTRIBUTING.md), [maintainer guide](docs/MAINTAINER_GUIDE.md), [testing](docs/TESTING.md), and [development tooling](docs/TOOLING-v0.3.6.md). The older [pre-publication review](docs/PREPUBLICATION_REVIEW.md) is retained as a **historical snapshot**, not a current release checklist.

## License and attribution

ProMeLa Language Core is released under the [MIT License](LICENSE), Copyright © 2026 Alexander Gundermann. The derived ProMeLa grammar preserves Ben Siraphob's original MIT notice in [`grammar/LICENSE`](grammar/LICENSE). Other distributable dependency notices are included under `THIRD_PARTY_LICENSES/` in the staged package; see [PROVENANCE.md](docs/PROVENANCE.md).
