import type { Node, Tree } from 'web-tree-sitter';
import { indexDefinitions, definitionAt, type Definition } from './definitions.js';

/** One lexical occurrence, with a resolved *declaration identity* (not just a name). */
export interface SemanticOccurrence {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly declaration: boolean;
  readonly target: Definition;
  /** Duplicate declarations of the same name/kind/scope are not arbitrarily resolved. */
  readonly candidates: readonly Definition[];
}

interface Span {
  startIndex: number;
  endIndex: number;
}

function insideError(node: Node): boolean {
  for (let parent: Node | null = node; parent; parent = parent.parent) {
    if (parent.type === 'ERROR' || parent.isMissing) return true;
  }
  return false;
}

function identityKey(def: Definition): string {
  return JSON.stringify([def.name, def.kind, def.scope, def.ownerType ?? null]);
}

/**
 * Immutable-per-document semantic snapshot. No Tree-sitter nodes are retained:
 * a document update can delete its previous tree without keeping stale handles.
 * All P0/P1 queries use the same declaration and resolved-reference snapshot.
 */
export class DocumentSemanticIndex {
  readonly definitions: readonly Definition[];
  readonly occurrences: readonly SemanticOccurrence[];

  private readonly references = new Map<number, SemanticOccurrence[]>();
  private readonly containers = new Map<number, Definition>();
  private readonly fullSpans = new Map<number, Span>();

  constructor(tree: Tree) {
    const defs = indexDefinitions(tree);
    this.definitions = defs;
    const declarationsByStart = new Map<number, Definition>();
    const duplicateGroups = new Map<string, Definition[]>();
    for (const def of defs) {
      declarationsByStart.set(def.startIndex, def);
      const key = identityKey(def);
      const group = duplicateGroups.get(key) ?? [];
      group.push(def);
      duplicateGroups.set(key, group);
    }

    // Collect container relationships and full syntax ranges only once.
    const owners = new Map<string, Definition>();
    for (const def of defs) {
      if (def.kind === 'typedef') owners.set(def.name, def);
    }
    const scopedContainers = new Map<string, Definition>();
    for (const node of tree.rootNode.descendantsOfType(['proc', 'inline_definition', 'utype'])) {
      const name =
        node.type === 'inline_definition'
          ? node.childForFieldName('name')
          : node.namedChildren.find((child) => child.type === 'uname');
      const decl = name && declarationsByStart.get(name.startIndex);
      if (!decl) continue;
      this.fullSpans.set(decl.startIndex, { startIndex: node.startIndex, endIndex: node.endIndex });
      if (node.type === 'proc' || node.type === 'inline_definition') {
        scopedContainers.set(`${node.type}:${node.startIndex}`, decl);
      }
    }
    for (const def of defs) {
      const parent =
        def.kind === 'field' && def.ownerType
          ? owners.get(def.ownerType)
          : scopedContainers.get(def.scope);
      if (parent) this.containers.set(def.startIndex, parent);
    }

    const spans: SemanticOccurrence[] = [];
    for (const def of defs) {
      // A declaration embedded in an error-recovery subtree is not a
      // confidently classified token. Keep the legacy index unchanged so
      // existing navigation/document-symbol behavior is preserved.
      const declarationNode = tree.rootNode.descendantForIndex(def.startIndex);
      if (!declarationNode || insideError(declarationNode)) continue;
      spans.push({
        startIndex: def.startIndex,
        endIndex: def.startIndex + def.name.length,
        declaration: true,
        target: def,
        candidates: [def],
      });
    }

    // Tree-sitter's named identifier nodes exclude identifiers merely appearing
    // as text in strings and comments. Macro definitions have no named identifier
    // child, so their declaration occurrences were inserted from `defs` above.
    for (const node of tree.rootNode.descendantsOfType(['uname', 'type'])) {
      if (insideError(node) || declarationsByStart.has(node.startIndex)) continue;
      const resolved = definitionAt(tree, node.startPosition.row, node.startPosition.column, defs);
      if (!resolved || resolved.name !== node.text) continue;
      const candidates = duplicateGroups.get(identityKey(resolved)) ?? [resolved];
      // Ambiguous references are retained for getDefinition(), but never emitted
      // as confidently classified semantic tokens or Find References results.
      const occurrence: SemanticOccurrence = {
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        declaration: false,
        target: resolved,
        candidates,
      };
      spans.push(occurrence);
    }

    spans.sort(
      (a, b) => a.startIndex - b.startIndex || Number(b.declaration) - Number(a.declaration),
    );
    // A token stream must be sorted, non-overlapping and unique. The AST gives
    // identifier spans, so overlapping entries indicate duplicate captures.
    const nonOverlapping: SemanticOccurrence[] = [];
    for (const occurrence of spans) {
      if (occurrence.startIndex < (nonOverlapping.at(-1)?.endIndex ?? 0)) continue;
      nonOverlapping.push(occurrence);
    }
    this.occurrences = nonOverlapping;
    for (const occurrence of nonOverlapping) {
      if (occurrence.declaration || occurrence.candidates.length !== 1) continue;
      const references = this.references.get(occurrence.target.startIndex) ?? [];
      references.push(occurrence);
      this.references.set(occurrence.target.startIndex, references);
    }
  }

  /** Binary search, returning only positions within an identifier token. */
  at(offset: number): SemanticOccurrence | undefined {
    let low = 0;
    let high = this.occurrences.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const entry = this.occurrences[mid]!;
      if (offset < entry.startIndex) high = mid;
      else if (offset >= entry.endIndex) low = mid + 1;
      else return entry;
    }
    return undefined;
  }

  referencesOf(declaration: Definition): readonly SemanticOccurrence[] {
    return this.references.get(declaration.startIndex) ?? [];
  }

  containerOf(declaration: Definition): Definition | undefined {
    return this.containers.get(declaration.startIndex);
  }

  fullSpanOf(declaration: Definition): Span {
    return (
      this.fullSpans.get(declaration.startIndex) ?? {
        startIndex: declaration.startIndex,
        endIndex: declaration.startIndex + declaration.name.length,
      }
    );
  }
}
