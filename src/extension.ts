
import {
	CodeActionKind,
	commands,
	ExtensionContext,
	languages,
	window,
	workspace
} from 'vscode';
import { GleeceProvider } from './gleece.completion.provider';
import { GoLangId } from './common.constants';
import { ResourceManager } from './resource.manager';
import { GleeceCodeActionProvider } from './code-actions/code.action.provider';
import { GleeceDiagnosticsListener } from './diagnostics/listener';

export let resourceManager: ResourceManager;

let completionAndHoverProvider: GleeceProvider;
let gleeceCodeActionsProvider: GleeceCodeActionProvider;
let diagnosticsListener: GleeceDiagnosticsListener;

export async function activate(context: ExtensionContext) {
	resourceManager = new ResourceManager(context);

	// Using dynamic imports so we can ensure the resource manager has its context first
	const { configManager } = (await import('./configuration/config.manager'));
	await configManager.init();

	completionAndHoverProvider = new GleeceProvider();
	gleeceCodeActionsProvider = new GleeceCodeActionProvider();
	diagnosticsListener = new GleeceDiagnosticsListener();

	context.subscriptions.push(
		languages.registerCompletionItemProvider(
			GoLangId,
			completionAndHoverProvider,
			'@'
		),
		languages.registerHoverProvider(
			{ scheme: 'file', language: GoLangId },
			completionAndHoverProvider
		),
		languages.registerCodeActionsProvider(
			{ scheme: 'file', language: GoLangId },
			gleeceCodeActionsProvider,
			{ providedCodeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll] }
		),
		workspace.onDidOpenTextDocument((document) => diagnosticsListener.fullDiagnostics(document)),
		workspace.onDidChangeTextDocument((event) => diagnosticsListener.differentialDiagnostics(event)),
		workspace.onDidCloseTextDocument((document) => diagnosticsListener.textDocumentClosed(document)),

		commands.registerCommand('gleece.reAnalyzeFile', () => {
			if (window.activeTextEditor) {
				diagnosticsListener.fullDiagnostics(window.activeTextEditor.document);
			} else {
				window.showWarningMessage('Cannot re-analyze - no file is open');
			}
		}),
	);

	// It would appear there might be a delay between when VS Code calls activate and the time
	// the active text editor updates.
	// While silly, a static timeout here seems to do the trick.
	setTimeout(
		() => {
			if (window.activeTextEditor) {
				diagnosticsListener.fullDiagnostics(window.activeTextEditor.document);
			}
		},
		300
	);
}

export function deactivate() {
	diagnosticsListener?.deactivate();
}
