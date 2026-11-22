import type { Node, Tree } from 'web-tree-sitter';
import { createPromelaParser, type PromelaParser } from './parser.js';
import { type Definition, type SymbolKind as LegacySymbolKind } from './definitions.js';
import { DocumentSemanticIndex } from './semantic-index.js';
import {
  SourceText,
  type SourceLocation,
  type SourcePosition,
  type SourceRange,
} from './source-text.js';

export type ResolutionStatus = 'resolved' | 'unresolved' | 'ambiguous' | 'unsupported';
export type SymbolKind = Exclude<LegacySymbolKind, 'proctype'> | 'process';

export interface DocumentInput {
  uri: string;
  version: number;
  text: string;
}

export interface DocumentSnapshot {
  uri: string;
  version: number;
  /** Syntax errors do not prevent navigation to known-good declarations. */
  hasSyntaxErrors: boolean;
}

export interface DefinitionResult {
  uri: string;
  version: number;
  status: ResolutionStatus;
  locations: SourceLocation[];
}

export interface LanguageSymbol {
  /** Unique within this document analysis snapshot; not persistent across edits. */
  id: string;
  name: string;
  kind: SymbolKind;
  declaration: SourceLocation;
  containerId?: string;
  /** Enables the extension to discard stale asynchronous responses. */
  version: number;
  /** Full declaration syntax span, e.g. process body (end-exclusive). */
  fullRange?: SourceRange;
  /** Identifier-only selection range; equals declaration.range if omitted. */
  selectionRange?: SourceRange;
}

/** One declaration or confidently resolved reference, in source order. */
export interface SemanticTokenInfo {
  range: SourceRange;
  type: SymbolKind;
  declaration: boolean;
}

export interface SemanticTokenResult {
  uri: string;
  version: number;
  tokens: SemanticTokenInfo[];
}

export interface ReferenceResult {
  uri: string;
  version: number;
  locations: SourceLocation[];
}

export interface LanguageCoreOptions {
  /**
   * Optional directory containing assets/tree-sitter-promela.wasm.
   * By default, the WASM bundled beside the installed package is loaded.
   */
  projectRoot?: string;
}

export interface LanguageCore {
  initialize(): Promise<void>;
  dispose(): void;
  openDocument(input: DocumentInput): Promise<DocumentSnapshot>;
  updateDocument(input: DocumentInput): Promise<DocumentSnapshot>;
  closeDocument(uri: string): void;
  getDefinition(uri: string, position: SourcePosition): Promise<DefinitionResult>;
  getDocumentSymbols(uri: string): Promise<LanguageSymbol[]>;
  getSemanticTokens(uri: string): Promise<SemanticTokenResult>;
  findReferences(
    uri: string,
    position: SourcePosition,
    includeDeclaration: boolean,
  ): Promise<ReferenceResult>;
}

export type LanguageCoreErrorCode =
  | 'DISPOSED'
  | 'NOT_INITIALIZED'
  | 'INVALID_DOCUMENT'
  | 'DOCUMENT_ALREADY_OPEN'
  | 'DOCUMENT_NOT_OPEN'
  | 'STALE_DOCUMENT_VERSION';

/** Distinguishes lifecycle failures from ordinary unresolved references. */
export class LanguageCoreError extends Error {
  constructor(
    readonly code: LanguageCoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LanguageCoreError';
  }
}

interface ManagedDocument {
  uri: string;
  version: number;
  tree: Tree;
  coordinates: SourceText;
  index: DocumentSemanticIndex;
}

function validateDocument(input: DocumentInput): void {
  if (
    !input ||
    typeof input.uri !== 'string' ||
    !input.uri.trim() ||
    !Number.isSafeInteger(input.version) ||
    input.version < 0 ||
    typeof input.text !== 'string'
  ) {
    throw new LanguageCoreError(
      'INVALID_DOCUMENT',
      'Expected uri, non-negative integer version and text',
    );
  }
}

function asSnapshot(doc: ManagedDocument): DocumentSnapshot {
  return { uri: doc.uri, version: doc.version, hasSyntaxErrors: doc.tree.rootNode.hasError };
}

function sourceLocation(doc: ManagedDocument, entry: Definition): SourceLocation {
  return {
    uri: doc.uri,
    range: doc.coordinates.range(entry.startIndex, entry.startIndex + entry.name.length),
  };
}

function kindOf(kind: LegacySymbolKind): SymbolKind {
  return kind === 'proctype' ? 'process' : kind;
}

function symbolId(doc: ManagedDocument, entry: Definition): string {
  return JSON.stringify([doc.uri, doc.version, entry.startIndex, entry.kind, entry.name]);
}

function insideErrorNode(node: Node | null): boolean {
  for (let current = node; current; current = current.parent) {
    if (current.type === 'ERROR' || current.isMissing) return true;
  }
  return false;
}

class ManagedLanguageCore implements LanguageCore {
  private readonly documents = new Map<string, ManagedDocument>();
  private parser?: PromelaParser;
  private initialization?: Promise<void>;
  private disposed = false;

  constructor(private readonly options: LanguageCoreOptions) {}

  async initialize(): Promise<void> {
    // The public Promise API must reject, not throw synchronously, after dispose.
    this.assertNotDisposed();
    if (this.parser) return Promise.resolve();
    if (this.initialization) return this.initialization;
    const loading = createPromelaParser(this.options.projectRoot).then((parser) => {
      if (this.disposed) {
        parser.close();
        throw new LanguageCoreError('DISPOSED', 'Core disposed during initialization');
      }
      this.parser = parser;
    });
    this.initialization = loading.catch((error: unknown) => {
      this.initialization = undefined;
      throw error;
    });
    return this.initialization;
  }

  async openDocument(input: DocumentInput): Promise<DocumentSnapshot> {
    validateDocument(input);
    await this.initialize();
    if (this.documents.has(input.uri)) {
      throw new LanguageCoreError('DOCUMENT_ALREADY_OPEN', `Document already opened: ${input.uri}`);
    }
    const doc = this.parseDocument(input);
    this.documents.set(input.uri, doc);
    return asSnapshot(doc);
  }

  async updateDocument(input: DocumentInput): Promise<DocumentSnapshot> {
    validateDocument(input);
    const previous = this.getDocument(input.uri);
    if (input.version <= previous.version) {
      throw new LanguageCoreError(
        'STALE_DOCUMENT_VERSION',
        `Version ${input.version} is not newer than ${previous.version}: ${input.uri}`,
      );
    }
    // Do not destroy the current snapshot if parsing the update fails.
    const updated = this.parseDocument(input);
    this.documents.set(input.uri, updated);
    previous.tree.delete();
    return asSnapshot(updated);
  }

  closeDocument(uri: string): void {
    const doc = this.documents.get(uri);
    if (doc) {
      this.documents.delete(uri);
      doc.tree.delete();
    }
  }

  async getDefinition(uri: string, position: SourcePosition): Promise<DefinitionResult> {
    const doc = this.getDocument(uri);
    const offset = doc.coordinates.offsetAt(position);
    const result: DefinitionResult = {
      uri,
      version: doc.version,
      status: 'unresolved',
      locations: [],
    };
    if (offset === undefined || offset === doc.coordinates.text.length) return result;
    const occurrence = doc.index.at(offset);
    if (!occurrence) {
      const node = doc.tree.rootNode.descendantForIndex(offset);
      return insideErrorNode(node) ? { ...result, status: 'unsupported' } : result;
    }
    return {
      ...result,
      status: occurrence.candidates.length > 1 ? 'ambiguous' : 'resolved',
      locations: occurrence.candidates.map((candidate) => sourceLocation(doc, candidate)),
    };
  }

  async getDocumentSymbols(uri: string): Promise<LanguageSymbol[]> {
    const doc = this.getDocument(uri);
    return doc.index.definitions.map((entry) => {
      const declaration = sourceLocation(doc, entry);
      const span = doc.index.fullSpanOf(entry);
      const symbol: LanguageSymbol = {
        id: symbolId(doc, entry),
        name: entry.name,
        kind: kindOf(entry.kind),
        declaration,
        version: doc.version,
        fullRange: doc.coordinates.range(span.startIndex, span.endIndex),
        selectionRange: declaration.range,
      };
      const parent = doc.index.containerOf(entry);
      if (parent) symbol.containerId = symbolId(doc, parent);
      return symbol;
    });
  }

  async getSemanticTokens(uri: string): Promise<SemanticTokenResult> {
    const doc = this.getDocument(uri);
    return {
      uri,
      version: doc.version,
      tokens: doc.index.occurrences
        .filter((occurrence) => occurrence.candidates.length === 1)
        .map((occurrence) => ({
          range: doc.coordinates.range(occurrence.startIndex, occurrence.endIndex),
          type: kindOf(occurrence.target.kind),
          declaration: occurrence.declaration,
        })),
    };
  }

  async findReferences(
    uri: string,
    position: SourcePosition,
    includeDeclaration: boolean,
  ): Promise<ReferenceResult> {
    const doc = this.getDocument(uri);
    const result: ReferenceResult = { uri, version: doc.version, locations: [] };
    const offset = doc.coordinates.offsetAt(position);
    if (offset === undefined) return result;
    const occurrence = doc.index.at(offset);
    if (!occurrence || occurrence.candidates.length !== 1) return result;
    const declaration = occurrence.target;
    const locations = doc.index.referencesOf(declaration).map((reference) => ({
      uri,
      range: doc.coordinates.range(reference.startIndex, reference.endIndex),
    }));
    if (includeDeclaration) locations.push(sourceLocation(doc, declaration));
    locations.sort(
      (left, right) =>
        left.range.start.line - right.range.start.line ||
        left.range.start.character - right.range.start.character,
    );
    return { ...result, locations };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const doc of this.documents.values()) doc.tree.delete();
    this.documents.clear();
    this.parser?.close();
    this.parser = undefined;
  }

  private parseDocument(input: DocumentInput): ManagedDocument {
    const parser = this.parser;
    if (!parser) throw new LanguageCoreError('NOT_INITIALIZED', 'Call initialize() first');
    const tree = parser.parse(input.text);
    try {
      return {
        uri: input.uri,
        version: input.version,
        tree,
        coordinates: new SourceText(input.text),
        index: new DocumentSemanticIndex(tree),
      };
    } catch (error) {
      tree.delete();
      throw error;
    }
  }

  private getDocument(uri: string): ManagedDocument {
    this.assertNotDisposed();
    const doc = this.documents.get(uri);
    if (!doc) throw new LanguageCoreError('DOCUMENT_NOT_OPEN', `Document not opened: ${uri}`);
    return doc;
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new LanguageCoreError('DISPOSED', 'Language core has been disposed');
  }
}

/** Factory for the editor-ready, document-oriented API; no vscode dependency. */
export function createLanguageCore(options: LanguageCoreOptions = {}): LanguageCore {
  return new ManagedLanguageCore(options);
}
