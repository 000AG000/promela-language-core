# Repository maintenance tooling (v0.3.6)

This is a **tooling-only candidate**: grammar, resolver, public API, and
published WASM asset staging are unchanged from the verified v0.3.5.1.

## First checkout / migration from v0.3.5.1

1. Apply the patch in your existing repository. This preserves your customized
   root `LICENSE` and TypeScript settings.
2. Run `npm install` at the project root to install ESLint and Prettier and
   **generate a real `package-lock.json`** using npm. The archive intentionally
   does not fabricate a lockfile because resolution and integrity hashes must
   come from the npm registry.
3. Run `npm run doctor -- --strict` and `npm run check:lock`.
4. Run `npm run check:quality` (TypeScript, scripts, tests of tooling, linting).
5. Run `npm run test:all` (generates parser and WASM, corpus, Node tests, and
   isolated tarball consumer). Then `npm run audit`.
6. Test `npm ci --no-audit --no-fund` in a clean checkout/clone before CI.
7. Commit `package-lock.json` with the tooling changes. This is required by CI.

The sample VS Code extension is a separate npm project: its dependencies and
lockfile must be installed and maintained from its own directory if that
example is to be built. It is excluded from root lint/format and CI for now.

## Tooling commands

| Command | Purpose |
| --- | --- |
| `npm run doctor` | Show diagnostic results; warn if lockfile absent |
| `npm run doctor -- --strict` | Fail if lockfile absent or stale; suitable before a release |
| `npm run check:lock` | Fail on missing/stale lockfile metadata |
| `npm run test:tooling` | Run tests for lockfile-validation logic |
| `npm run check:fast` | Grammar, TS types, script syntax, tooling unit tests |
| `npm run lint` | ESLint 9 flat configuration for source, tests, and build scripts |
| `npm run check:quality` | Fast checks plus lint |
| `npm run format:check` | Check existing maintained JS/TS source formatting |
| `npm run format:write` | Apply Prettier to maintained JS/TS source |
| `npm run test:all` | Full fresh WASM and installed-package suite |

## Formatting migration policy

Prettier has been **configured, not auto-applied**. The current source contains
pre-existing formatting choices. `format:check` may fail until its first
one-time migration. To avoid an unrelated rewrite while reviewing this tooling
change, DO NOT add `format:check` to commit hooks or CI yet.

When ready, create a dedicated commit that runs `npm run format:write`,
review the resulting diff, rerun `npm run test:all`, and then enable
`format:check` in CI and pre-commit hooks. The grammar DSL in `grammar/grammar.js`
is intentionally excluded from this first formatting pass.

ESLint is active in CI. `npm run lint` needs to be run once with the real npm
dependencies; correct genuine violations, but do not disable the checks just to
make the pipeline green. The ESLint configuration is intentionally narrow and
only disables non-null assertions (already used in reviewed AST code) and the
redundant `no-undef` check on TypeScript source (the TypeScript compiler handles
this).

## CI and Git

CI now uses **`npm ci`**. This requires `package-lock.json` to be committed,
and deliberately fails without it. It checks lockfile metadata, executes
quality checks, tests the grammar/WASM/runtime/installed npm tarball, and audits
language-feature support.

Install tracked hooks only if desired with `npm run hooks:install`. Pre-commit
runs `check:quality`, pre-push runs `test:all`. GitHub is not required for local
Git use. No npm or VSIX publication happens in these commands.

## What remains outside this milestone

- Real extension-host/VSIX tests.
- Full SPIN language conformance and preprocessing semantics.
- Benchmark and UTF-16/CRLF navigation tests.
- Full formatting migration and enforcement.
- Actual dependency security review (especially VS Code sample dev tooling).
