# ProMeLa core — VS Code integration sample

This sample is a **reference adapter**. It does not replace your actual extension,
its TextMate grammar, SPIN simulation/diagnostics, command registration or
cancellation logic. The published language core has no `vscode` dependency.

## Build and synchronization

After the root project's `npm run test:all` succeeds:

```sh
cd integration/vscode-extension-sample
npm install
npm run sync:core
npm run check:types
npm run build
```

`sync:core` stages the current compiled core, refreshes its `file:` package
and checks that `createLanguageCore` and its declarations are available.
Type checks and builds reject a stale installed dependency instead of hiding
missing exports. Sample dependencies are **separate** from the root project.

## Default integration test: no VS Code download

```sh
npm run test:adapter
```

This runs a Node.js test against **the actual compiled DefinitionProvider and
DocumentSymbolProvider** registered by the sample, with the actual staged
ProMeLa WASM core, and a minimal mock of the VS Code API. It verifies F12,
unsaved edits, symbols, cancellation, unresolved references and disposal.
It does **not** start Electron, install VS Code, download any application, or
claim to be a real VS Code Extension Host test.

The providers live in `src/providers.ts`, with a runtime-injected `vscode`
argument (type-only `import type` dependency). `src/extension.ts` registers
the *same* providers against the real VS Code module. There is no parallel
implementation to drift from production behavior.

## Optional real Extension Host test — use local VS Code

Run only when you explicitly want to verify the real VS Code API:

```sh
npm run test:extension-host
```

This requires the installed **VS Code GUI/Electron executable**, not merely the `code` CLI wrapper. On standard Ubuntu installations, the runner resolves `/usr/bin/code` to `/usr/share/code/code` automatically. You may also pass an explicit executable path:

```sh
VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:extension-host
```

The runner launches the Electron application directly rather than using the CLI wrapper, which can exit before the test executes. It launches a **separate temporary user profile** to avoid interfering with
your running editor. It makes no network requests and never downloads VS Code.
If no local executable exists, it fails with a helpful message.

The runner checks for an explicit success marker written **after** the actual
Extension Host assertions have executed. A process exit code of zero on its
own does not count as a passing test. Do not confuse unrelated warnings from
VS Code's bundled GitHub/Copilot extensions with errors from this adapter.

The real-host assertions check `vscode.executeDefinitionProvider` and F12
after an unsaved editor edit. They are optional during development but should
pass before declaring the production extension release-ready. The actual
extension and packaged VSIX still require their **own** end-to-end testing,
including preservation of SPIN and TextMate functionality.

## Dependency security

The reference sample no longer depends on `@vscode/test-electron` or
`@vscode/vsce`, because no test download or sample publishing is necessary.
The actual extension can own VSIX packaging. After updating this manifest,
run `npm install` inside **this directory** to prune the old packages, then
`npm audit` to inspect any advisories that remain. Do not blindly use
`npm audit fix --force`.

`@types/vscode` remains a development dependency for TypeScript checks. The
project's `tsconfig.json` explicitly lists only `node` under `types` because
`import 'vscode'` automatically loads the module declarations.

### Optional host-test diagnostics

If the test still fails, verify that the GUI executable exists:

```sh
ls -l /usr/share/code/code
VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:extension-host
```

The installed VS Code must be able to start a graphical Electron window on
your machine. This is a heavier **optional** acceptance test, not part of the
fast `test:adapter` command. A dedicated process must complete the host
assertions; exiting zero without a result marker is always a failure.

`test:adapter` also runs small launcher-regression checks without starting VS
Code, ensuring the runner distinguishes the GUI executable from the CLI
wrapper and rejects false-positive exit codes.
