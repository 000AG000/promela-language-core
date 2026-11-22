/**
 * Shared syntax contract for positive and negative fixtures. This helper is
 * intentionally small and testable: invalid source must not accidentally pass
 * the same check as valid source.
 */
import assert from 'node:assert/strict';
import type { Node } from 'web-tree-sitter';

export type SyntaxExpectation = 'valid' | 'invalid';

export function assertSyntax(
  node: Pick<Node, 'type' | 'hasError' | 'toString'>,
  expectation: SyntaxExpectation,
  label: string,
): void {
  if (expectation === 'valid') {
    assert.equal(node.type, 'program', `${label}: expected program root; got ${node.type}`);
    assert.equal(node.hasError, false, `${label}: unexpected syntax error: ${node.toString()}`);
  } else {
    assert.equal(node.hasError, true,
      `${label}: malformed source was accepted without a syntax error: ${node.toString()}`);
  }
}
