import {
	Diagnostic,
	DiagnosticCollection,
	Disposable,
	languages,
	TextDocument,
	TextDocumentChangeEvent
} from 'vscode';
import { getProvidersForRange, getProvidersForSymbols } from '../annotation/annotation.functional';
import { GoLangId } from '../common.constants';
import { AnnotationProvider } from '../annotation/annotation.provider';
import { GenericIntervalTree } from './interval.tree';
import { AnalysisMode } from '../configuration/extension.config';
import { semanticProvider } from '../semantics/semantics.provider';
import { gleeceContext } from '../context/context';
import { logger } from '../logging/logger';

export class GleeceDiagnosticsProvider implements Disposable {
	private _currentDocument?: TextDocument;
	private _diagnosticCollection: DiagnosticCollection;
	private _tree: GenericIntervalTree<AnnotationProvider>;

	public constructor() {
		this._diagnosticCollection = languages.createDiagnosticCollection('gleece');
		this._tree = new GenericIntervalTree();
	}

	public async onCurrentDocumentChanged(event: TextDocumentChangeEvent): Promise<void> {
		if (event.document.languageId !== GoLangId) {
			return;
		}

		this._currentDocument = event.document;
		const mode = gleeceContext.configManager.getExtensionConfigValue('analysis.mode');
		if (mode === AnalysisMode.Differential) {
			return this.differentialDiagnostics(event);
		}

		// Default to full diagnostics
		return await this.onDemandFullDiagnostics(event.document);
	}

	public async reAnalyzeLastDocument(): Promise<void> {
		if (this._currentDocument) {
			await this.onDemandFullDiagnostics(this._currentDocument);
		}
	}

	public async onDemandFullDiagnostics(document: TextDocument): Promise<void> {
		const logPrefix: string = '[GleeceDiagnosticsProvider.onDemandFullDiagnostic]';

		if (document.languageId !== GoLangId) {
			return;
		}

		// Keep track of the current file
		this._currentDocument = document;

		if (!gleeceContext.configManager.isGleeceProject) {
			// Not a gleece project, don't analyze
			return;
		}

		const start = Date.now(); // Need to define a better way than simple logs (preferably not application insights though)
		let diagnostics: Diagnostic[];
		const symbolicAnalysisEnabled = gleeceContext.configManager.getExtensionConfigValue('analysis.enableSymbolicAwareness');
		if (symbolicAnalysisEnabled) {
			diagnostics = await this.fullDiagnosticsWithSymbolicAnalysis(document);
		} else {
			diagnostics = this.fullDiagnosticsSlim(document);
		}

		this._tree.clear();

		this._diagnosticCollection.clear();
		this._diagnosticCollection.set(document.uri, diagnostics);
		const analysisTypeMsg = `${symbolicAnalysisEnabled ? 'with' : 'without'}`;
		logger.debug(
			`${logPrefix} Full diagnostics ${analysisTypeMsg} symbolic analysis performed in ${Date.now() - start}ms`
		);
	}

	protected fullDiagnosticsSlim(document: TextDocument): Diagnostic[] {
		if (document.languageId !== GoLangId) {
			return [];
		}

		const diagnostics: Diagnostic[] = [];

		const providers = getProvidersForRange(document);
		for (const provider of providers) {
			this._tree.insert(provider);
			if (!provider.isEmpty()) {
				diagnostics.push(...provider.getDiagnostics());
			}
		}

		return diagnostics;
	}

	protected async fullDiagnosticsWithSymbolicAnalysis(document: TextDocument): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		// Currently always refreshing the analyzer- keeping track of changes to this degree would be quite complex.
		// Not ideal but good enough for now.
		const analyzer = await semanticProvider.getAnalyzerForDocument(document, true);

		const providers = getProvidersForSymbols(document, analyzer.symbols);
		for (const provider of providers) {
			this._tree.insert(provider);
			if (!provider.isEmpty()) {
				diagnostics.push(...provider.getDiagnostics());
			}
		}

		return diagnostics;
	}

	private differentialDiagnostics(event: TextDocumentChangeEvent): void {
		if (event.document.languageId !== GoLangId) {
			return;
		}

		if ((event.contentChanges?.length > 0) == false) {
			return;
		}

		const start = Date.now();
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

		logger.debug(`Differential diagnostics performed in ${Date.now() - start}ms`);
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
			const updatedProviders = getProvidersForRange(event.document, scanStart, scanEnd);
			this._tree.insertMany(updatedProviders);
		}
	}

	public onDocumentClosed(document: TextDocument) {
		this._diagnosticCollection.delete(document.uri);
		if (document.uri === this._currentDocument?.uri) {
			this._currentDocument = undefined;
		}
	}

	public dispose() {
		this._diagnosticCollection.clear();
		this._diagnosticCollection.dispose();
	}
}
