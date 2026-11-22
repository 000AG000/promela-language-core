/** Reusable Node.js language-core API (no dependency on the VS Code API). */
export { createPromelaParser } from './parser.js';
export type { PromelaParser } from './parser.js';
export { definitionAt, indexDefinitions, positionOf } from './definitions.js';
export type { Definition, SymbolKind } from './definitions.js';
