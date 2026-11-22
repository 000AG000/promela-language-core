# VS Code navigation architecture

## Pipeline

`TextDocument` -> `Parser.parse(source, previousEditedTree)` -> Tree-sitter AST -> symbol indexing / scope model -> `DefinitionProvider` -> `vscode.Location`.

`src/parser.ts`: initialized `web-tree-sitter` runtime and WASM language. Initialize once per extension host; use one parser per concurrent edit stream to avoid unsafe shared state.

`src/definitions.ts`: local prototype. `indexDefinitions()` returns named declarations (ranges in zero-based Tree-sitter positions). `definitionAt()` resolves a cursor to an indexed declaration using enclosing process scopes.

## Known semantic limitations

- Only first-level typedef field access (`p.value`); nested `p.header.id` requires type propagation.
- Blocks and inline parameters require richer lexical scopes.
- Only same-document resolution; workspace-wide `#include` and macros require preprocessing/dependency graph.
- No reference classification beyond a small number of syntactic contexts.
- Syntax trees can contain recoverable errors; semantic indexing should tolerate incomplete source carefully.
- Using a UTF-8 byte-based parser while exposing VS Code's UTF-16 positions requires explicit range conversion for non-ASCII source. Do not assume code-point and byte offsets are interchangeable.
- SPIN is the authority for actual ProMeLa validation, not Tree-sitter's error flag.

## Suggested next steps

1. Verify the documented v3 conflict is resolved and both original fixtures pass in CI.
2. Add tests for `inline` definitions, call sites and lexical scopes, then implement them in grammar.
3. Add preprocessor design: either preprocess source preserving source maps or model directives and conditional regions.
4. Build a workspace-level symbol table, dependency graph and re-indexing on edits.
5. Register the VS Code `DefinitionProvider`, then add references, hover, rename and semantic tokens.
