
import { ExtensionContext, window } from 'vscode';
import { gleeceContext } from './context/context';
import { logger } from './logging/logger';

export async function activate(context: ExtensionContext) {
	const start = Date.now();
	logger.debug('Gleece Extension activating...');

	await gleeceContext.init(context);
	context.subscriptions.push(gleeceContext);

	// It would appear there might be a delay between when VS Code calls activate and the time
	// the active text editor updates.
	// While silly, a static timeout here seems to do the trick.
	setTimeout(
		() => {
			if (window.activeTextEditor) {
				gleeceContext.diagnosticsListener.onDemandFullDiagnostics(window.activeTextEditor.document)
					.catch((err) => logger.error('Could not analyze file', err));
			}
		},
		500
	);

	logger.debug(`Gleece Extension activated in ${Date.now() - start}ms`);
}

export function deactivate() {
	logger.debug('Gleece Extension deactivating...');
	const start = Date.now();
	gleeceContext.dispose();
	logger.debug(`Gleece Extension deactivated in ${Date.now() - start}ms`);
}
