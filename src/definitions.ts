import type { Node, Tree } from 'web-tree-sitter';

/** Prototype symbol resolver. Ranges are zero-based Tree-sitter positions. */
export type SymbolKind =
  | 'variable'
  | 'parameter'
  | 'proctype'
  | 'typedef'
  | 'field'
  | 'mtype'
  | 'label'
  | 'ltl'
  | 'inline'
  | 'macro';
export interface Definition {
  name: string;
  kind: SymbolKind;
  scope: string;
  row: number;
  column: number;
  endColumn: number;
  startIndex: number;
  /** Populated for variables/fields declared with a user-defined type. */
  typeName?: string;
  /** Name of containing typedef for field declarations. */
  ownerType?: string;
}

function first(node: Node, type: string): Node | undefined {
  return node.namedChildren.find((child) => child.type === type);
}
function children(node: Node, type: string): Node[] {
  return node.namedChildren.filter((child) => child.type === type);
}
function ancestor(node: Node, type: string): Node | null {
  let n: Node | null = node;
  while (n && n.type !== type) n = n.parent;
  return n;
}
function nearestScope(node: Node): string {
  for (let p = node.parent; p; p = p.parent) {
    if (
      p.type === 'proc' ||
      p.type === 'init' ||
      p.type === 'claim' ||
      p.type === 'inline_definition'
    ) {
      return `${p.type}:${p.startIndex}`;
    }
  }
  return 'global';
}
function declarationContext(node: Node): { scope: string; kind: SymbolKind; ownerType?: string } {
  const typedef = ancestor(node, 'utype');
  if (typedef) return { scope: 'type', kind: 'field', ownerType: first(typedef, 'uname')?.text };
  const proc = ancestor(node, 'proc');
  if (proc && ancestor(node, 'decl')) return { scope: nearestScope(node), kind: 'parameter' };
  return { scope: nearestScope(node), kind: 'variable' };
}
function definition(
  node: Node,
  kind: SymbolKind,
  scope: string,
  extras: Partial<Definition> = {},
): Definition {
  return {
    name: node.text,
    kind,
    scope,
    row: node.startPosition.row,
    column: node.startPosition.column,
    endColumn: node.endPosition.column,
    startIndex: node.startIndex,
    ...extras,
  };
}

/**
 * Syntactic symbol index for common ProMeLa names.
 * Not a complete SPIN semantic model; see docs/REVIEW.md.
 */
export function indexDefinitions(tree: Tree): Definition[] {
  const out: Definition[] = [];
  const visit = (node: Node): void => {
    switch (node.type) {
      case 'proc': {
        const name = first(node, 'uname');
        if (name) out.push(definition(name, 'proctype', 'global'));
        break;
      }
      case 'inline_definition': {
        const name = node.childForFieldName('name');
        if (name) out.push(definition(name, 'inline', 'global'));
        break;
      }
      case 'inline_parameters': {
        for (const name of children(node, 'uname')) {
          out.push(definition(name, 'parameter', nearestScope(node)));
        }
        break;
      }
      case 'utype': {
        const name = first(node, 'uname');
        if (name) out.push(definition(name, 'typedef', 'global'));
        break;
      }
      case 'ltl': {
        const name = first(node, 'uname');
        if (name) out.push(definition(name, 'ltl', 'global'));
        break;
      }
      case 'preprocessor_directive': {
        // Only the declaration name is indexed. This is *not* macro expansion
        // and does not evaluate #if/#ifdef or track include visibility.
        const match = /^#\s*define\s+([a-zA-Z_][a-zA-Z0-9_]*)/.exec(node.text);
        if (match) {
          const name = match[1]!;
          const offset = match[0].lastIndexOf(name);
          out.push({
            name,
            kind: 'macro',
            scope: 'global',
            row: node.startPosition.row,
            column: node.startPosition.column + offset,
            endColumn: node.startPosition.column + offset + name.length,
            startIndex: node.startIndex + offset,
          });
        }
        break;
      }
      case 'unsigned_decl': {
        for (const item of children(node, 'unsigned_item')) {
          const name = item.childForFieldName('name');
          if (name) out.push(definition(name, 'variable', nearestScope(item)));
        }
        break;
      }
      case 'one_decl': {
        const ctx = declarationContext(node);
        // Custom types are aliased with a string (`alias($.uname, 'type')`),
        // so they are anonymous children and absent from `namedChildren`.
        const declaredType = node.children.find((child) => child.type === 'type');
        const varList = first(node, 'var_list');
        if (varList) {
          for (const ivar of children(varList, 'ivar')) {
            const vardcl = first(ivar, 'vardcl');
            const name = vardcl && first(vardcl, 'uname');
            if (name)
              out.push(
                definition(name, ctx.kind, ctx.scope, {
                  typeName: declaredType?.text,
                  ownerType: ctx.ownerType,
                }),
              );
          }
        }
        if (declaredType?.text === 'mtype') {
          const nlst = first(node, 'nlst');
          if (nlst)
            for (const name of children(nlst, 'uname')) {
              out.push(definition(name, 'mtype', 'global'));
            }
        }
        break;
      }
      case 'labeled_step': {
        // The grammar now exposes labels explicitly, rather than guessing
        // whether `uname :` inside a generic statement denotes a label.
        const name = node.childForFieldName('name');
        if (name) out.push(definition(name, 'label', nearestScope(node)));
        break;
      }
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(tree.rootNode);
  return out.filter(
    (entry, index, arr) =>
      arr.findIndex(
        (other) => other.startIndex === entry.startIndex && other.kind === entry.kind,
      ) === index,
  );
}

function isDeclaration(target: Node): boolean {
  const parent = target.parent;
  if (!parent) return false;
  if (
    parent.type === 'proc' ||
    parent.type === 'utype' ||
    parent.type === 'ltl' ||
    parent.type === 'inline_definition' ||
    parent.type === 'inline_parameters'
  )
    return true;
  if (parent.type === 'vardcl' && first(parent, 'uname')?.startIndex === target.startIndex)
    return true;
  if (
    parent.type === 'unsigned_item' &&
    parent.childForFieldName('name')?.startIndex === target.startIndex
  )
    return true;
  if (parent.type === 'nlst') return true;
  if (
    parent.type === 'labeled_step' &&
    parent.childForFieldName('name')?.startIndex === target.startIndex
  )
    return true;
  return false;
}

function choose(
  symbols: readonly Definition[],
  name: string,
  kind: SymbolKind,
  scope: string,
): Definition | undefined {
  return symbols.find((s) => s.name === name && s.kind === kind && s.scope === scope);
}

/** Resolve a cursor to a declaration, preferring parameters/process-local variables. */
export function definitionAt(
  tree: Tree,
  row: number,
  column: number,
  indexed?: readonly Definition[],
): Definition | undefined {
  const node = tree.rootNode.descendantForPosition({ row, column });
  if (!node || !['uname', 'type'].includes(node.type)) return undefined;
  const defs = indexed ?? indexDefinitions(tree);
  const localScope = nearestScope(node);
  const name = node.text;
  const own = defs.find((d) => d.startIndex === node.startIndex);
  if (own && isDeclaration(node)) return own;

  if (ancestor(node, 'goto')) return choose(defs, name, 'label', localScope);
  const call = ancestor(node, 'inline_call');
  if (call?.childForFieldName('name')?.startIndex === node.startIndex) {
    return choose(defs, name, 'inline', 'global');
  }
  if (ancestor(node, 'aname')) return choose(defs, name, 'proctype', 'global');
  if (node.type === 'type' || ancestor(node, 'basetype')) {
    return choose(defs, name, 'typedef', 'global');
  }

  // A qualified member access: resolve base variable type and the field on that typedef.
  const cmpnd = ancestor(node, 'cmpnd');
  if (cmpnd) {
    const fields = children(cmpnd, 'pfld');
    const current = fields.findIndex(
      (f) => node.startIndex >= f.startIndex && node.endIndex <= f.endIndex,
    );
    if (current > 0) {
      const baseName = first(fields[0]!, 'uname')?.text;
      const base = baseName
        ? (choose(defs, baseName, 'variable', localScope) ??
          choose(defs, baseName, 'parameter', localScope) ??
          choose(defs, baseName, 'variable', 'global'))
        : undefined;
      if (current === 1 && base?.typeName) {
        return defs.find(
          (d) => d.kind === 'field' && d.ownerType === base.typeName && d.name === name,
        );
      }
      // Deeper struct member chains need a full type checker.
      return undefined;
    }
  }
  if (own) return own;
  return (
    choose(defs, name, 'variable', localScope) ??
    choose(defs, name, 'parameter', localScope) ??
    choose(defs, name, 'variable', 'global') ??
    choose(defs, name, 'mtype', 'global') ??
    choose(defs, name, 'typedef', 'global') ??
    choose(defs, name, 'proctype', 'global') ??
    choose(defs, name, 'macro', 'global')
  );
}

/** Convert a searched substring to a cursor position; used in tests and examples. */
export function positionOf(
  source: string,
  needle: string,
  occurrence = 1,
): { row: number; column: number } {
  let index = -1;
  for (let i = 0; i < occurrence; i++) {
    index = source.indexOf(needle, index + 1);
    if (index < 0)
      throw new Error(`Unable to find occurrence ${occurrence} of ${JSON.stringify(needle)}`);
  }
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { row: lines.length - 1, column: lines.at(-1)!.length };
}
