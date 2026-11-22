import { readFileSync } from 'node:fs';
import { createPromelaParser } from './parser.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run parse -- file.pml [--tree]');
  process.exitCode = 2;
} else {
  const source = readFileSync(file, 'utf8');
  const runtime = await createPromelaParser();
  try {
    const tree = runtime.parse(source);
    console.log(JSON.stringify({file, syntaxErrors: tree.rootNode.hasError,
      rootType: tree.rootNode.type, topLevelCount: tree.rootNode.namedChildCount}, null, 2));
    if (process.argv.includes('--tree')) console.log(tree.rootNode.toString());
    if (tree.rootNode.hasError) process.exitCode = 1;
    tree.delete();
  } finally { runtime.close(); }
}
