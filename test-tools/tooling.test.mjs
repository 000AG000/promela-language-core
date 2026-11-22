import test from 'node:test';
import assert from 'node:assert/strict';
import { lockfileProblems } from '../scripts/tooling/lockfile.mjs';

const manifest = {name: 'sample', version: '0.1.0', dependencies: {dep: '1.0.0'}, devDependencies: {tool: '2.0.0'}};
const goodLock = {lockfileVersion: 3, packages: {'': {...manifest}}};

test('recognizes matching npm lock metadata', () => {
  assert.deepEqual(lockfileProblems(manifest, goodLock), []);
});

test('rejects a stale version or missing development dependency', () => {
  const stale = {lockfileVersion: 3, packages: {'': {name: 'sample', version: '0.0.9', dependencies: {dep: '1.0.0'}}}};
  const issues = lockfileProblems(manifest, stale);
  assert.ok(issues.some(item => item.includes('version')));
  assert.ok(issues.some(item => item.includes('devDependencies.tool')));
});

test('rejects invalid or incomplete lockfiles', () => {
  assert.ok(lockfileProblems(manifest, null).length > 0);
  assert.ok(lockfileProblems(manifest, {lockfileVersion: 3}).length > 0);
  assert.ok(lockfileProblems(manifest, {lockfileVersion: 2, packages: {'': {...manifest}}}).length > 0);
});
