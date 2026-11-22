// Offline smoke check of the grammar DSL's structure and referenced rule names.
// This is NOT a replacement for tree-sitter generate (which validates parser conflicts).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const path = resolve(import.meta.dirname, '../grammar/grammar.js');
const src = readFileSync(path, 'utf8');
const refs = new Set();
const $ = new Proxy(
  {},
  {
    get(_, key) {
      if (typeof key !== 'string') throw new Error('Unexpected symbol');
      refs.add(key);
      return { symbol: key };
    },
  },
);
const stub = (...args) => ({ args });
const prec = Object.assign(stub, { left: stub, right: stub, dynamic: stub });
let result;
const ctx = {
  module: { exports: {} },
  grammar: (grammar) => ((result = grammar), grammar),
  seq: stub,
  choice: stub,
  repeat: stub,
  repeat1: stub,
  optional: stub,
  prec,
  token: Object.assign(stub, { immediate: stub }),
  alias: stub,
  field: stub,
};
runInNewContext(src, ctx, { filename: path });
if (!result || result.name !== 'promela') throw new Error('No valid promela grammar export');
// Tree-sitter uses the FIRST rule as its start symbol. v0.3.0 accidentally
// declared 'preprocessor_directive' first, producing an ERROR root for nearly
// every valid program despite successful generation and WASM compilation.
const startRule = Object.keys(result.rules)[0];
if (startRule !== 'program') {
  throw new Error(`Invalid start rule: expected 'program' first, got '${startRule}'`);
}
console.log('Start rule OK: program');
for (const rule of Object.values(result.rules)) rule($);
result.extras?.($);
result.conflicts?.($);
const missing = [...refs].filter((name) => !Object.hasOwn(result.rules, name));
if (missing.length) throw new Error(`Unknown grammar rules: ${missing.join(', ')}`);
console.log(`Grammar DSL OK: ${Object.keys(result.rules).length} rules, ${refs.size} referenced`);

// Exercise Node's real module loader as well as the VM DSL check. Tree-sitter's
// generator imports grammar.js from an ESM context, so a CommonJS grammar must
// live in its own `{ "type": "commonjs" }` package scope.
globalThis.grammar = (definition) => definition;
try {
  const loaded = await import(pathToFileURL(path).href);
  if (loaded.default?.name !== 'promela') {
    throw new Error('grammar.js did not export the ProMeLa grammar');
  }
} finally {
  delete globalThis.grammar;
}
console.log('Node module loading OK: CommonJS grammar imported from ESM');
