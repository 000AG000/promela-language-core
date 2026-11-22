# Provenance, derivation and distribution

**Current repository:** [000AG000/promela-language-core](https://github.com/000AG000/promela-language-core)  
**Development package:** `promela-tree-sitter-wasm-lab` (`private: true`)  
**Distributable package:** `promela-language-core` (currently `0.5.0-rc.1`)

## Original project and upstream grammar

The root [MIT license](../LICENSE) identifies **Alexander Gundermann (2026)** as the copyright holder for the original language-core contributions.

The grammar in `grammar/grammar.js` is derived from Ben Siraphob's MIT-licensed [`siraben/tree-sitter-promela`](https://github.com/siraben/tree-sitter-promela), initially based on upstream commit [`91da8f141c3c4c695eb71018c8a7b2e7ea39c167`](https://github.com/siraben/tree-sitter-promela/commit/91da8f141c3c4c695eb71018c8a7b2e7ea39c167) (11 February 2022). The original copyright and permission notice remain in [`grammar/LICENSE`](../grammar/LICENSE) and are included in staged packages as `THIRD_PARTY_LICENSES/siraben-tree-sitter-promela-MIT.txt`.

This attribution distinguishes independently developed language-service code from the upstream grammar and does not imply upstream authorship of the whole library.

## Runtime dependencies and generated artifacts

The project uses Tree-sitter tooling and `web-tree-sitter@0.27.2` (MIT). The staged npm package includes the applicable notices under `THIRD_PARTY_LICENSES/`, including the upstream grammar, Tree-sitter and the `web-tree-sitter` runtime.

The bundled `tree-sitter-promela.wasm` is generated from the derived grammar. Its SHA-256 build fingerprint detects stale local build outputs; it is **not** a supply-chain attestation, signed provenance statement, or proof of reproducible builds.

`SPIN` is **not included** in the library. Any future SPIN bundling would require an independent license review.

## Distribution status

The source repository is publicly hosted on GitHub. The `promela-language-core` npm tarball is created locally using `npm run pack:core`, which stages compiled JavaScript, TypeScript declarations, WASM and licenses. GitHub Releases and npm-registry publication are **separate operations**; repository availability must not be mistaken for an npm-registry release. The exact availability of release assets should be checked on the [repository Releases page](https://github.com/000AG000/promela-language-core/releases).

For current functionality and installation instructions, see the [README](../README.md). The [pre-publication review](PREPUBLICATION_REVIEW.md) records older v0.3.1–v0.3.2 decisions and is not the current source of release status.
