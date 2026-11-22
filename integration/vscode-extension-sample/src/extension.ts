import * as vscode from 'vscode';
import {
  createPromelaParser, definitionAt, indexDefinitions,
  type PromelaParser,
} from 'promela-language-core';
import type { Tree } from 'web-tree-sitter';

// Node.js/workspace-host example. The core handles syntax and single-document
// resolution; includes and CPP expansion are NOT resolved here.
let parserRuntime: PromelaParser | undefined;
const cache = new Map<string, { version: number; tree: Tree }>();

function disposeCache(uri?: string) {
  for (const [key, entry] of cache) {
    if (!uri || key === uri) { entry.tree.delete(); cache.delete(key); }
  }
}

function treeFor(document: vscode.TextDocument): Tree {
  const key = document.uri.toString();
  const found = cache.get(key);
  if (found?.version === document.version) return found.tree;
  found?.tree.delete();
  const tree = parserRuntime!.parse(document.getText());
  cache.set(key, { version: document.version, tree });
  return tree;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  parserRuntime = await createPromelaParser();
  const selector: vscode.DocumentSelector = [{language:'promela', scheme:'file'}, {language:'promela',scheme:'untitled'}];
  context.subscriptions.push(vscode.languages.registerDefinitionProvider(selector, {
    async provideDefinition(document, position) {
      // Lightweight support for quoted, relative #include paths. This does
      // not evaluate macros or search SPIN's configured include directories.
      if (document.uri.scheme === 'file') {
        const line = document.lineAt(position.line).text;
        const include = /^\s*#\s*include\s+"([^"\r\n]+)"/.exec(line);
        if (include) {
          const start = line.indexOf('"') + 1;
          const end = start + include[1]!.length;
          if (position.character >= start && position.character < end) {
            const file = vscode.Uri.joinPath(document.uri, '..', include[1]!);
            try {
              await vscode.workspace.fs.stat(file);
              return new vscode.Location(file, new vscode.Position(0, 0));
            } catch { return undefined; }
          }
        }
      }
      const found = definitionAt(treeFor(document), position.line, position.character);
      if (!found) return undefined;
      return new vscode.Location(document.uri,
        new vscode.Range(found.row, found.column, found.row, found.endColumn));
    },
  }));
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, {
    provideDocumentSymbols(document) {
      const symbols = indexDefinitions(treeFor(document));
      return symbols.map(def => new vscode.DocumentSymbol(
        def.name,
        `${def.kind} (${def.scope})`,
        def.kind === 'proctype' || def.kind === 'inline' ? vscode.SymbolKind.Function :
          def.kind === 'typedef' ? vscode.SymbolKind.Struct :
          def.kind === 'field' ? vscode.SymbolKind.Field :
          def.kind === 'macro' ? vscode.SymbolKind.Constant : vscode.SymbolKind.Variable,
        new vscode.Range(def.row, def.column, def.row, def.endColumn),
        new vscode.Range(def.row, def.column, def.row, def.endColumn),
      ));
    },
  }));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => disposeCache(doc.uri.toString())));
  context.subscriptions.push({dispose:() => {disposeCache(); parserRuntime?.close();parserRuntime=undefined;}});
}

export function deactivate(): void { disposeCache(); parserRuntime?.close(); parserRuntime=undefined; }
