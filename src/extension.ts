
import { ExtensionContext, languages } from 'vscode';
import { GleeceProvider } from './gleece.completion.provider'; // Import the provider class

export function activate(context: ExtensionContext) {
	const completionAndHoverProvider = new GleeceProvider();

	// Register the completion provider for Go files (or any other language)
	context.subscriptions.push(
		languages.registerCompletionItemProvider(
			'go', // Language ID for Go
			completionAndHoverProvider, // The completion provider instance
			'@' // Trigger completion when "@" is typed
		),
		languages.registerHoverProvider(
			{ scheme: 'file', language: 'go' },
			completionAndHoverProvider
		)
	);
}

export function deactivate() {
	// Clean-up code if needed
}
