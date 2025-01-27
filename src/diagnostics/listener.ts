import { Diagnostic, DiagnosticCollection, languages, TextDocument, TextDocumentChangeEvent } from 'vscode';
import { getAttributesProvider, getCommentBlocks } from '../attribute.provider';
import { GoLangId } from '../common.constants';

export const diagnosticCollection: DiagnosticCollection = languages.createDiagnosticCollection('gleece');

export function refreshDiagnosticsFull(document: TextDocument): void {
	if (document.languageId !== GoLangId) {
		return;
	}

	const holders = getCommentBlocks(document);

	const diagnostics: Diagnostic[] = [];
	for (const holder of holders) {
		if (!holder.isEmpty()) {
			diagnostics.push(...holder.validate());
		}
	}

	diagnosticCollection.clear();
	diagnosticCollection.set(document.uri, diagnostics);
}

export function refreshDiagnosticsInScope(event: TextDocumentChangeEvent): void {
	if (event.document.languageId !== GoLangId) {
		return;
	}

	if ((event.contentChanges?.length > 0) == false) {
		return
	}

	diagnosticCollection.clear();

	const holder = getAttributesProvider(event.document, event.contentChanges[0].range.start);
	if (holder.isEmpty()) {
		return
	}

	const validationErrors = holder.validate();
	if (validationErrors.length > 0) {
		diagnosticCollection.set(event.document.uri, validationErrors);
	}
}
