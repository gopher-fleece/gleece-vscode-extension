import {
	Diagnostic,
	DiagnosticCollection,
	languages,
	TextDocument,
	TextDocumentChangeEvent,
} from 'vscode';
import { getProvidersForRange } from '../attribute.provider';
import { GoLangId } from '../common.constants';
import { AttributesProvider } from '../annotation.parser';
import { resourceManager } from '../extension';
import { GenericIntervalTree } from './interval.tree';
import { configManager } from '../configuration/config.manager';
import { AnalysisMode } from '../configuration/extension.config';

export class GleeceDiagnosticsListener {
	private _diagnosticCollection: DiagnosticCollection;
	private _tree: GenericIntervalTree<AttributesProvider>;

	public constructor() {
		this._diagnosticCollection = languages.createDiagnosticCollection('gleece');
		resourceManager.registerDisposable(this._diagnosticCollection);
		this._tree = new GenericIntervalTree();
	}

	public fullDiagnostics(document: TextDocument): void {
		if (document.languageId !== GoLangId) {
			return;
		}

		this._tree.clear();
		const diagnostics: Diagnostic[] = [];

		const providers = getProvidersForRange(document);
		for (const provider of providers) {
			this._tree.insert(provider);
			if (!provider.isEmpty()) {
				diagnostics.push(...provider.getDiagnostics());
			}
		}

		this._diagnosticCollection.clear();

		this._diagnosticCollection.set(document.uri, diagnostics);
	}

	public differentialDiagnostics(event: TextDocumentChangeEvent): void {
		if (event.document.languageId !== GoLangId) {
			return;
		}

		if ((event.contentChanges?.length > 0) == false) {
			return;
		}

		// This could be re-written as a private state mutated by an event.
		// A bit overkill for now though.
		if (configManager.getExtensionConfigValue('gleece.analysis.mode') === AnalysisMode.Full) {
			// Route the flow to the full diagnostics instead of the smarted albeit (probably) flawed differential flow
			return this.fullDiagnostics(event.document);
		}

		this.updateProviders(event);

		let diagnostics: Diagnostic[] = [];
		// This is far from ideal. We could just remove the correct diagnostics and re-check the specific providers
		// No practical difference but performance matters...
		for (const provider of this._tree.getAll()) {
			if (!provider.isEmpty()) {
				const errors = provider.getDiagnostics(true);
				diagnostics = diagnostics.concat(errors);
			}
		}

		this._diagnosticCollection.clear();
		if (diagnostics.length > 0) {
			this._diagnosticCollection.set(event.document.uri, diagnostics);
		}
	}

	private updateProviders(event: TextDocumentChangeEvent) {
		let scanStart: number = Number.MAX_SAFE_INTEGER;
		let scanEnd: number = Number.MIN_SAFE_INTEGER;

		for (const change of event.contentChanges) {
			const linesAdded = change.text.split('\n').length - 1; // Number of newlines in the added text
			const linesRemoved = change.range.end.line - change.range.start.line; // Lines removed in the range

			const lineShift = linesAdded - linesRemoved;
			const lineShiftAbs = Math.abs(lineShift);

			const intersections = this._tree.searchAll(change.range);
			const { before, after } = this._tree.findClosest(change.range);

			if (before) {
				this._tree.remove(before);
				scanStart = Math.min(before.range.start.line - lineShiftAbs, scanStart);
				scanEnd = Math.max(before.range.end.line + lineShiftAbs + 1, scanEnd);
			}

			if (after) {
				// Remove the closes node after the change to make sure we capture everything, even during
				// comment block merges/splits
				this._tree.remove(after);
				scanStart = Math.min(after.range.start.line - lineShiftAbs, scanStart);
				scanEnd = Math.max(after.range.end.line + lineShiftAbs + 1, scanEnd);

				const entitiesToShift = this._tree.findAfter(after.range);
				entitiesToShift.forEach((entity) => {
					// Have to update the tree or we loose track of the actual ranges
					this._tree.remove(entity);
					entity.shiftRange(lineShift);
					this._tree.insert(entity);
				});
			}

			for (const provider of intersections) {
				this._tree.remove(provider);
				scanStart = Math.min(provider.range.start.line - lineShiftAbs, scanStart);
				scanEnd = Math.max(provider.range.end.line + lineShiftAbs + 1, scanEnd);
			}
		}

		if (scanStart !== Number.MAX_SAFE_INTEGER && scanEnd !== Number.MIN_SAFE_INTEGER) {
			const updatedProviders = getProvidersForRange(event.document, scanStart, scanEnd)
			this._tree.insertMany(updatedProviders);
		}
	}

	public textDocumentClosed(document: TextDocument) {
		this._diagnosticCollection.delete(document.uri);
	}

	public deactivate(): void {
		this._diagnosticCollection.clear();
	}
}
