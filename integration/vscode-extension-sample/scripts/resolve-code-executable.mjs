/**
 * Resolve the INSTALLED VS Code Electron application, not the `code` CLI wrapper.
 * The latter may exit successfully before the Extension Host runs any tests.
 * No network calls or downloads are performed here.
 */
import { realpathSync, statSync } from 'node:fs';
import { basename, delimiter, dirname, join } from 'node:path';

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function electronSiblingOfCli(cli) {
  try {
    const actual = realpathSync(cli);
    const parent = dirname(actual);
    if (basename(parent) !== 'bin') return undefined;
    const binary = join(dirname(parent), basename(actual));
    return isFile(binary) ? binary : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {{ platform?: string, configured?: string, searchPath?: string }} options
 * @returns {string} Absolute filesystem path to the application executable.
 */
export function resolveVSCodeExecutable({
  platform = process.platform,
  configured = process.env.VSCODE_EXECUTABLE_PATH,
  searchPath = process.env.PATH ?? '',
} = {}) {
  if (configured) {
    const resolved = platform === 'linux' ? electronSiblingOfCli(configured) : undefined;
    if (resolved) return resolved;
    if (isFile(configured)) {
      if (platform === 'linux') {
        // A shell wrapper cannot reliably be used as an Extension Host test process.
        const path = realpathSync(configured);
        if (path.endsWith('/bin/code') || path.endsWith('/bin/code-insiders')) {
          throw new Error(`VS Code CLI wrapper ${configured} has no adjacent application binary. Set VSCODE_EXECUTABLE_PATH to the Electron executable.`);
        }
      }
      return configured;
    }
    throw new Error(`VS Code executable not found: ${configured}`);
  }

  if (platform === 'linux') {
    const candidates = searchPath
      .split(delimiter)
      .filter(Boolean)
      .map((dir) => join(dir, 'code'));
    for (const candidate of [...candidates, '/usr/bin/code']) {
      const binary = electronSiblingOfCli(candidate);
      if (binary) return binary;
    }
    if (isFile('/usr/share/code/code')) return '/usr/share/code/code';
    throw new Error('Cannot locate the installed VS Code Electron executable. On Ubuntu, try VSCODE_EXECUTABLE_PATH=/usr/share/code/code. The /usr/bin/code CLI wrapper is not sufficient.');
  }

  throw new Error('Set VSCODE_EXECUTABLE_PATH to the installed VS Code application executable (not its CLI wrapper).');
}
