# v0.3.3 verification status

This candidate changes **only the highlight query, testing/docs, and version**.
The grammar source, TS parser, definition resolver, and generated WASM algorithm
are unchanged from v0.3.2.

- The user previously verified v0.3.1 with 17/17 Node tests.
- The user tested v0.3.2: grammar generation + WASM compilation succeeded; two
  native corpus cases passed; `tree-sitter test` stopped on the invalid
  anonymous `"break"` query pattern before running the Node tests.
- v0.3.3 fixes `"break"` to `(break)` and adds two runtime highlight-query tests.
- This build environment has no npm dependencies/Tree-sitter CLI available and
  cannot execute `tree-sitter generate` or the WebAssembly runtime suite.
  Source/syntax/patch checks done here are not substitutes for actual tests.

Run on the networked developer machine:

```bash
npm install
npm test
npm run audit
npm run test:all
```

Acceptance: native corpus + queries compile, Node/WASM tests (including
highlight captures) pass, then isolated npm package consumer passes. No files
are published and no GitHub remote is needed.
