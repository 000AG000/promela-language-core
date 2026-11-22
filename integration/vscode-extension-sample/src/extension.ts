import * as vscode from 'vscode';
import { createLanguageCore } from 'promela-language-core';
import { registerLanguageFeatures } from './providers.js';

let activeRegistration: vscode.Disposable | undefined;

// Reference integration only: the production extension owns its SPIN and
// TextMate features, document events, and actual registration lifecycle.
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const core = createLanguageCore();
  try {
    await core.initialize();
    activeRegistration = registerLanguageFeatures(vscode, core);
    context.subscriptions.push(activeRegistration);
  } catch (error) {
    core.dispose();
    throw error;
  }
}

export function deactivate(): void {
  // Explicit cleanup is safe even if VS Code also disposes subscriptions.
  activeRegistration?.dispose();
  activeRegistration = undefined;
}
