import {
	Diagnostic,
	DiagnosticCollection,
	languages,
	TextDocument,
	TextDocumentChangeEvent
} from 'vscode';
import { getAttributesProvider, getProvidersForEntireDocument } from '../attribute.provider';
import { GoLangId } from '../common.constants';
import { AttributesProvider } from '../annotation.parser';
import { resourceManager } from '../extension';


export class GleeceDiagnosticsListener {
	private _diagnosticCollection: DiagnosticCollection;
	private _currentProviders: AttributesProvider[] = [];

	public constructor() {
		this._diagnosticCollection = languages.createDiagnosticCollection('gleece');
		resourceManager.registerDisposable(this._diagnosticCollection);
	}

	public fullDiagnostics(document: TextDocument): void {
		if (document.languageId !== GoLangId) {
			return;
		}

		const providers = getProvidersForEntireDocument(document);

		const diagnostics: Diagnostic[] = [];
		for (const holder of providers) {
			if (!holder.isEmpty()) {
				diagnostics.push(...holder.getDiagnostics());
			}
		}

		this._diagnosticCollection.clear();
		this._currentProviders = providers;

		this._diagnosticCollection.set(document.uri, diagnostics);
	}

	public differentialDiagnostics(event: TextDocumentChangeEvent): void {
		if (event.document.languageId !== GoLangId) {
			return;
		}

		if ((event.contentChanges?.length > 0) == false) {
			return;
		}


		this.updateProviders(event);

		const diagnostics: Diagnostic[] = [];
		for (const provider of this._currentProviders) {
			if (!provider.isEmpty()) {
				diagnostics.push(...provider.getDiagnostics(true));
			}
		}

		this._diagnosticCollection.clear();
		if (diagnostics.length > 0) {
			this._diagnosticCollection.set(event.document.uri, diagnostics);
		}
	}

	private updateProviders(event: TextDocumentChangeEvent) {
		// Calculate line shift for the change
		const lineShift = event.contentChanges.reduce((totalShift, change) => {
			const linesAdded = change.text.split('\n').length - 1; // Number of newlines in the added text
			const linesRemoved = change.range.end.line - change.range.start.line; // Lines removed in the range
			return totalShift + (linesAdded - linesRemoved);
		}, 0);

		const changeRange = event.contentChanges[0].range;

		// KNOWN BUG:
		// If user splits an annotation in two, i.e., adds a newline into an existing attribute provider,
		// it basically looses context as we now have 2 instead of one instance.

		// Iterate through all providers once
		this._currentProviders.forEach((provider, index) => {
			// If the provider starts AFTER the changed range, shift it
			if (provider.coveredRange.start.line > changeRange.end.line) {
				provider.shiftRange(lineShift);
				return;
			}

			const isSameLine = provider.coveredRange.start.line >= changeRange.start.line
				|| provider.coveredRange.end.line <= changeRange.end.line;

			if (isSameLine || provider.coveredRange.contains(changeRange) || changeRange.contains(provider.coveredRange)) {
				// If the provider overlaps with the changed range, check if content has changed
				const contentHasChanged = this.didContentChange(event, provider);

				if (contentHasChanged) {
					// Recreate the provider if content has changed
					const replacementProvider = getAttributesProvider(event.document, provider.coveredRange.start);
					this._currentProviders[index] = replacementProvider;
				} else {
					// If only range shift is needed, apply it
					provider.shiftRange(lineShift);
				}
			}
		});
	}

	private didContentChange(event: TextDocumentChangeEvent, provider: AttributesProvider): boolean {
		// Check if the text within the provider's covered range has actually changed
		const changes = event.contentChanges.filter(change =>
			provider.coveredRange.start.line <= change.range.end.line &&
			provider.coveredRange.end.line >= change.range.start.line
		);

		return changes.length > 0; // If any change overlaps with the provider, we consider it content change
	}

	public textDocumentClosed(document: TextDocument) {
		this._diagnosticCollection.delete(document.uri);
	}

	public deactivate(): void {
		this._diagnosticCollection.clear;
		this._currentProviders = [];
	}
}
