# v0.3.5 — Negative testing and VS Code sample types

## Scope

- Grammar, parser runtime, and symbol resolver are **unchanged** from the
  user-verified v0.3.4 baseline.
- Added `fixtures/invalid-cases.json`: seven deliberately malformed cases with
  explanations. `test/negative.test.ts` checks rejection, fixture invariants,
  anti-vacuity of syntax expectations, recovery after an unexpected token,
  and incremental repair of malformed code.
- Added three native Tree-sitter `:error` corpus tests.
- Shared parse status assertion (`test/support/syntax-assertions.ts`) used for
  positive and negative fixture contracts.
- VS Code sample: explicit `@types/node`, existing `@types/vscode`, and
  `types: ["node", "vscode"]`; new `npm run check:types`. Root project uses
  `types: ["node"]`.

## Verification and limits

Local preparation performed: JSON validation, grammar structural validation,
JavaScript syntax checks, patch application and source-level consistency
checks. Actual `tree-sitter generate`, native `:error` corpus tests, WASM
parsing, Node regression tests, and sample VS Code type check **have not**
been executed in this preparation environment: npm registry access is
unavailable and the toolchain is not installed.

The v0.3.4 release is the last independently verified runtime baseline.
The additional negative cases are test hypotheses until run. If a case
fails, inspect the AST and the intended ProMeLa syntax; do not weaken
assertions or label valid-but-unsupported syntax as invalid.

## Verification on the maintainer machine

```bash
npm install
npm run check:fast
npm test
npm run test:package
# Optional: verify the isolated VS Code example's types
cd integration/vscode-extension-sample
npm install
npm run check:types
```

No repository hosting, npm publication, or VSIX packaging is triggered.
