
import {
	CodeActionKind,
	commands,
	ExtensionContext,
	languages,
	window,
	workspace
} from 'vscode';
import { GoLangId } from './common.constants';
import { gleeceContext } from './context/context';
import { logger } from './logging/logger';

export async function activate(context: ExtensionContext) {
	// DO NOT CALL LOGGER ABOVE THIS POINT.
	await gleeceContext.init(context);
	logger.debug('Gleece Extension activating...');
	context.subscriptions.push(
		languages.registerCompletionItemProvider(
			GoLangId,
			gleeceContext.completionAndHoverProvider,
			'@'
		),
		languages.registerHoverProvider(
			{ scheme: 'file', language: GoLangId },
			gleeceContext.hoverProvider
		),
		languages.registerCodeActionsProvider(
			{ scheme: 'file', language: GoLangId },
			gleeceContext.codeActionsProvider,
			{ providedCodeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll] }
		),
		workspace.onDidOpenTextDocument((document) => gleeceContext.diagnosticsListener.fullDiagnostics(document)),
		workspace.onDidChangeTextDocument((event) => gleeceContext.diagnosticsListener.differentialDiagnostics(event)),
		workspace.onDidCloseTextDocument((document) => gleeceContext.diagnosticsListener.textDocumentClosed(document)),

		commands.registerCommand('gleece.reAnalyzeFile', () => {
			if (window.activeTextEditor) {
				gleeceContext.diagnosticsListener.fullDiagnostics(window.activeTextEditor.document)
					.catch((err) => logger.error('Could not re-analyze file', err));
			} else {
				window.showWarningMessage('Cannot re-analyze - no file is open');
			}
		})
	);

	// It would appear there might be a delay between when VS Code calls activate and the time
	// the active text editor updates.
	// While silly, a static timeout here seems to do the trick.
	setTimeout(
		() => {
			if (window.activeTextEditor) {
				gleeceContext.diagnosticsListener.fullDiagnostics(window.activeTextEditor.document)
					.catch((err) => logger.error('Could not analyze file', err));
			}
		},
		500
	);
	logger.debug('Gleece Extension activated');
}

export function deactivate() {
	logger.debug('Gleece Extension deactivating...');
	gleeceContext.deactivate();
	logger.debug('Gleece Extension deactivated');
}
