import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
try {
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (resolve(top) !== root) {
    throw new Error('Please initialize Git in this project root, not a parent folder.');
  }
} catch (error) {
  throw new Error(`Git repository required. Run 'git init -b main' first. ${error.message}`, {
    cause: error,
  });
}
// Explicit opt-in: no hooks are installed automatically by npm install.
execFileSync('git', ['config', '--local', 'core.hooksPath', 'scripts/hooks'], {
  cwd: root,
  stdio: 'inherit',
});
console.log('Installed tracked Git hooks via core.hooksPath=scripts/hooks');
console.log('pre-commit: npm run check:quality | pre-push: npm run test:all');
