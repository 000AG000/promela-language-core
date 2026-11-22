/**
 * Stage the local language core and refresh the extension sample's installed
 * file: dependency. npm install alone can reuse a stale package snapshot.
 * Use --check from prebuild/precheck:types to fail with actionable advice.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sample = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = resolve(sample, '../..');
const stage = resolve(root, 'release/promela-language-core');
const installed = resolve(sample, 'node_modules/promela-language-core');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const advice = 'From integration/vscode-extension-sample, run: npm run sync:core';

function manifest(path) {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function verify() {
  const rootVersion = manifest(resolve(root, 'package.json'))?.version;
  const stageVersion = manifest(resolve(stage, 'package.json'))?.version;
  const installedVersion = manifest(resolve(installed, 'package.json'))?.version;
  const entry = resolve(installed, 'dist/src/index.js');
  const typings = resolve(installed, 'dist/src/index.d.ts');
  if (
    !rootVersion ||
    stageVersion !== rootVersion ||
    installedVersion !== rootVersion ||
    !existsSync(entry) ||
    !existsSync(typings) ||
    !readFileSync(entry, 'utf8').includes('createLanguageCore') ||
    !readFileSync(typings, 'utf8').includes('createLanguageCore')
  ) {
    throw new Error(`The VS Code sample is using a missing or stale language core. ${advice}`);
  }
  console.log(`Verified installed ProMeLa core ${installedVersion} with the v0.4 document API.`);
}

if (process.argv.includes('--check')) {
  verify();
} else {
  console.log('Staging the current ProMeLa core (WASM + compiled JS + types)...');
  execFileSync(npm, ['run', 'stage:core'], { cwd: root, stdio: 'inherit' });
  // npm may retain an old file: package even when the staged files changed.
  // Only remove this one locally installed dependency; never delete stage.
  rmSync(installed, { recursive: true, force: true });
  execFileSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: sample, stdio: 'inherit' });
  verify();
}
