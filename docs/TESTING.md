# Verification and test strategy

## Test pyramid

| Layer | Command | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Grammar static checks | `npm run check:grammar` | rule references, start symbol, CommonJS loading | parser conflicts or SPIN validity |
| Fast local checks | `npm run check:fast` | grammar structure, TS types, JS syntax | WASM works |
| Tree-sitter corpus | `npm run generate && npm run test:grammar` | concrete AST structure produced by native grammar | editor integration |
| Node/WASM regression | `npm test` | fresh generation, WASM build, Node tests and corpus | package installation or VSIX loading |
| Feature audit | `npm run audit` | list of accepted/rejected feature samples | strict all-green grammar conformance |
| Installed-package smoke | `npm run test:package` | tarball installs outside repo; imports JS and loads WASM | real VS Code activation |
| Coverage report | `npm run test:coverage` | instrumented Node test coverage | semantic correctness |
| VS Code host | future `@vscode/test-electron` suite | real DefinitionProvider and VSIX activation | web-extension support |
| SPIN differential | future `spin` executable suite | comparisons against SPIN | identical AST semantics |

## Negative syntax and error recovery (v0.3.5)

`fixtures/invalid-cases.json` contains **deliberately malformed ProMeLa**; each
case records why it is invalid. `test/negative.test.ts` asserts that every
case produces a Tree-sitter syntax error (`rootNode.hasError === true`).
`grammar/test/corpus/invalid.txt` duplicates three rejection cases in the
native grammar test runner using Tree-sitter's `:error` annotation.

A dedicated anti-vacuity test deliberately inverts both expectations:
- A valid program must fail an `invalid` assertion.
- A malformed program must fail a `valid` assertion.

Run `npm run test:negative` after a successful full build to rerun just the
negative-syntax suite. `npm test` includes it automatically.

Two error-recovery tests check that the parser still recognizes a later
declaration after a bad token, and that replacing an invalid token during an
incremental parse clears the error while preserving label/goto nodes.

These are **syntax** tests, not SPIN semantic checks: an unknown label can
still be syntactically accepted. `fixtures/known-gaps.json` separately tracks
*valid* SPIN syntax not yet recognized, such as embedded C and multiline
macros. Never merge grammar gaps into the invalid-case list.

A new negative fixture should be demonstrated invalid against SPIN where
applicable, with a stable explanation; avoid relying on incidental parser
recovery details. Include a corresponding positive/negative pair when a
related grammar rule is changed.

## The test driver

- `test/highlights.test.ts` compiles the actual highlight query against the
  WASM language and checks named/anonymous keyword captures.
- `test/negative.test.ts` checks rejection, non-vacuous assertions, and error recovery.
- `test/parser.test.ts` contains behavior-level regression tests for the public
  navigation operations and AST invariants.
- `test/conformance.test.ts` is table-driven: it reads supported cases from
  `fixtures/audit-cases.json`, excludes documented gaps in
  `fixtures/known-gaps.json`, and requires feature-specific named AST nodes.
- `grammar/test/corpus/core.txt` provides initial native Tree-sitter snapshots,
  and `invalid.txt` checks expected syntax errors.
  Add a corpus case when grammar node types, precedence or fields change.
- `npm run test:package` first executes `stage:core` (which validates the WASM fingerprint and removes all previously staged files). Then `scripts/test-package.mjs` creates an isolated temporary npm consumer,
  installs the staged tarball, runs actual JS/WASM navigation, and deletes it.
- Keep negative tests for malformed syntax separate from the explicit list
  of valid but currently unsupported ProMeLa features.

## Development commands

```bash
npm install
npm run doctor
npm run check:fast
npm test
npm run audit
npm run test:package
```

On a clean clone, `npm test` automatically rebuilds the C parser and WASM.
The `check:wasm` fingerprint rejects stale local binaries on reuse.

## Before enabling reproducible CI

`package-lock.json` was previously ignored. It is now allowed to be committed,
but this archive cannot supply a trustworthy lockfile without installing the
packages. On a networked development machine:

```bash
npm install
npm run check:fast
npm test
git add package-lock.json
```

Then update GitHub Actions from `npm install` to `npm ci` and keep it that way.
Until this is done, published reproducibility is **not yet established**.

## Test recommendations for the next milestones

- Cross-file: nested includes, paths, workspace trust, cyclic includes, macro
  redefinitions, inactive conditional branches, file deletion/rename.
- Parser: valid and invalid SPIN fixtures, C blocks, multiline macros,
  temporal syntax, channel signatures, nested typedefs, error recovery.
- Editor: UTF-16 positions around emoji/combining characters, CRLF, rapid edits,
  invalid syntax while typing, multiple open documents, cancellation/disposal.
- Packaging: install from immutable `.tgz`, bundle into VSIX, load the WASM
  without relying on `process.cwd()`, review published file list.
- Regression policy: each bug requires a fixture and a precise expected AST or
  resolved symbol target. Avoid changing tests just to make them green.

## Interpreting results

The 17 passing v0.3.1 tests are the existing verified baseline. This
maintenance iteration adds new tests and packaging checks; they are **not
runtime-verified** until you run the commands above with the real CLI/runtime.
`npm run audit` is intentionally non-strict because valid but unsupported
features are tracked. A `0` exit code from audit is not full SPIN coverage.

## Package staging and stale-file prevention (v0.3.4)

The staging command `npm run stage:core` deletes and recreates
`release/promela-language-core/`, copying only the public modules
(`index`, `parser`, `definitions`) and the required WASM/license files.
The standalone `npm run test:package` command **always** runs staging first.
Earlier versions directly tested an existing staging directory, so old
`dist/src/audit.js` and `dist/src/cli.js` files could make the smoke test fail.

To verify the cleanup manually after a successful build:

```bash
mkdir -p release/promela-language-core/dist/src
touch release/promela-language-core/dist/src/audit.js
npm run test:package
# The command should clean the staged audit.js before packing.
```

`npm run test:package` is a distribution smoke test; it does not run the
full parser regression suite. Use `npm run test:all` before release.
There is no automatic npm publish or GitHub push.

## Development-tooling gate (v0.3.6)

`npm run test:tooling` exercises the lockfile metadata validator. `npm run
check:quality` includes TypeScript/grammar/static checks and ESLint. CI now
uses `npm ci`, so a real, committed `package-lock.json` is required. The
Prettier check is opt-in until a separately reviewed initial formatting pass.
See `docs/TOOLING-v0.3.6.md` for migration commands.
