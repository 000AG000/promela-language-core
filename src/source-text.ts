/** VS Code-compatible coordinates (UTF-16 code units, zero-based, end-exclusive). */
export interface SourcePosition {
  line: number;
  character: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export interface SourceLocation {
  uri: string;
  range: SourceRange;
}

/**
 * Convert JS string indices to editor positions without assuming UTF-8 byte
 * offsets. JavaScript string indices and web-tree-sitter's web binding indices
 * are UTF-16 code units. CRLF consumes two code units but one line break.
 */
export class SourceText {
  private readonly lineStarts: number[] = [0];
  private readonly lineEnds: number[] = [];

  constructor(readonly text: string) {
    const lineBreaks = /\r\n|\r|\n/g;
    for (const match of text.matchAll(lineBreaks)) {
      const offset = match.index;
      this.lineEnds.push(offset);
      this.lineStarts.push(offset + match[0].length);
    }
    this.lineEnds.push(text.length);
  }

  offsetAt(position: SourcePosition): number | undefined {
    if (!Number.isSafeInteger(position.line) || !Number.isSafeInteger(position.character)) {
      return undefined;
    }
    const start = this.lineStarts[position.line];
    const end = this.lineEnds[position.line];
    if (start === undefined || end === undefined || position.character < 0) return undefined;
    if (start + position.character > end) return undefined;
    return start + position.character;
  }

  positionAt(offset: number): SourcePosition {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > this.text.length) {
      throw new RangeError(`Source offset outside document: ${offset}`);
    }
    let lower = 0;
    let upper = this.lineStarts.length;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (this.lineStarts[middle]! <= offset) lower = middle + 1;
      else upper = middle;
    }
    const line = lower - 1;
    // Offsets inside a line break map to the end of the previous line.
    const character = Math.min(offset, this.lineEnds[line]!) - this.lineStarts[line]!;
    return { line, character };
  }

  range(start: number, end: number): SourceRange {
    if (end < start) throw new RangeError('Invalid end-exclusive range');
    return { start: this.positionAt(start), end: this.positionAt(end) };
  }
}
