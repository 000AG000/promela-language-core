# Syntax errors, error recovery and incremental parsing

## What the suite establishes

- `fixtures/invalid-cases.json` contains intentionally malformed ProMeLa source; these are **not** valid-SPIN-but-unsupported cases.
- `test/negative.test.ts` verifies that malformed source is rejected and that assertions fail when validity expectations are inverted.
- The native Tree-sitter `grammar/test/corpus/invalid.txt` verifies three concrete `ERROR` parse shapes.
- Incremental repair compares its syntax tree against an independent fresh parse of the **same** repaired source; the result must be syntax-error-free and preserve the intended label and goto.

## Recovered top-level declarations

The grammar now declares `word: $ => $.uname`. The project owner verified
that an illegal `$` between `int before;` and `int after;` reports a syntax
error **and** preserves the later declaration. The old `test.todo` is now
an active regression test. Do not remove this test when changing keywords
or precedence. This does not imply arbitrary malformed syntax can always
be recovered.

## When to change tests

If an incremental parse differs from a fresh parse, preserve the failure and record both tree strings before changing the test. If a valid SPIN example fails, track it under known grammar gaps rather than in the malformed-input collection. Semantic errors (e.g., undefined variables) are outside Tree-sitter syntax validity.
