# Syntax errors, error recovery and incremental parsing

## What the suite establishes

- `fixtures/invalid-cases.json` contains intentionally malformed ProMeLa source; these are **not** valid-SPIN-but-unsupported cases.
- `test/negative.test.ts` verifies that malformed source is rejected and that assertions fail when validity expectations are inverted.
- The native Tree-sitter `grammar/test/corpus/invalid.txt` verifies three concrete `ERROR` parse shapes.
- Incremental repair compares its syntax tree against an independent fresh parse of the **same** repaired source; the result must be syntax-error-free and preserve the intended label and goto.

## Known recovery limitation

Given this source:

```promela
int before;
$
int after;
```

In the v0.3.5 grammar, Tree-sitter recognizes the first declaration and reports an error for `$`, but **does not expose the later declaration as a `one_decl`**. The suffix `int after;` parses correctly in isolation. The positive requirement to retain that later declaration is tracked as a `test.todo` and must not be silently represented as a passing recovery test.

This is an editor-quality limitation. When implementing better top-level synchronization, add a corpus fixture and turn that TODO into an executable assertion. Do not make `$` valid syntax simply to allow recovery.

## When to change tests

If an incremental parse differs from a fresh parse, preserve the failure and record both tree strings before changing the test. If a valid SPIN example fails, track it under known grammar gaps rather than in the malformed-input collection. Semantic errors (e.g., undefined variables) are outside Tree-sitter syntax validity.
