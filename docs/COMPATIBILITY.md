> **v0.3.0 update:** `#` single-line directives are now recognized as named extras, without any preprocessing or include resolution. `unsigned value : 5 = 10;` has a dedicated `unsigned_decl`/`unsigned_item` node. Embedded C is still unsupported. The original v0.2.4 compatibility notes below are retained for historical context.

# ProMeLa/SPIN grammar compatibility

## Origin

The grammar in `grammar/grammar.js` is a single maintained descendant of `siraben/tree-sitter-promela` (`91da8f1`, 2022, MIT). It consolidates the formerly separate experimental grammar patches: LTL-specific productions, a `labeled_step` node, and separation of ordinary `expr` from temporal implication in guarded commands. Duplicate `const_expr` from upstream was consolidated. **It is not claimed to be a complete SPIN grammar.**

## Important build distinction

A JavaScript syntax check and a DSL/reference check can succeed even if `tree-sitter generate` reports an unresolved parser conflict. The integration is only verified when `npm run setup` completes and tests pass with the newly generated `.wasm`. The CI workflow builds from source and is the suggested source of truth.

## Coverage and tests

| ProMeLa feature | Test fixture / mechanism | Status before running the full suite |
|---|---|---|
| Globals, proctype, parameters, channels, typedef, mtype | `basic.pml`, `definitions.pml` | Regression coverage; must run |
| `:: guard -> statement` | `basic.pml` | Regression coverage; must run |
| `goto done; done: skip;` | `definitions.pml` | Regression coverage; must run |
| LTL `[]`, `<>`, implication `->` | `ltl-implication.pml` | Regression coverage; must run |
| Definitions, locals, shadowing, fields | `test/parser.test.ts` | Regression coverage; must run |
| Incremental editing | `test/parser.test.ts` | Regression coverage; must run |
| `inline NAME(args) { ... }` | `fixtures/inline.pml`, audit, AST and navigation tests | Implemented for statement-style calls; **requires generator/WASM verification** |
| `#define`, `#include` | `audit-cases.json` | **Known unsupported**; preprocessing is a separate concern |
| Embedded C (`c_code`, etc.) | `audit-cases.json` | **Known unsupported** |
| `unsigned bits:4` | `audit-cases.json` | **Unreliable**: can be accepted via unintended grammar paths |
| SPIN sample protocol corpus | Optional upstream examples checkout | **Partial; not certified** |

The incomplete upstream `ns` rule is replaced by named `inline_definition`, `inline_parameters` and `inline_call` productions. Inline argument interpretation is syntactic only; this prototype does **not** implement SPIN macro expansion or full inline-local scoping. Embedded C and preprocessing are not expanded in this milestone.

## Grammar structure

- `expr` covers ordinary expressions and no longer references `ltl_expr`.
- `ltl_body` directly parses `ltl_expr`, which accepts ordinary expressions as atoms and temporal operators.
- `conflicts: [[$.sequence], [$.ltl_expr, $.expr], [$.labeled_step, $.pfld, $.expr]]` makes the overlapping parenthesized-expression interpretations explicit; this addresses the precise conflict reported from v3.
- `labeled_step` makes label names addressable as declarations for navigation. Its
  statement-level parse precedence is 20, above `cmpnd` (18), because a bare
  identifier followed by `:` was previously being read as an expression.
  That alone was insufficient in v0.2.2, because the generator reported a
  three-way shift/reduce conflict between `labeled_step`, `pfld` and `expr`.
  The explicit conflict now preserves all interpretations; `prec.dynamic(2)`
  prefers completed statement labels at runtime. This still requires real
  parser generation and AST tests to establish success.

Tree-sitter's `ERROR` and `MISSING` nodes are treated as parsing failures, but syntax-tree acceptance does not establish model semantic validity. Compare suspect examples with the SPIN preprocessor and SPIN checker before categorizing them as grammar bugs.

## v0.2.4 — inline statement fragments

`inline_definition` represents `inline NAME(formals) { statements }` and
`inline_call` represents calls `NAME(actuals)` in statement positions. The name
of each construct is a field; formal parameters are under `inline_parameters`.
The symbol index resolves inline calls globally and formal arguments within
their inline fragment, while actual arguments retain their caller's scope.
This is **not** macro expansion, type checking, preprocessing, or a claim of
complete SPIN inline semantics. All existing v0.2.3 tests remain active.

Validation has to include `npm run generate` and `npm test` on a machine with
Tree-sitter CLI installed; structural checks alone cannot establish absence
of grammar conflicts.
