import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lockfileProblems } from './tooling/lockfile.mjs';

const root = resolve(import.meta.dirname, '..');
function read(name) {
  return JSON.parse(readFileSync(resolve(root, name), 'utf8'));
}
try {
  const problems = lockfileProblems(read('package.json'), read('package-lock.json'));
  if (problems.length) {
    for (const problem of problems) console.error(`LOCKFILE: ${problem}`);
    process.exitCode = 1;
  } else {
    console.log('Lockfile metadata matches package.json');
  }
} catch (error) {
  console.error(`LOCKFILE: ${error.message}`);
  console.error('Run npm install in the repository root, then commit package-lock.json.');
  process.exitCode = 1;
}
