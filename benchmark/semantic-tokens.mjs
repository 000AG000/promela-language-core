/** Reproducible single-process comparison; reports observations, not a hard speed guarantee. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createLanguageCore } from '../dist/src/index.js';

const references = Number(process.env.PROMELA_BENCHMARK_REFERENCES ?? 2000);
if (!Number.isSafeInteger(references) || references < 2 || references % 2 !== 0) {
  throw new Error('PROMELA_BENCHMARK_REFERENCES must be a positive even integer >= 2');
}
const statements = references / 2;
const text = ['int counter;', 'init {', ...Array.from({ length: statements }, () => '  counter = counter + 1;'), '}'].join('\n');
const uri = 'file:///semantic-benchmark.pml';
const core = createLanguageCore();
const samples = 5;
const batchTimes = [];
const repeatedTimes = [];
const median = (times) => [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];

try {
  const parsingStart = performance.now();
  const snapshot = await core.openDocument({ uri, version: 1, text });
  const indexingMs = performance.now() - parsingStart;
  assert.equal(snapshot.hasSyntaxErrors, false);
  for (let round = 0; round < samples; round++) {
    const batchStart = performance.now();
    const tokens = await core.getSemanticTokens(uri);
    batchTimes.push(performance.now() - batchStart);
    assert.equal(tokens.tokens.length, references + 1);
    assert.equal(tokens.tokens.filter((token) => !token.declaration).length, references);

    const repeatedStart = performance.now();
    for (let statement = 0; statement < statements; statement++) {
      const row = statement + 2;
      for (const character of [2, 12]) {
        const resolved = await core.getDefinition(uri, { line: row, character });
        assert.equal(resolved.status, 'resolved');
      }
    }
    repeatedTimes.push(performance.now() - repeatedStart);
  }
  const summary = {
    version: '0.5.0-rc.1',
    references,
    documents: 1,
    sourceBytes: Buffer.byteLength(text),
    warmup: 'same document/index; both operations repeated five times',
    parseAndIndexMs: +indexingMs.toFixed(2),
    batchMedianMs: +median(batchTimes).toFixed(2),
    repeatedGetDefinitionMedianMs: +median(repeatedTimes).toFixed(2),
    ratioRepeatedOverBatch: +(median(repeatedTimes) / median(batchTimes)).toFixed(2),
    node: process.version,
  };
  console.log(JSON.stringify(summary, null, 2));
} finally {
  core.dispose();
}
