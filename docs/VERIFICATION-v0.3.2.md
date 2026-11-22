# Verification record — maintenance candidate v0.3.2

## Prior externally executed baseline

The project owner executed the v0.3.1 suite and reported 17/17 tests passing,
successful grammar/WASM/TypeScript builds, a non-strict audit with two known
gaps (embedded C and multiline macros), release staging and `npm pack --dry-run`.
These results establish v0.3.1, not v0.3.2, as the runtime-verified baseline.

## Checks executed while preparing v0.3.2

- `node scripts/check-grammar.mjs`: pass, unchanged grammar, 79 rules,
  `program` first; CommonJS import succeeds.
- `node scripts/check-scripts.mjs`: pass for 12 `.mjs` scripts.
- `sh -n scripts/hooks/pre-commit scripts/hooks/pre-push`: pass.
- TypeScript syntax/transpilation: pass on new `conformance.test.ts`.
  **This is not a full typecheck.**
- Corpora S-expression parenthesis balance: pass on initial two examples.
- `node scripts/doctor.mjs`: detected intentionally absent npm lockfile and
  runtime modules (not included in ZIP).
- Simulated release staging with placeholder artifacts: pass; no `audit.js`
  or `cli.js` leak. `npm pack --dry-run --json` recognized the package.
- Opt-in hook installation in a throwaway Git repo: pass; set `core.hooksPath`
  locally and did not touch a user's repository.

## Checks not executed here

- Actual `tree-sitter generate`, `tree-sitter test`, WASM compilation.
- TypeScript full typechecking with installed real dependencies.
- v0.3.2 Node integration and table-driven AST tests.
- Actual npm consumer install and module/WASM load (no registry access).
- VS Code host integration or SPIN differential validation.

These checks must pass on the developer's machine before treating v0.3.2 as a
new tested baseline. Do not use the simulated staging test as proof of runtime
correctness.
