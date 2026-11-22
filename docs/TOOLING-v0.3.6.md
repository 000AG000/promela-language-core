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
| `npm run check:quality` | Fast checks, lint, and formatting gate |
| `npm run format:check` | Check existing maintained JS/TS source formatting |
| `npm run format:write` | Apply Prettier to maintained JS/TS source |
| `npm run test:all` | Full fresh WASM and installed-package suite |

## Formatting migration policy

The initial formatting pass is **a distinct commit from the gate update**.

1. On the committed v0.3.6 baseline, run `npm run format:write` at the root.
   This formats maintained TypeScript and build scripts (not the derived
   `grammar/` sources, tooling tests, fixtures, the integration sample, or
   generated files).
2. Run `git diff --check`, `npm run format:check`, `npm run check:quality`,
   `npm run test:all` and review `git diff --stat` and `git diff`.
3. Commit the resulting formatting-only changes, e.g.
   `git commit -am "style: establish Prettier baseline"`. Include only reviewed
   files; Git ignores generated output.
4. Apply the `format-gate` patch, which makes `check:quality` include
   `format:check`. CI and the tracked pre-commit hook already run
   `check:quality`, so the gate is enforced in both places.
5. Run `npm run check:quality && npm run test:all`, then commit the gate as a
   second change, e.g. `git commit -am "chore: enforce Prettier formatting"`.

If a previous pre-commit hook blocks the first formatting commit, run and
review `npm run format:check`; only bypass the hook when absolutely necessary.
The gate runs on the entire maintained-source set, not just staged files.

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
runs `check:quality` (including formatting), pre-push runs `test:all`. GitHub is not required for local
Git use. No npm or VSIX publication happens in these commands.

## What remains outside this milestone

- Real extension-host/VSIX tests.
- Full SPIN language conformance and preprocessing semantics.
- Benchmark and UTF-16/CRLF navigation tests.
- Additional formatting for documentation or the separate VS Code sample, if desired.
- Actual dependency security review (especially VS Code sample dev tooling).
