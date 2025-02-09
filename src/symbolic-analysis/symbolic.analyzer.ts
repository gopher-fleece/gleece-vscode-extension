import { TextDocument, commands, DocumentSymbol, SymbolKind, Range, Uri, Position } from 'vscode';
import { GenericIntervalTree } from '../diagnostics/interval.tree';
import { GolangSymbol, GolangSymbolType } from './golang.common';
import { GolangReceiver } from './golang.receiver';
import { GolangStruct } from './gonlang.struct';
export class GolangSymbolicAnalyzer {
	private _document: TextDocument;

	private _structs: Map<string, GolangSymbol> = new Map();
	private _receivers: Map<string, GolangSymbol[]> = new Map();

	private _tree: GenericIntervalTree<GolangSymbol>;

	public get symbols(): GolangSymbol[] {
		return Array.from(this._structs.values()).concat(Array.from(this._receivers.values()).flat());
	}

	public get documentUri(): Uri {
		return this._document.uri;
	}

	public constructor(document: TextDocument) {
		if (!document) {
			throw new Error('Document is null or undefined');
		}

		this._document = document;
		this._tree = new GenericIntervalTree<GolangSymbol>();
	}

	public findOneImmediatelyAfter(range: Range): GolangSymbol | undefined {
		return this._tree.findOneImmediatelyAfter(range);
	}

	public intersections(range: Range): GolangSymbol[] {
		return this._tree.searchAll(range);
	}

	/**
	 * Returns the symbol (if any) at the given position
	 * Note: If multiple symbols are found, only the first is returned
	 *
	 * @param {Position} pos
	 * @return {(GolangSymbol | undefined)}
	 * @memberof GolangSymbolicAnalyzer
	 */
	public getSymbolAtPosition(pos: Position): GolangSymbol | undefined {
		// Suboptimal. We're assuming realistic conditions here though so not a huge deal probably.
		const allMatches = this._tree.searchAll(new Range(pos, pos));
		return allMatches?.[0];
	}

	public async analyze(): Promise<Error | undefined> {
		// Execute VS Code's built-in document symbol provider
		const symbols = await commands.executeCommand<DocumentSymbol[]>(
			'vscode.executeDocumentSymbolProvider',
			this._document.uri
		);

		if (!symbols) {
			return new Error(`Could not retrieve symbols for document '${this._document.uri}'`);
		}

		this._tree.clear();

		// Iterate over the symbols to find structs and methods
		let entity: GolangSymbol | undefined;

		for (const symbol of symbols) {
			switch (symbol.kind) {
				case SymbolKind.Struct:
					const maybeController = new GolangStruct(symbol);
					if (maybeController.isController) {
						entity = maybeController;
						this._structs.set(symbol.name, entity);
					}
					break;
				case SymbolKind.Method:
					const isReceiver = /^\(\*?(?:\w+)\)\./.test(symbol.name);
					if (isReceiver) {
						const receiver = new GolangReceiver(this._document, symbol);
						entity = receiver;
						if (!this._receivers.has(receiver.ownerStructName)) {
							this._receivers.set(receiver.ownerStructName, [receiver]);
						} else {
							this._receivers.get(receiver.ownerStructName)!.push(receiver);
						}

					}
					break;
			}

			if (entity) {
				this._tree.insert(entity);
			}
		}
	}
}
