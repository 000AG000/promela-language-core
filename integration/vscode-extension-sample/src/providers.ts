/** VS Code adapter boundary: runtime-injected API allows download-free provider tests. */
import type * as VSCode from 'vscode';
import type {
  DocumentSnapshot,
  LanguageCore,
  LanguageSymbol,
  SourceRange,
} from 'promela-language-core';

/**
 * Register real provider implementations against a VS Code-compatible API.
 * Keeping `vscode` as a type-only dependency allows tests to call these
 * providers in Node without installing or launching desktop VS Code.
 */
export function registerLanguageFeatures(
  vscode: typeof VSCode,
  core: LanguageCore,
): VSCode.Disposable {
  const disposables: VSCode.Disposable[] = [];
  const versions = new Map<string, number>();
  const pending = new Map<string, Promise<DocumentSnapshot>>();

  function asRange(range: SourceRange): VSCode.Range {
    return new vscode.Range(
      range.start.line,
      range.start.character,
      range.end.line,
      range.end.character,
    );
  }

  /** Serialize updates for each URI; never let a stale editor version overwrite a newer one. */
  function synchronize(document: VSCode.TextDocument): Promise<DocumentSnapshot> {
    const uri = document.uri.toString();
    const input = { uri, version: document.version, text: document.getText() };
    const previous = pending.get(uri) ?? Promise.resolve(undefined);
    const next = previous.catch(() => undefined).then(async () => {
      const version = versions.get(uri);
      if (version === undefined) {
        const snapshot = await core.openDocument(input);
        versions.set(uri, snapshot.version);
        return snapshot;
      }
      if (input.version > version) {
        const snapshot = await core.updateDocument(input);
        versions.set(uri, snapshot.version);
        return snapshot;
      }
      return { uri, version, hasSyntaxErrors: false };
    });
    pending.set(uri, next);
    void next.finally(() => {
      if (pending.get(uri) === next) pending.delete(uri);
    }).catch(() => undefined);
    return next;
  }

  function symbolKind(symbol: LanguageSymbol): VSCode.SymbolKind {
    switch (symbol.kind) {
      case 'process':
      case 'inline':
        return vscode.SymbolKind.Function;
      case 'typedef':
        return vscode.SymbolKind.Struct;
      case 'field':
        return vscode.SymbolKind.Field;
      case 'parameter':
        return vscode.SymbolKind.Variable;
      case 'macro':
      case 'mtype':
        return vscode.SymbolKind.Constant;
      case 'ltl':
        return vscode.SymbolKind.Namespace;
      default:
        return vscode.SymbolKind.Variable;
    }
  }
  const selector: VSCode.DocumentSelector = [
    { language: 'promela', scheme: 'file' },
    { language: 'promela', scheme: 'untitled' },
  ];

  disposables.push(
    vscode.languages.registerDefinitionProvider(selector, {
      async provideDefinition(document, position, token) {
        // Keep the existing simple #include link navigation in the adapter.
        // This is not conditional preprocessing or workspace-wide resolution.
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
              } catch {
                return undefined;
              }
            }
          }
        }
        const snapshot = await synchronize(document);
        if (token.isCancellationRequested || snapshot.version !== document.version) return undefined;
        const result = await core.getDefinition(document.uri.toString(), position);
        if (
          token.isCancellationRequested ||
          result.version !== document.version ||
          !['resolved', 'ambiguous'].includes(result.status)
        ) return undefined;
        return result.locations.map((location) =>
          new vscode.Location(vscode.Uri.parse(location.uri), asRange(location.range)),
        );
      },
    }),
  );

  disposables.push(
    vscode.languages.registerDocumentSymbolProvider(selector, {
      async provideDocumentSymbols(document, token) {
        const snapshot = await synchronize(document);
        if (token.isCancellationRequested || snapshot.version !== document.version) return [];
        const symbols = await core.getDocumentSymbols(document.uri.toString());
        if (token.isCancellationRequested || document.version !== snapshot.version) return [];
        const byId = new Map<string, VSCode.DocumentSymbol>();
        const roots: VSCode.DocumentSymbol[] = [];
        for (const symbol of symbols) {
          byId.set(
            symbol.id,
            new vscode.DocumentSymbol(
              symbol.name,
              symbol.kind,
              symbolKind(symbol),
              asRange(symbol.declaration.range),
              asRange(symbol.declaration.range),
            ),
          );
        }
        for (const symbol of symbols) {
          const mapped = byId.get(symbol.id)!;
          const parent = symbol.containerId && byId.get(symbol.containerId);
          if (parent) parent.children.push(mapped);
          else roots.push(mapped);
        }
        // VS Code expects a container's range to cover its nested symbols.
        // The core intentionally returns declaration-name ranges only.
        const expand = (symbol: VSCode.DocumentSymbol): VSCode.Range => {
          for (const child of symbol.children) {
            const range = expand(child);
            symbol.range = symbol.range.union(range);
          }
          return symbol.range;
        };
        roots.forEach(expand);
        return roots;
      },
    }),
  );

  disposables.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      const uri = document.uri.toString();
      // Queue closure after outstanding synchronizations to avoid reopen races.
      const running = pending.get(uri);
      void (running ?? Promise.resolve()).finally(() => {
        versions.delete(uri);
        core.closeDocument(uri);
      }).catch(() => undefined);
    }),
    {
      dispose() {
        versions.clear();
        pending.clear();
        core.dispose();
      },
    },
  );
  return new vscode.Disposable(() => {
    for (const item of disposables.reverse()) item.dispose();
  });
}
