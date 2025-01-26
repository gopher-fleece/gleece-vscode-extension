import { DiagnosticCollection, languages, TextDocument, TextDocumentChangeEvent } from 'vscode';
import { getAttributesProvider } from './attribute.provider';

export const diagnosticCollection: DiagnosticCollection = languages.createDiagnosticCollection('gleece');

export function refreshDiagnosticsFull(document: TextDocument): void {
}

export function refreshDiagnosticsInScope(event: TextDocumentChangeEvent): void {
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
