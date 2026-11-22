import { existsSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Run this only after npm test or at least check:wasm. It stages a distributable
// runtime package with no dependency on the grammar CLI or the repo cwd.
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'release/promela-language-core');
const wasm = resolve(root, 'assets/tree-sitter-promela.wasm');
const compiled = resolve(root, 'dist/src/index.js');
if (!existsSync(wasm) || !existsSync(compiled)) {
  throw new Error('Missing WASM or compiled TS. Run npm test first.');
}
const stamp = readFileSync(resolve(root, 'assets/tree-sitter-promela.build.sha256'), 'utf8').trim();
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
if (!/^[0-9a-f]{64}$/.test(stamp)) throw new Error('Missing/invalid WASM fingerprint');
rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, 'dist/src'), { recursive: true });
mkdirSync(resolve(out, 'assets'), { recursive: true });
mkdirSync(resolve(out, 'THIRD_PARTY_LICENSES'), { recursive: true });
// Ship only modules reachable from the public index, not development CLI/audit tools.
for (const moduleName of [
  'index',
  'parser',
  'definitions',
  'language-core',
  'source-text',
  'semantic-index',
]) {
  for (const suffix of ['.js', '.js.map', '.d.ts']) {
    const name = moduleName + suffix;
    copyFileSync(resolve(root, 'dist/src', name), resolve(out, 'dist/src', name));
  }
}
copyFileSync(wasm, resolve(out, 'assets/tree-sitter-promela.wasm'));
copyFileSync(
  resolve(root, 'assets/tree-sitter-promela.build.sha256'),
  resolve(out, 'assets/tree-sitter-promela.build.sha256'),
);
copyFileSync(resolve(root, 'LICENSE'), resolve(out, 'LICENSE'));
copyFileSync(
  resolve(root, 'grammar/LICENSE'),
  resolve(out, 'THIRD_PARTY_LICENSES/siraben-tree-sitter-promela-MIT.txt'),
);
copyFileSync(
  resolve(root, 'licenses/Tree-sitter-MIT.txt'),
  resolve(out, 'THIRD_PARTY_LICENSES/tree-sitter-MIT.txt'),
);
const webLicense = resolve(root, 'node_modules/web-tree-sitter/LICENSE');
if (existsSync(webLicense))
  copyFileSync(webLicense, resolve(out, 'THIRD_PARTY_LICENSES/web-tree-sitter-MIT.txt'));
else throw new Error('Missing web-tree-sitter LICENSE; check installed package before release');
const manifest = {
  name: 'promela-language-core',
  version,
  type: 'module',
  license: 'MIT',
  description: 'ProMeLa Tree-sitter WebAssembly parser and semantic index (Node.js)',
  engines: { node: '>=20.11' },
  main: './dist/src/index.js',
  types: './dist/src/index.d.ts',
  exports: { '.': { types: './dist/src/index.d.ts', import: './dist/src/index.js' } },
  files: ['dist/src', 'assets', 'LICENSE', 'THIRD_PARTY_LICENSES', 'README.md'],
  dependencies: { 'web-tree-sitter': '0.27.2' },
};
writeFileSync(resolve(out, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(
  resolve(out, 'README.md'),
  `# promela-language-core v${version}

This npm package includes the ProMeLa WASM grammar and the TypeScript/JS
shared symbol/reference index, batch semantic tokens, and a versioned editor-facing document API. It is a Node.js module, not a VS Code web extension.

\`createPromelaParser()\` loads the packaged WASM using module-relative paths.
The core web-tree-sitter runtime is provided by the runtime npm dependency.

Third-party licenses are preserved in THIRD_PARTY_LICENSES/.
Preprocessor directives are syntax-only; they are not evaluated.
`,
);
console.log('Staged npm package:', out);
console.log('Inspect with: npm pack --dry-run ./release/promela-language-core');
