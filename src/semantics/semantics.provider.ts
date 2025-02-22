import { TextDocument } from 'vscode';
import { GolangSymbolicAnalyzer } from '../symbolic-analysis/symbolic.analyzer';

class SymbolicProvider {
	private _symbolicAnalyzersMap: Map<string, GolangSymbolicAnalyzer> = new Map();
	private _symbolicAnalyzersArray: string[] = [];

	public async getAnalyzerForDocument(document: TextDocument, fresh: boolean): Promise<GolangSymbolicAnalyzer> {
		const maxAnalyzersInCache = 5;

		const existingAnalyzer = this._symbolicAnalyzersMap.get(document.uri.path);
		if (!existingAnalyzer || fresh) {
			const analyzer = new GolangSymbolicAnalyzer(document);
			await analyzer.analyze();

			if (this._symbolicAnalyzersMap.size > maxAnalyzersInCache) {
				const [removedDocumentUri] = this._symbolicAnalyzersArray.splice(0, 1);
				this._symbolicAnalyzersMap.delete(removedDocumentUri);
			}

			this._symbolicAnalyzersMap.set(document.uri.path, analyzer);
			this._symbolicAnalyzersArray.push(document.uri.path);
			return analyzer;
		}

		return existingAnalyzer;
	}
}

export const semanticProvider = new SymbolicProvider();
