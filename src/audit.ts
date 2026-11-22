import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPromelaParser } from './parser.js';

interface Case {name: string; source: string; expectedValid: boolean; reason?: string}
const root = process.cwd();
const cases: Case[] = JSON.parse(readFileSync(resolve(root, 'fixtures/audit-cases.json'), 'utf8'));
const knownGaps: {name:string; source:string;reason:string}[] =
  JSON.parse(readFileSync(resolve(root, 'fixtures/known-gaps.json'), 'utf8'));
for (const gap of knownGaps) {
  if (!cases.some(c => c.name === gap.name)) cases.push({...gap, expectedValid: true});
}
const examplesDir = resolve(root, 'vendor/tree-sitter-promela/examples');
if (existsSync(examplesDir)) {
  for (const file of readdirSync(examplesDir).filter(x => x.endsWith('.pml'))) {
    cases.push({name:`upstream/${file}`, source:readFileSync(resolve(examplesDir, file), 'utf8'), expectedValid:true});
  }
}
const runtime = await createPromelaParser(root);
let failed = 0;
try {
  console.log('Case'.padEnd(36), 'Tree errors', 'First error');
  console.log('-'.repeat(95));
  for (const testCase of cases) {
    const tree = runtime.parse(testCase.source);
    const errors: string[] = [];
    const walk = (node: typeof tree.rootNode): void => {
      if (node.type === 'ERROR' || node.isMissing) {
        errors.push(`${node.type}${node.isMissing ? '(MISSING)' : ''}@${node.startPosition.row + 1}:${node.startPosition.column + 1}`);
      }
      for (const child of node.children) walk(child);
    };
    walk(tree.rootNode);
    const hasError = tree.rootNode.hasError;
    console.log(testCase.name.padEnd(36), String(hasError).padEnd(11), errors.slice(0, 3).join(', ') || '-');
    if (hasError && testCase.expectedValid) failed++;
    tree.delete();
  }
} finally { runtime.close(); }
console.log(`\n${cases.length} inputs audited; ${failed} inputs with syntax errors (not necessarily all grammar bugs).`);
console.log('Interpret upstream sample failures with care: samples may contain intentionally non-SPIN syntax.');
if (process.argv.includes('--strict') && failed) process.exitCode = 1;
