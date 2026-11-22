/**
 * Optional Extension Host integration test using the installed VS Code GUI
 * executable directly. Does not download VS Code or install any test framework.
 * For daily development use `npm run test:adapter` instead.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveVSCodeExecutable } from './resolve-code-executable.mjs';

const sample = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tmp = mkdtempSync(join(tmpdir(), 'promela-extension-host-'));
const marker = join(tmp, 'test-result.json');
try {
  const executable = resolveVSCodeExecutable();
  console.log(`Running Extension Host tests with installed VS Code: ${executable}`);
  const result = spawnSync(executable, [
    '--new-window',
    '--disable-extensions',
    '--disable-telemetry',
    '--disable-updates',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--user-data-dir', join(tmp, 'user-data'),
    '--extensions-dir', join(tmp, 'extensions'),
    `--extensionDevelopmentPath=${sample}`,
    `--extensionTestsPath=${resolve(sample, 'test/extension-host.cjs')}`,
  ], {
    stdio: 'inherit',
    env: { ...process.env, PROMELA_E2E_RESULT_FILE: marker },
    timeout: 120_000,
  });

  if (result.error) {
    throw new Error(`Unable to launch installed VS Code: ${result.error.message}`, { cause: result.error });
  }
  // Report assertion failures first, even when VS Code also exits nonzero.
  // The CLI wrapper can exit zero without running tests: demand proof.
  if (existsSync(marker)) {
    const report = JSON.parse(readFileSync(marker, 'utf8'));
    if (report.status === 'failed') {
      throw new Error(`ProMeLa Extension Host assertion failed: ${report.message}`);
    }
    if (report.status !== 'passed' || report.test !== 'promela-definition-provider') {
      throw new Error('Unexpected VS Code Extension Host test result');
    }
    if (result.status !== 0) {
      throw new Error(`VS Code exited with ${result.status ?? result.signal} after the assertions passed`);
    }
  } else if (result.status !== 0) {
    throw new Error(`VS Code exited with ${result.status ?? result.signal} before executing the ProMeLa test assertions`);
  } else {
    throw new Error('Installed VS Code exited without executing the ProMeLa test assertions. Check the Extension Host output, and verify VSCODE_EXECUTABLE_PATH is the application executable rather than the code CLI.');
  }
  console.log('PASS: real VS Code DefinitionProvider, unsaved edits and navigation.');
} catch (error) {
  console.error('VS Code Extension Host test failed:', error);
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
