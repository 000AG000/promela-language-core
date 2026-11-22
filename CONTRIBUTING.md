# Contributing to the ProMeLa Language Core

This project builds on the MIT-licensed grammar by Ben Siraphob. See
`grammar/LICENSE` and `docs/PROVENANCE.md`. Keep both the original attribution
and notices for dependencies in any redistributed package.

## Local prerequisites

- Node.js 20.11+ and npm, plus a C/WASM toolchain fetched by Tree-sitter's CLI
  when needed. A SPIN executable is optional for future differential tests.
- Work without GitHub: `git init -b main` is enough for local commits.
- Install dependencies with `npm install`. **Before any public release**,
  commit the generated `package-lock.json` and update CI to use `npm ci`.

## Development workflow

1. Read `docs/MAINTAINER_GUIDE.md` and `docs/TESTING.md`.
2. Create one focused branch, e.g. `git switch -c fix/ltl-parentheses`.
3. Add a regression fixture first. For parser shape, use a Tree-sitter corpus
   test and/or a TypeScript test with node-type/field assertions. Add malformed
   inputs to `fixtures/invalid-cases.json`, NOT `known-gaps.json`, and use
   `:error` corpus cases where the grammar must reject specific syntax.
4. Run `npm run check:fast` while iterating; run `npm test` before pushing.
5. Run `npm run audit`. Known gaps may remain red, but a new positive feature
   should not regress an existing case.
6. For distribution changes, run `npm run stage:core && npm run test:package`.
7. Record command output and remaining limitations in the change description.

## Optional tracked Git hooks

After `git init -b main` and `npm install`, run `npm run hooks:install`. This
sets local `core.hooksPath=scripts/hooks`; no global configuration changes.
`pre-commit` runs quick structural and TypeScript checks. `pre-push` runs the
full generator/WASM test suite. Hooks are conveniences, **not** substitutes
for CI and code review. To opt out: `git config --local --unset core.hooksPath`.

## Compatibility and public API

The grammar is not the whole SPIN language. File a fixture demonstrating any
unsupported valid ProMeLa syntax, ideally with the matching `spin` result.
Keep the package's public API small (`src/index.ts`) and version changes to
AST node kinds or exported TypeScript types carefully: they can break editor
consumers even when the grammar still parses.

## Release checklist

Do not publish until all steps in `docs/TESTING.md` pass, licensing is reviewed,
version/provenance are documented, and a separate VS Code consumer actually
loads the tarball. Production publishing, GitHub setup and VSIX distribution
are distinct deliberate actions.

## Static analysis and formatting (v0.3.6)

Run `npm run check:quality` before committing. Check `npm run lint` output and
fix genuine issues. Formatting is opt-in for now (`npm run format:check` /
`npm run format:write`); schedule the first bulk formatting pass as its own
reviewable commit. Commit `package-lock.json` after updating dependencies and
confirm `npm ci` on a clean checkout. See `docs/TOOLING-v0.3.6.md`.
