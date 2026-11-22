# v0.4.0-rc.2 verification gates

## Scope and provenance

This is a release **candidate** based on the owner's verified v0.3.6
ESLint-10 and `word: $ => $.uname` recovery branch. The owner verified
46 Node tests, 5 grammar corpus tests, 0 TODOs and independent consumer
installation **before** this new API was implemented. That earlier evidence
must not be presented as verification of the new code.

This preparation environment has no installed actual `web-tree-sitter`,
Tree-sitter CLI or Prettier packages, and cannot access the npm registry.
Static grammar checks, JavaScript syntax checks, a temporary-type-stub
TypeScript check, the three tooling tests and pure UTF-16 conversion
checks were performed. The v0.4.0 Node/WASM, package-consumer and VS Code
Extension Host tests remain unverified until run on the maintainer machine.

## On the owner's Linux machine

Start from the current branch where the recovery experiment passed and
ESLint 10 is installed. **Prefer the patch**: the full archive contains the
original root LICENSE from the build template, not the owner's customized
copyright header. The patch does not touch LICENSE or a lockfile.

```sh
patch -p1 < ~/Downloads/promela-language-core-v0.4.0-rc.1-from-v0.3.6.patch
npm install                   # updates package-lock.json to version 0.4.0-rc.1
npm run format:write          # formats the newly added TypeScript files
npm run doctor -- --strict
npm run check:lock
npm run check:quality
npm run test:all
npm audit
```

**Expected target, not claimed as verified:** 54 Node tests (46 existing +
8 new), all passing, zero TODOs, five successful native grammar corpus tests,
and an independent package consumer that imports the new API.

Then check the sample adapter independently:

```sh
cd integration/vscode-extension-sample
npm run sync:core
npm run check:types
npm run build
npm run test:extension-host
```

The Extension Host test uses VS Code and may download a VS Code build;
headless Linux CI needs an Xvfb configuration. If it cannot run in the
current environment, do not count it as passing. To meet final integration
acceptance, the actual extension must expose the same provider and preserve
all its preexisting SPIN/TextMate features, followed by VSIX verification.

## Stage and package acceptance

A proper staged tarball must contain:

- `dist/src/index.js` / `.d.ts` and the existing legacy modules;
- `dist/src/language-core.js` / `.d.ts`;
- `dist/src/source-text.js` / `.d.ts`;
- `assets/tree-sitter-promela.wasm`;
- all required third-party MIT notices.

It must **not** include development CLI or audit modules. `npm run
 test:package` packs, installs and tests the staged tarball in a temporary
consumer project. Do not publish until these tests pass.

## Known boundaries

The P0 core is document-local only. No `vscode` dependency, semantic tokens,
workspace-wide symbol index, preprocessor evaluation, or SPIN process
management is introduced. Full-text updates are intentional for P0; P1 may
add incremental edit application without changing the public full-text API.

## v0.4.0-rc.2 test and sample dependency corrections

- `initialize()` consistently returns `Promise<void>`; calling it after disposal
  rejects with `DISPOSED` instead of throwing synchronously.
- **Do not** run sample checks until the root core has been staged. A failing
  `npm run test:all` never reaches `test:package` and leaves an older staged
  package. The sample's `npm run sync:core` stages and reinstalls it.
- The sample checks that the installed runtime *and declarations* expose the
  `createLanguageCore` API, failing early if the local dependency is stale.
- The sample uses `@vscode/test-electron@2.5.2` on the Node 20 baseline.
  This is a compatibility choice for the Linux test environment, not a claim
  of successful Extension Host execution.
- Check the sample's separate dependency audit with `npm audit` in its folder;
  any advisories there are independent of the root's zero-vulnerability audit.

## Sample adapter verification without a VS Code download

The P0 language-core runtime has been verified by the maintainer: 54 Node/WASM
tests, five native corpus tests, both independent consumer tests and zero npm
audit findings. That does not establish the real extension's behavior.

The sample now has a download-free intermediate gate:

```sh
cd integration/vscode-extension-sample
npm install
npm run sync:core
npm run test:adapter
```

`test:adapter` invokes the actual registered providers against the installed
core, using a small VS Code API shim. It is **not** a substitute for the final
real Extension Host / VSIX acceptance test. For the latter, run
`npm run test:extension-host` on a machine with VS Code already installed. The
runner does not download VS Code and demands a test-completion marker, not just
a successful application exit code. To select another existing binary, set
`VSCODE_EXECUTABLE_PATH`.

Sample-only optional dependencies `@vscode/test-electron` and `@vscode/vsce`
were removed to avoid unnecessary runtime installation, download behavior
and transitive advisories. Check `npm audit` in the sample directory separately.
