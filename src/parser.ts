import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, Parser } from 'web-tree-sitter';
import type { Tree } from 'web-tree-sitter';

export type PromelaParser = {
  parser: Parser;
  language: Language;
  parse(source: string): Tree;
  close(): void;
};

/** Use a single initialized WASM runtime; create separate parser instances per caller. */
let runtimePromise: Promise<void> | undefined;

export async function createPromelaParser(projectRoot?: string): Promise<PromelaParser> {
  // Relative to compiled dist/src/parser.js. The staged npm package keeps
  // exactly the same layout, so consumers need no cwd-dependent setup.
  const wasmPath = projectRoot
    ? resolve(projectRoot, 'assets/tree-sitter-promela.wasm')
    : fileURLToPath(new URL('../../assets/tree-sitter-promela.wasm', import.meta.url));
  if (!existsSync(wasmPath)) throw new Error(`No language WASM at ${wasmPath}. Run npm run setup.`);
  // On Node, Parser.init() resolves the core tree-sitter.wasm from the installed package.
  runtimePromise ??= Parser.init().catch((error) => {
    runtimePromise = undefined;
    throw error;
  });
  await runtimePromise;
  const language = await Language.load(wasmPath);
  const parser = new Parser();
  parser.setLanguage(language);
  return {
    parser,
    language,
    parse(source) {
      const tree = parser.parse(source);
      if (!tree) throw new Error('Tree-sitter returned no syntax tree');
      return tree;
    },
    close() {
      parser.delete();
    },
  };
}
