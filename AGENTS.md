# Instructions for coding agents

This repository maintains a **derived MIT-licensed ProMeLa Tree-sitter grammar** and
its Node.js language-service prototype. It is **not** a complete SPIN frontend.
The upstream baseline is `siraben/tree-sitter-promela` at
`91da8f141c3c4c695eb71018c8a7b2e7ea39c167`. Preserve `grammar/LICENSE`.

## Read before editing

- `README.md` for a project overview and local setup.
- `docs/MAINTAINER_GUIDE.md` for component boundaries and invariants.
- `docs/TESTING.md` for the test matrix and release gate.
- `docs/COMPATIBILITY.md` for known SPIN syntax limitations.
- `CONTRIBUTING.md` for change and attribution policy.

## Commands (run from repository root)

- `npm install` for a fresh clone (once a lockfile is committed, use `npm ci`).
- `npm run check:fast` for syntax, grammar-start-rule and TypeScript checks.
- `npm run generate` to validate grammar conflicts and regenerate `parser.c`.
- `npm test` to regenerate WASM and run corpus + TypeScript tests.
- `npm run audit` to show known unsupported language features; audit is informational.
- `npm run test:package` to freshly stage and test actual package loading.
- `npm run doctor` for the local environment and release prerequisites.

## Non-negotiable invariants

1. `program` MUST remain the first rule in `grammar/grammar.js`.
2. `grammar/package.json` MUST retain `"type": "commonjs"`; root is ESM.
3. Never edit generated `grammar/src/parser.c`, `node-types.json` or WASM by hand.
4. Any grammar change needs positive AND negative syntax fixtures where relevant,
   plus named AST assertions.
   Also validate `grammar/queries/highlights.scm` against the generated language;
   `(break)` is a named node, while `"break"` would target an absent anonymous token.
5. Preserve the v0.3.1 regression tests (labels, guarded `->`, LTL, inline,
   macros, `unsigned`, incremental parsing). Do not make tests pass by suppressing
   `ERROR` or `MISSING` nodes, or by modifying valid source into nonstandard syntax.
6. Do not claim preprocessing is evaluated: directives are syntax-only. Do not
   enable Rename Symbol without cross-file and scope-safe semantics.
7. The public npm entry point is `src/index.ts`. Keep `vscode` imports out of `src/`.
8. Keep the grammar and VS Code extension separately versioned. Do not publish
   an npm package, push to GitHub, or alter a user's extension repository unless
   explicitly requested.
9. Keep `fixtures/invalid-cases.json` (malformed syntax) SEPARATE from
   `fixtures/known-gaps.json` (valid but unsupported SPIN). Preserve the test
   harness anti-vacuity check and error-recovery regression tests.
10. Document which tests were actually executed; static checks do not prove
    `tree-sitter generate` or WASM runtime behavior.

## Modifying a component

- Grammar: edit `grammar/grammar.js`, then run `npm test` and `npm run audit`.
- Symbol resolver: edit `src/definitions.ts`, add scoped reference tests.
- Packaging: change `scripts/stage-core.mjs` and run `npm run test:package`. The test must stage a fresh release; never accept a pre-existing `release/` directory as proof of a correct build.
- VS Code adapter: change `integration/vscode-extension-sample`, run extension-
  host tests separately; this package is Node/workspace-host only.

Prefer small, reviewable commits. Include negative tests for malformed source,
and avoid automatic formatting that rewrites unrelated grammar code.
