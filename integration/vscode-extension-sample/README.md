# VS Code adapter sample (Node.js extension host)

This is a **reference adapter**, not a modification of your existing extension.
Do not publish it alongside an extension that already contributes the `promela`
language ID; merge only its providers into that extension.

From the repository root:

```bash
npm install
npm run release:core
cd integration/vscode-extension-sample
npm install   # Run INSIDE this sample folder; root npm install is not enough
npm run check:types
npm run build
npx @vscode/vsce ls --no-dependencies
```

For a local extension development host, open this folder in VS Code and run
`code --extensionDevelopmentPath=.` or use a standard extensionHost launch.json.
For a .vsix, first install a **tarball** (not a symlinked local directory):

```bash
cd ../../release/promela-language-core
npm pack
cd ../../integration/vscode-extension-sample
npm install --save ../../release/promela-language-core/promela-language-core-0.3.5.tgz
# Replace the sample `publisher` in package.json before public publication.
npm run package:vsix
```

Then inspect the `.vsix` with `unzip -l *.vsix`. This is an example
workflow; no actual VSIX was built in the preparation environment.

Before a production release:
* Verify that VSIX contains `node_modules/promela-language-core/assets/tree-sitter-promela.wasm`,
  core compiled JS, web-tree-sitter runtime JS and its WASM, and the notices.
* Test in a real Extension Development Host: Ctrl+click a quoted relative #include path, a `goto` label, inline
  call, macro reference, process call, variable, typedef field.
* Do not use this sample for cross-file or preprocessed-source navigation.
* `vscode`'s ESM support here needs Node extension host / VS Code >=1.100.
  For older VS Code, bundle an appropriate CommonJS extension instead.
* Keep the Node-only core separate from a potential browser adapter. For web
  use Uint8Array loading through `vscode.workspace.fs`, not Node `fs` paths.

## TypeScript type definitions

This example explicitly lists `"types": ["node", "vscode"]` in its own
`tsconfig.json`. Both `@types/node` and `@types/vscode` are **devDependencies of
this sample**, not the repository root. If VS Code reports
`Cannot find type definition file for 'vscode'`, run `npm install` in this
`integration/vscode-extension-sample` directory (after staging the core), then
run `npm run check:types`. Do not silence the compiler diagnostic: a sample
should compile cleanly.

## TypeScript in a nested sample

This is a separate npm project. Run `npm install` **in this directory**
(after staging the core), then `npm run check:types`. `@types/vscode`
is a dev dependency and is resolved via `import * as vscode from 'vscode'`;
it need not appear under `compilerOptions.types`. The sample explicitly
includes Node globals with `"types": ["node"]`.

When the CLI type check passes but VS Code still shows the old diagnostic,
run **TypeScript: Restart TS Server** and then **Developer: Reload Window**.
The IDE should not suppress diagnostics for this sample.
