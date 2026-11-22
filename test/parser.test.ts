import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Edit, Query } from 'web-tree-sitter';
import { createPromelaParser } from '../src/parser.js';
import { definitionAt, indexDefinitions, positionOf } from '../src/definitions.js';

const runtime = await createPromelaParser();
after(() => runtime.close());
const fixture = (name: string) => readFileSync(resolve(process.cwd(), 'fixtures', name), 'utf8');

function assertParses(source: string) {
  const tree = runtime.parse(source);
  assert.equal(tree.rootNode.type, 'program');
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  return tree;
}

test('WASM runtime loads and parses a grammar-supported subset of SPIN constructs', () => {
  const tree = assertParses(fixture('supported-basic.pml'));
  const types = tree.rootNode.namedChildren.map((n) => n.type);
  assert.ok(types.includes('proc'));
  assert.ok(types.includes('init'));
  assert.ok(types.includes('ltl'));
  assert.ok(types.includes('utype'));
  tree.delete();
});

test('Tree-sitter query captures process definitions', () => {
  const tree = assertParses(fixture('supported-definitions.pml'));
  const query = new Query(runtime.language, '(proc (uname) @name)');
  const captures = query.captures(tree.rootNode);
  assert.equal(captures.length, 1);
  assert.equal(captures[0]?.name, 'name');
  assert.equal(captures[0]?.node.text, 'Worker');
  query.delete();
  tree.delete();
});

test('indexes proctypes, globals, locals, typedefs, fields, parameters and enum names', () => {
  const tree = assertParses(fixture('supported-definitions.pml'));
  const symbols = indexDefinitions(tree);
  for (const [name, kind] of [
    ['Packet', 'typedef'],
    ['value', 'field'],
    ['ready', 'mtype'],
    ['Worker', 'proctype'],
    ['input', 'parameter'],
    ['packet', 'variable'],
  ]) {
    assert.ok(
      symbols.some((s) => s.name === name && s.kind === kind),
      `${kind} ${name} missing`,
    );
  }
  assert.equal(symbols.filter((s) => s.name === 'counter' && s.kind === 'variable').length, 2);
  tree.delete();
});

test('go-to-definition resolves local shadowing, proctype, type, field and enum constant', () => {
  const source = fixture('supported-definitions.pml');
  const tree = assertParses(source);
  const def = (needle: string, occurrence = 1, offset = 0) => {
    const at = positionOf(source, needle, occurrence);
    return definitionAt(tree, at.row, at.column + offset);
  };
  assert.equal(def('counter', 3)?.row, positionOf(source, 'counter', 2).row);
  assert.equal(def('Worker', 2)?.kind, 'proctype');
  assert.equal(def('ready', 2)?.kind, 'mtype');
  assert.equal(def('Packet', 2)?.kind, 'typedef');
  assert.equal(def('packet.value', 1, 7)?.kind, 'field');
  tree.delete();
});

// Regression tests for the VALID syntax that v2 recorded as TODOs.
// The assertions check both acceptance and the AST structure needed by
// a VS Code language service.
test('guarded commands treat -> as a statement separator, not LTL implication', () => {
  const tree = assertParses(fixture('basic.pml'));
  const options = tree.rootNode.descendantsOfType('option');
  assert.equal(options.length, 2);
  const guarded = options[0]?.namedChildren.find((n) => n.type === 'sequence');
  assert.ok(guarded, 'guarded branch must have a sequence');
  const steps = guarded.namedChildren.filter((n) => n.type === 'step');
  assert.equal(steps.length, 2, guarded.toString());
  assert.match(steps[0]!.text, /local\s*>\s*0/);
  assert.match(steps[1]!.text, /globalCount\s*=\s*globalCount/);
  const misplacedLtl = tree.rootNode
    .descendantsOfType('ltl_expr')
    .filter((n) => !n.parent || !inside(n, 'ltl_body'));
  assert.equal(misplacedLtl.length, 0, 'LTL expression outside ltl block');
  tree.delete();
});

test('labeled statements have a named AST node and goto resolves to label', () => {
  const source = fixture('definitions.pml');
  const tree = assertParses(source);
  const labels = tree.rootNode.descendantsOfType('labeled_step');
  assert.equal(labels.length, 1, tree.rootNode.toString());
  const label = labels[0]!;
  assert.equal(label.childForFieldName('name')?.text, 'done');
  assert.ok(label.childForFieldName('statement'));
  const symbols = indexDefinitions(tree);
  assert.equal(symbols.filter((s) => s.kind === 'label' && s.name === 'done').length, 1);
  const goto = positionOf(source, 'goto done');
  const reference = definitionAt(tree, goto.row, goto.column + 'goto '.length);
  assert.equal(reference?.kind, 'label');
  const target = positionOf(source, 'done:');
  assert.equal(reference?.row, target.row);
  assert.equal(reference?.column, target.column);
  tree.delete();
});

test('same-named labels resolve within the surrounding process', () => {
  const source = [
    'active proctype First() {',
    '  again: skip;',
    '  goto again;',
    '}',
    'active proctype Second() {',
    '  again: skip;',
    '  goto again;',
    '}',
  ].join('\n');
  const tree = assertParses(source);
  const labels = indexDefinitions(tree).filter((s) => s.kind === 'label');
  assert.equal(labels.length, 2);
  assert.notEqual(
    labels[0]?.scope,
    labels[1]?.scope,
    'labels in different proctypes must have different scopes',
  );
  for (const occurrence of [1, 2]) {
    const reference = positionOf(source, 'goto again', occurrence);
    const resolved = definitionAt(tree, reference.row, reference.column + 'goto '.length);
    const target = positionOf(source, 'again:', occurrence);
    assert.equal(resolved?.kind, 'label');
    assert.deepEqual([resolved?.row, resolved?.column], [target.row, target.column]);
  }
  tree.delete();
});

test('remote reference inside an expression is not classified as a label', () => {
  // `P:field` is also syntactically meaningful as a remote reference; the
  // higher label precedence must not steal it from an expression context.
  const source = 'active proctype Observer() { assert(Observer:state) }';
  const tree = assertParses(source);
  assert.equal(tree.rootNode.descendantsOfType('labeled_step').length, 0);
  assert.ok(
    tree.rootNode.descendantsOfType('expr').some((n) => n.text === 'Observer:state'),
    tree.rootNode.toString(),
  );
  tree.delete();
});

test('LTL temporal formulas still support implication within ltl bodies', () => {
  const tree = assertParses(fixture('ltl-implication.pml'));
  assert.ok(tree.rootNode.descendantsOfType('ltl_expr').length > 0);
  tree.delete();
});

function inside(node: import('web-tree-sitter').Node, type: string): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === type) return true;
  }
  return false;
}

test('inline definitions, parameters and call sites are distinct named AST nodes', () => {
  const source = fixture('inline.pml');
  const tree = assertParses(source);
  const definitions = tree.rootNode.descendantsOfType('inline_definition');
  const calls = tree.rootNode.descendantsOfType('inline_call');
  assert.deepEqual(
    definitions.map((n) => n.childForFieldName('name')?.text),
    ['reset', 'increment', 'tick'],
  );
  assert.deepEqual(
    calls.map((n) => n.childForFieldName('name')?.text),
    ['reset', 'increment', 'tick'],
  );
  assert.deepEqual(
    definitions.map(
      (n) => n.namedChildren.find((c) => c.type === 'inline_parameters')?.namedChildCount ?? 0,
    ),
    [2, 1, 0],
  );
  for (const item of definitions) assert.equal(item.childForFieldName('body')?.type, 'body');
  tree.delete();
});

test('go-to-definition resolves inline calls, formal parameters and call arguments', () => {
  const source = fixture('inline.pml');
  const tree = assertParses(source);
  const symbols = indexDefinitions(tree);
  assert.equal(symbols.filter((s) => s.kind === 'inline').length, 3);
  assert.equal(symbols.filter((s) => s.kind === 'parameter').length, 3);

  // Call names resolve globally, but their actual arguments stay in caller scope.
  for (const name of ['reset', 'increment', 'tick']) {
    const at = positionOf(source, `${name}(`, 2);
    const target = definitionAt(tree, at.row, at.column);
    const declaration = positionOf(source, `${name}(`, 1);
    assert.equal(target?.kind, 'inline');
    assert.deepEqual([target?.row, target?.column], [declaration.row, declaration.column]);
  }

  const actualArg = positionOf(source, 'reset(counter, 0)');
  const actual = definitionAt(tree, actualArg.row, actualArg.column + 'reset('.length);
  assert.equal(actual?.kind, 'variable', 'inline call argument must resolve in caller scope');
  assert.equal(actual?.row, positionOf(source, 'byte counter;').row);

  const formalUse = positionOf(source, 'target = replacement');
  const formal = definitionAt(tree, formalUse.row, formalUse.column);
  assert.equal(formal?.kind, 'parameter');
  assert.equal(formal?.row, positionOf(source, 'inline reset(target, replacement)').row);
  const rhs = definitionAt(tree, formalUse.row, formalUse.column + 'target = '.length);
  assert.equal(rhs?.kind, 'parameter');
  assert.equal(rhs?.name, 'replacement');
  tree.delete();
});

test('inline fragment scopes isolate identically named formal parameters', () => {
  const source = [
    'inline first(item) { item = 1; }',
    'inline second(item) { item = 2; }',
    'init { byte a; first(a); second(a); }',
  ].join('\n');
  const tree = assertParses(source);
  const parameters = indexDefinitions(tree).filter(
    (s) => s.kind === 'parameter' && s.name === 'item',
  );
  assert.equal(parameters.length, 2);
  assert.notEqual(parameters[0]?.scope, parameters[1]?.scope);
  for (const [which, value] of [
    [1, '1'],
    [2, '2'],
  ] as const) {
    const at = positionOf(source, `item = ${value}`);
    const def = definitionAt(tree, at.row, at.column);
    assert.equal(def?.kind, 'parameter');
    assert.equal(def?.row, positionOf(source, `inline ${which === 1 ? 'first' : 'second'}`).row);
  }
  tree.delete();
});

test('SPIN unsigned declaration exposes width and a navigable variable', () => {
  const source = 'unsigned flags : 5 = 15; init { flags = 3; }';
  const tree = assertParses(source);
  const decl = tree.rootNode.descendantsOfType('unsigned_decl');
  assert.equal(decl.length, 1);
  const item = decl[0]!.namedChildren.find((n) => n.type === 'unsigned_item');
  assert.equal(item?.childForFieldName('name')?.text, 'flags');
  assert.equal(item?.childForFieldName('bits')?.text, '5');
  const at = positionOf(source, 'flags', 2);
  const found = definitionAt(tree, at.row, at.column);
  assert.equal(found?.kind, 'variable');
  assert.equal(found?.column, positionOf(source, 'flags').column);
  tree.delete();
});

test('preprocessor directives are named nodes without syntax errors', () => {
  const source = [
    '#define LIMIT 4',
    '#include "constants.pml"',
    '#if LIMIT > 0',
    'int count;',
    '#else',
    'byte count;',
    '#endif',
    'init { count = LIMIT; }',
  ].join('\n');
  const tree = assertParses(source);
  const directives = tree.rootNode.descendantsOfType('preprocessor_directive');
  assert.deepEqual(
    directives.map((n) => n.text.split(/\s+/)[0]),
    ['#define', '#include', '#if', '#else', '#endif'],
  );
  // Both branches are present in the *source* AST. This test does not
  // claim that the conditional compilation was evaluated.
  tree.delete();
});

test('simple object-like macro references resolve to #define in the same file', () => {
  const source = '#define LIMIT 4\nint count; init { count = LIMIT; }';
  const tree = assertParses(source);
  const names = indexDefinitions(tree);
  assert.equal(names.find((n) => n.kind === 'macro')?.name, 'LIMIT');
  const at = positionOf(source, 'LIMIT', 2);
  const found = definitionAt(tree, at.row, at.column);
  assert.equal(found?.kind, 'macro');
  assert.deepEqual([found?.row, found?.column], [0, '#define '.length]);
  tree.delete();
});

test('incremental parsing accepts an edited tree', () => {
  const oldSource = 'int value; init { value = 1; }';
  const newSource = 'int count; init { value = 1; }';
  const oldTree = assertParses(oldSource);
  oldTree.edit(
    new Edit({
      startIndex: 4,
      oldEndIndex: 9,
      newEndIndex: 9,
      startPosition: { row: 0, column: 4 },
      oldEndPosition: { row: 0, column: 9 },
      newEndPosition: { row: 0, column: 9 },
    }),
  );
  const newTree = runtime.parser.parse(newSource, oldTree);
  assert.ok(newTree);
  assert.equal(newTree.rootNode.hasError, false);
  assert.ok(newTree.rootNode.toString().includes('one_decl'));
  assert.equal(newTree.rootNode.namedChildren[0]?.text, 'int count');
  oldTree.delete();
  newTree.delete();
});

test('parser reports a syntax error without throwing on invalid source', () => {
  const tree = runtime.parse('proctype Broken( { }');
  assert.equal(tree.rootNode.hasError, true);
  tree.delete();
});
