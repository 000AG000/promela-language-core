# Verification record

This document distinguishes what was executed in the creation environment from what requires a machine with npm registry access and the Tree-sitter CLI.

## Actually run here

Updated v0.2.1: the grammar directory now has its own CommonJS package scope. A real Node ESM-to-CommonJS import was executed successfully, and the offline grammar check now includes this loading test.

- `node --check grammar/grammar.js`: **passed** (JavaScript syntax).
- `node --check scripts/*.mjs`: **passed** (JavaScript syntax).
- `node scripts/check-grammar.mjs`: **passed** (74 rules; all 73 referenced symbols exist; real Node CommonJS-from-ESM import succeeds).
- `tsc -p tsconfig.json`: **passed with temporary external API declaration stubs** for `web-tree-sitter@0.27.2` and a local Node 22 type declaration set. This is a syntax/type smoke check, **not** an official installation build and does not validate the full upstream declaration package.
- JSON parse and artifact checks: **passed**.

## Not run here

- `npm install`: networking to npm was unavailable.
- `tree-sitter generate`: CLI binary unavailable. This also means the explicit LTL conflict declaration has not yet been verified by actual parser-table generation.
- `tree-sitter build --wasm`: CLI + WASI toolchain unavailable.
- `npm test` with real `web-tree-sitter`: no compiled WASM or runtime package available here.

**Do not describe the project as passing the full test suite until `npm run setup` actually completes.** The GitHub Actions workflow is configured to exercise the full pipeline on a network-enabled runner. Report any generator conflict verbatim; the static checks cannot detect every grammar ambiguity.

## First verification on your computer

```bash
npm install
npm run check:grammar
npm run generate
npm run build:wasm
npm test
npm run audit
```

If `generate` fails, the **first** error block is the actionable one. The grammar file is tracked and immutable under the build scripts; there is no idempotency marker or hidden overlay.


## v0.2.2 label-precedence correction

The user's 0.2.1 run established 8 passing tests, with the original
`goto done; done: skip;` fixture failing to parse. The targeted change raises
`labeled_step` precedence from 2 to 20, above `cmpnd` precedence 18. Cross-process
label-resolution and remote-reference expression regression tests were added. This is a
**hypothesis to verify with the real generator/runtime**, not an executed
WASM success claim. Neither the CLI nor npm dependencies are available
in this delivery environment; run `npm run setup` to validate.


## v0.2.3 — explicit label/remote-ref conflict and stale-build protection

User's v0.2.2 run: the grammar **did not generate**; Tree-sitter suggested a
conflict among `labeled_step`, `pfld`, and `expr`. Following `npm test` used an
older WASM and reported 9 passes, 2 failures. The 9 passes **do not** validate
the v0.2.2 grammar change. The grammar now declares that explicit conflict and
uses a small dynamic precedence for completed labels.

The build/test scripts were hardened: `npm test` regenerates and rebuilds the
WASM first, and a SHA-256 fingerprint rejects stale WASM for `parse`, `audit`
and `test:compiled`. The generator/runtime outcome is **not verified** here,
because the preparation environment lacks installed npm dependencies and CLI.

## v0.2.4 — pending actual runtime verification

User-provided output verifies the **previous v0.2.3** baseline with 11/11
passes, `generate`, WASM compilation, and a valid `labeled_step` AST. This is
not a v0.2.4 verification. The inline grammar, AST assertions, and resolver
changes have been reviewed and statically checked; npm access is unavailable
in the preparation environment, so parser generation and runtime tests remain
unverified. Run `npm run generate && npm test` and treat any conflicts as
real compatibility work, not as test failures to skip.
