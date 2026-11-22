# v0.3.4 packaging workflow correction

## Diagnosis

The project owner verified 34/34 Node tests and 2/2 Tree-sitter corpus tests
on v0.3.3. Direct `npm run test:package` failed because it checked an old
`release/promela-language-core/dist/src/audit.js` file left over from an
earlier staging implementation. The current `scripts/stage-core.mjs` already
removes the release directory and ships only the public modules. However,
`test:package` did not invoke staging first.

## Changed

- `npm run test:package` runs `npm run stage:core` before consumer smoke tests.
- `npm run test:all` invokes the packaged test once without redundant staging.
- CI performs the consumer package test before inspecting the final tarball.
- Docs describe stale-artifact behavior and package smoke test boundaries.

No grammar or TypeScript semantic-resolution changes. No public release.

## Verification

- Package manifest JSON validated.
- JavaScript syntax of staging/consumer scripts validated.
- Simulated staging exercise (with placeholder outputs) confirms obsolete
  `audit.js` is deleted and only approved runtime modules are copied.
- Simulated tarball dry-run confirms development modules are excluded.
- Real installed-consumer test **not executed** in the preparer's environment
  (npm registry is unavailable there); run `npm run test:package` locally.
