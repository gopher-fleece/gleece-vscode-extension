import { TextDocument, commands, DocumentSymbol, SymbolKind, Range, Uri } from 'vscode';
import { GenericIntervalTree } from '../diagnostics/interval.tree';
import { inspect } from 'util';

export enum GolangSymbolType {
	Struct,
	Receiver,
}

export abstract class GolangSymbol {
	public abstract get type(): GolangSymbolType;

	public get range(): Range {
		return this.symbol.range;
	}

	public constructor(public readonly symbol: DocumentSymbol) { }
}

export interface ReceiverParameter {
	name: string;
	typeName: string;
}

export interface ReceiverReturnValue {
	typeName: string;
}

export class GolangReceiver extends GolangSymbol {
	public readonly name: string;
	public readonly isByRef: boolean;
	public readonly ownerStructName: string;
	public readonly parameters: ReceiverParameter[];
	public readonly returnTypes: ReceiverReturnValue[];

	public get type(): GolangSymbolType {
		return GolangSymbolType.Receiver;
	}

	public constructor(document: TextDocument, symbol: DocumentSymbol) {
		super(symbol);

		const match = symbol.name.match(/^\((?<isByRef>\*)?(?<typeName>\w+)\)\.(?<methodName>.+)/);
		const name = match?.groups?.['methodName'];
		const ownerStructName = match?.groups?.['typeName'];
		const isByRef = match?.groups?.['isByRef'] === '*';

		if (!ownerStructName || !name) {
			throw new Error(`Could not perform analysis of symbol: '${inspect(symbol)}'`);
		}

		this.name = name;
		this.ownerStructName = ownerStructName;
		this.isByRef = isByRef;
		const { parameters, returnTypes } = this.extractParamsAndRetVal(document);

		this.parameters = parameters;
		this.returnTypes = returnTypes;
	}

	private extractParamsAndRetVal(document: TextDocument): { parameters: ReceiverParameter[], returnTypes: ReceiverReturnValue[] } {
		const decl = document.getText(this.symbol.range).trim().replace(/(?:[\r\n])|\n|\t/igm, ' ');
		const matches = /func\s+\(.+?\)\s+[A-Za-z_][A-Za-z0-9_]*\((?<sig>.+?)?\)\s*(?<ret>(?:[A-Za-z_][A-Za-z0-9_]*)|(?:\(.+\)))?/.exec(decl);

		const sig = matches?.groups?.['sig']?.trim()?.replace(/^\(|\)$/igm, '');
		const ret = matches?.groups?.['ret']?.trim()?.replace(/^\(|\)$/igm, '');

		let parameters: ReceiverParameter[] = [];
		let returnTypes: ReceiverReturnValue[] = [];

		if (sig) {
			const trimmedParts = sig.split(',').map((part) => part.trim());
			for (const arg of trimmedParts) {
				if (!arg || /^\s*$/.test(arg)) {
					continue; // Empty arg- parsing junk
				}
				const [name, typeName] = arg.split(' ').map((part) => part.trim());
				parameters.push({ name, typeName });
			}
		}

		if (ret) {
			const trimmedParts = ret.split(',').map((part) => part.trim());
			trimmedParts.forEach((typeName) => returnTypes.push({ typeName }));
		}

		return { parameters, returnTypes };
	}
}

export class GolangStruct extends GolangSymbol {
	public get type(): GolangSymbolType {
		return GolangSymbolType.Struct;
	}
}

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

	public async analyze(): Promise<Error | undefined> {
		// Execute VS Code's built-in document symbol provider
		const symbols = await commands.executeCommand<DocumentSymbol[]>(
			'vscode.executeDocumentSymbolProvider',
			this._document.uri
		);

		if (!symbols) {
			return new Error(`Could not retrieve symbols for document '${this._document.uri}'`)
		}

		this._tree.clear();

		// Iterate over the symbols to find structs and methods
		let entity: GolangSymbol | undefined;

		for (const symbol of symbols) {
			switch (symbol.kind) {
				case SymbolKind.Struct:
					entity = new GolangStruct(symbol);
					this._structs.set(symbol.name, entity);
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
