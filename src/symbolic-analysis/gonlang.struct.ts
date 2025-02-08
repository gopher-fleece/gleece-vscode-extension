import { GolangSymbol, GolangSymbolType } from './golang.common';

export class GolangStruct extends GolangSymbol {
	private static readonly ControllerTypeName = 'GleeceController';

	public get type(): GolangSymbolType {
		return GolangSymbolType.Struct;
	}

	public get isController(): boolean {
		const name = this.symbol.children?.[0].name;
		return !!name && (name === GolangStruct.ControllerTypeName || name.endsWith(`.${GolangStruct.ControllerTypeName}`));
	}
}
