/** Reusable Node.js language-core API (no dependency on the VS Code API). */
export { createPromelaParser } from './parser.js';
export type { PromelaParser } from './parser.js';
export { definitionAt, indexDefinitions, positionOf } from './definitions.js';
export type { Definition, SymbolKind } from './definitions.js';

// v0.4.0 P0: editor-independent lifecycle, UTF-16 positions and navigation.
export { createLanguageCore, LanguageCoreError } from './language-core.js';
export type {
  LanguageCore,
  LanguageCoreOptions,
  DocumentInput,
  DocumentSnapshot,
  DefinitionResult,
  ResolutionStatus,
  LanguageSymbol,
  LanguageCoreErrorCode,
  SemanticTokenInfo,
  SemanticTokenResult,
  ReferenceResult,
  SymbolKind as LanguageSymbolKind,
} from './language-core.js';
export type { SourceLocation, SourcePosition, SourceRange } from './source-text.js';
