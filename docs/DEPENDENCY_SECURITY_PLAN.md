# Dependency and security maintenance (after formatting baseline)

**Do not mix these changes into the first Prettier commit.** The initial
ESLint 9 / `typescript-eslint` 8.46.0 toolchain passed on the user's machine,
so preserve it as the baseline until the formatting gate is green.

## Current findings (2026-11-21)

- `eslint@9.39.1` is end-of-life; the supported current major is ESLint 10.
- The root project's `npm audit` reported seven moderate advisories through
  a transitive `minimatch` dependency of `typescript-eslint@8.46.0`.
- Advisory `GHSA-g3hv-75wg-m249` identifies `minimatch` versions below
  11.0.1 as affected, including 10.x. The replacement major can change APIs.
- The nested VS Code extension sample has its **own** dependency tree and
  must be audited separately.
- These are development-toolchain findings; assess production exposure with
  `npm audit --omit=dev` rather than assuming the distributable WASM has
  the same vulnerabilities.

## Proposed separate dependency commit

1. Save current findings before upgrades:

   ```bash
   npm audit || true
   npm ls minimatch || true
   npm explain minimatch || true
   npm audit --omit=dev || true
   ```

2. Upgrade pinned lint dependencies to a supported combination (versions
   verified as published on 2026-11-21):

   ```bash
   npm install --save-dev --save-exact \
     eslint@10.15.0 @eslint/js@10.0.1 typescript-eslint@8.73.0
   ```

3. ESLint 10 requires Node >=20.19.0 on the Node 20 line; when upgrading,
   adjust the root `engines.node` and `doctor` version check accordingly,
   keeping Node 22 CI or moving to Node 24 as a separate tested decision.
4. Run `npm run doctor -- --strict`, `npm run check:lock`,
   `npm run check:quality`, `npm run test:all`, `npm audit`, and
   `npm audit --omit=dev`. Review actual lint rule differences; ESLint 10
   is a major migration, so never infer that the old config works unchanged.
5. Check `npm ls minimatch` again. If the advisory persists, **do not add a
   global `minimatch: 11.x` override** without compatibility tests: other
   packages may depend on the 10.x API. Prefer upstream fixes and document
   any remaining dev-only advisory with its risk and tracking link.
6. Inspect the separate example project:

   ```bash
   (cd integration/vscode-extension-sample && npm audit)
   ```

7. Commit the regenerated `package-lock.json` together with any tested
   manifest/config changes, in a commit separate from formatting.

## Release checks

`npm audit --omit=dev` is a useful check for the core's production dependency
surface, but a full `npm audit` may still identify vulnerable developer tools.
Document outstanding issues instead of using `npm audit fix --force` to make
reports appear clean. The release tarball does not contain ESLint.

Sources:
- https://eslint.org/version-support/
- https://eslint.org/docs/latest/use/migrate-to-10.0.0
- https://typescripteslint.com/users/dependency-versions/
- https://github.com/advisories/GHSA-g3hv-75wg-m249
