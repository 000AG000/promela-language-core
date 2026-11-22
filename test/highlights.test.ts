/**
 * Syntax queries are part of the grammar contract. Validate them using the
 * actual WebAssembly language, not only the static grammar source.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Query } from 'web-tree-sitter';
import { createPromelaParser } from '../src/parser.js';

const runtime = await createPromelaParser();
after(() => runtime.close());
const source = readFileSync(resolve(process.cwd(), 'grammar/queries/highlights.scm'), 'utf8');

test('highlights.scm compiles against the actual ProMeLa WASM language', () => {
  const query = new Query(runtime.language, source);
  try {
    assert.ok(query, 'highlight query must compile');
  } finally {
    query.delete();
  }
});

test('highlights.scm captures named break and ordinary keyword tokens', () => {
  const tree = runtime.parse('active proctype Worker() { do :: break od }');
  try {
    assert.equal(tree.rootNode.type, 'program');
    assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
    const query = new Query(runtime.language, source);
    try {
      const keywords = query.captures(tree.rootNode)
        .filter(c => c.name === 'keyword')
        .map(c => ({ text: c.node.text, type: c.node.type }));
      assert.ok(keywords.some(c => c.text === 'break' && c.type === 'break'),
        `Named break keyword not captured: ${JSON.stringify(keywords)}`);
      assert.ok(keywords.some(c => c.text === 'proctype'),
        `Anonymous proctype keyword not captured: ${JSON.stringify(keywords)}`);
    } finally {
      query.delete();
    }
  } finally {
    tree.delete();
  }
});
