import { GolangSymbol, GolangSymbolType } from './golang.common';

export class GolangStruct extends GolangSymbol {
	public get type(): GolangSymbolType {
		return GolangSymbolType.Struct;
	}
}
