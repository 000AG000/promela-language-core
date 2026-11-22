// Runs INSIDE an actual VS Code Extension Host, not plain Node.js.
// The installed extension's DefinitionProvider must be invoked by VS Code.
const assert = require('node:assert/strict');
const vscode = require('vscode');
const fs = require('node:fs');

exports.run = async function run() {
  try {
  const source = 'byte counter; init { counter = 1; }';
  const document = await vscode.workspace.openTextDocument({
    language: 'promela',
    content: source,
  });
  const editor = await vscode.window.showTextDocument(document);

  // A language activation event should load the sample extension automatically.
  const extension = vscode.extensions.all.find(
    (candidate) => candidate.packageJSON?.name === 'promela-core-vscode-sample',
  );
  assert.ok(extension, 'The ProMeLa sample extension was not loaded by the test host');
  await extension.activate();

  const definitions = await vscode.commands.executeCommand(
    'vscode.executeDefinitionProvider',
    document.uri,
    new vscode.Position(0, source.lastIndexOf('counter')),
  );
  assert.ok(Array.isArray(definitions) && definitions.length > 0, 'F12 provider returned no definitions');
  const target = definitions[0];
  const location = target.targetUri ? target.targetSelectionRange : target.range;
  assert.deepEqual([location.start.line, location.start.character], [0, 5]);

  const replacement = 'byte updated; init { updated = 1; }';
  const edited = await editor.edit((edit) => {
    edit.replace(new vscode.Range(0, 0, 0, source.length), replacement);
  });
  assert.equal(edited, true, 'Unable to modify document in the test editor');
  assert.equal(document.isDirty, true, 'Updated test document should still be unsaved');
  const updatedDefinitions = await vscode.commands.executeCommand(
    'vscode.executeDefinitionProvider',
    document.uri,
    new vscode.Position(0, replacement.lastIndexOf('updated')),
  );
  assert.ok(Array.isArray(updatedDefinitions) && updatedDefinitions.length > 0);
  const updated = updatedDefinitions[0];
  const updatedRange = updated.targetUri ? updated.targetSelectionRange : updated.range;
  assert.deepEqual([updatedRange.start.line, updatedRange.start.character], [0, 5]);
  if (process.env.PROMELA_E2E_RESULT_FILE) {
    fs.writeFileSync(process.env.PROMELA_E2E_RESULT_FILE, JSON.stringify({
      status: 'passed',
      test: 'promela-definition-provider',
    }));
  }
  console.log('PASS: real VS Code provider assertions executed.');
  } catch (error) {
    if (process.env.PROMELA_E2E_RESULT_FILE) {
      fs.writeFileSync(process.env.PROMELA_E2E_RESULT_FILE, JSON.stringify({
        status: 'failed',
        test: 'promela-definition-provider',
        message: error instanceof Error ? error.stack || error.message : String(error),
      }));
    }
    throw error;
  }
};
