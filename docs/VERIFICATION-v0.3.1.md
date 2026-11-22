# v0.3.1 verification record

## User-observed failure in v0.3.0

- `tree-sitter generate` and WASM compilation succeeded.
- The first grammar rule was `preprocessor_directive`, changing the start symbol.
- The user-observed test results were 1/17 passed; 16/17 failed with `rootNode.type === "ERROR"`.

## v0.3.1 correction

- Restored `program` as the first grammar rule.
- Added an explicit start-symbol invariant to `scripts/check-grammar.mjs`.
- Versioned the root package and staged library as 0.3.1.

## What this package preparation verified

- `npm run check:grammar` and direct JavaScript syntax checks.
- Negative test: moving `preprocessor_directive` before `program` must fail `check:grammar`.
- Patch application against the original v0.3.0 archive.

## Still requires actual npm/Tree-sitter execution

This preparation environment cannot connect to npm and has no pre-installed
`tree-sitter-cli`. We cannot claim the 17 runtime tests have passed with this
change. Execute `npm install && npm test && npm run audit && npm run release:core`
on a machine that can download the dependencies.
