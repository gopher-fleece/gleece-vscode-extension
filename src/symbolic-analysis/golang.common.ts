import { Range, DocumentSymbol } from 'vscode';

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

export interface TypeParam {
	range: Range;
	typeName: string;
}
