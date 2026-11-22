import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveVSCodeExecutable } from '../scripts/resolve-code-executable.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runner = join(root, 'scripts/test-extension-host.mjs');

function withFakeInstall(callback) {
  const temp = mkdtempSync(join(tmpdir(), 'promela-vscode-launcher-test-'));
  const install = join(temp, 'app');
  const bin = join(install, 'bin');
  mkdirSync(bin, { recursive: true });
  const cli = join(bin, 'code');
  writeFileSync(cli, '#!/bin/sh\nexit 0\n');
  chmodSync(cli, 0o755);
  const executable = join(install, 'code');
  writeFileSync(executable, '#!/bin/sh\nexit 0\n');
  chmodSync(executable, 0o755);
  const symlink = join(temp, 'code');
  symlinkSync(cli, symlink);
  try {
    callback({ temp, cli, executable, symlink });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test('Linux launcher resolves installed application binary instead of CLI wrapper', () => {
  withFakeInstall(({ cli, executable, symlink }) => {
    assert.equal(resolveVSCodeExecutable({ platform: 'linux', configured: cli }), executable);
    assert.equal(resolveVSCodeExecutable({ platform: 'linux', searchPath: join(symlink, '..') }), executable);
    assert.equal(resolveVSCodeExecutable({ platform: 'linux', configured: executable }), executable);
  });
});

test('Extension Host runner fails closed if application returns zero without assertions', () => {
  withFakeInstall(({ executable }) => {
    const result = spawnSync(process.execPath, [runner], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, VSCODE_EXECUTABLE_PATH: executable },
      timeout: 10_000,
    });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /without executing the ProMeLa test assertions/);
  });
});

test('Extension Host runner accepts only an explicit assertion result marker', () => {
  withFakeInstall(({ executable }) => {
    writeFileSync(executable, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(process.env.PROMELA_E2E_RESULT_FILE, JSON.stringify({status:'passed', test:'promela-definition-provider'}));\n`);
    chmodSync(executable, 0o755);
    const result = spawnSync(process.execPath, [runner], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, VSCODE_EXECUTABLE_PATH: executable },
      timeout: 10_000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS: real VS Code DefinitionProvider/);
  });
});


test('Extension Host runner reports a failed assertion marker as failure', () => {
  withFakeInstall(({ executable }) => {
    writeFileSync(executable, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(process.env.PROMELA_E2E_RESULT_FILE, JSON.stringify({status:'failed', test:'promela-definition-provider', message:'expected navigation target'}));\n`);
    chmodSync(executable, 0o755);
    const result = spawnSync(process.execPath, [runner], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, VSCODE_EXECUTABLE_PATH: executable },
      timeout: 10_000,
    });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /expected navigation target/);
  });
});
