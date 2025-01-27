
import { ExtensionContext, languages, workspace } from 'vscode';
import { GleeceProvider } from './gleece.completion.provider'; // Import the provider class
import { diagnosticCollection, refreshDiagnosticsFull, refreshDiagnosticsInScope } from './diagnostics/listener';
import { configManager } from './configuration/config.manager';
import { GoLangId } from './common.constants';

export async function activate(context: ExtensionContext) {
	await configManager.init();
	const completionAndHoverProvider = new GleeceProvider();

	// Register the completion provider for Go files (or any other language)
	context.subscriptions.push(
		languages.registerCompletionItemProvider(
			GoLangId,
			completionAndHoverProvider, // The completion provider instance
			'@' // Trigger completion when "@" is typed
		),
		languages.registerHoverProvider(
			{ scheme: 'file', language: GoLangId },
			completionAndHoverProvider
		),
		workspace.onDidOpenTextDocument((document) => refreshDiagnosticsFull(document)),
		workspace.onDidChangeTextDocument((event) => refreshDiagnosticsInScope(event)),
		workspace.onDidCloseTextDocument((document) => diagnosticCollection.delete(document.uri))
	);

	workspace.textDocuments.forEach((document) => {
		refreshDiagnosticsFull(document);
	});
}

export function deactivate() {
	// Clean-up code if needed
}
