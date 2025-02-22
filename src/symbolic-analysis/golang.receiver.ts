import { inspect } from 'util';
import { TextDocument, DocumentSymbol, Range } from 'vscode';
import { TypeParam, GolangSymbol, GolangSymbolType } from './golang.common';

export interface ReceiverParameter extends TypeParam {
	name: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ReceiverReturnValue extends TypeParam {
	// For future extension
}

export class GolangReceiver extends GolangSymbol {
	public readonly name: string;
	public readonly isByRefReceiver: boolean;
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
		this.isByRefReceiver = isByRef;
		const { parameters, returnTypes } = this.extractParamsAndRetVal(document);

		this.parameters = parameters;
		this.returnTypes = returnTypes;
	}

	public getParameterNames(): string[] {
		return this.parameters?.map((param) => param.name);
	}
	/**
	 * Given a function symbol (this.symbol) and its underlying document,
	 * extract parameter and return type information along with their document ranges.
	 */
	private extractParamsAndRetVal(document: TextDocument): { parameters: ReceiverParameter[]; returnTypes: ReceiverReturnValue[] } {
		// Get the full function declaration text from the DocumentSymbol range.
		// (We assume this.symbol is the DocumentSymbol for the function.)
		const declRange = this.symbol.range;
		// Do not remove newlines so that offsets remain correct.
		const decl = document.getText(declRange).trim();

		// Use a regex with dotAll (/s) so that newlines are included.
		// This regex assumes the following shape:
		//   func (<receiver>) FunctionName(<parameter-signature>) <return-types> { ... }
		// It captures the parameter signature (named group "sig") and the return types (named group "ret")
		const funcRegex = /func\s+\((?:[\s\S]+?)\)\s+[A-Za-z_][A-Za-z0-9_]*\s*\((?<sig>[\s\S]*?)\)\s*(?<ret>(?:[A-Za-z_][A-Za-z0-9_]*)|(?:\([\s\S]*?\)))?/s;
		const matches = funcRegex.exec(decl);
		if (!matches || !matches.groups) {
			return { parameters: [], returnTypes: [] };
		}

		// The raw parameter signature and return types as strings.
		const signatureString = matches.groups['sig'] || '';
		const returnTypesString = matches.groups['ret'] || '';

		// Compute the base absolute offset for the decl text.
		// (That is, decl[0] corresponds to document.offsetAt(declRange.start))
		const baseOffset = document.offsetAt(declRange.start);

		const parameters = this.extractParameters(document, decl, baseOffset, signatureString);
		const returnTypes = this.extractRetVal(document, decl, baseOffset, returnTypesString);

		return { parameters, returnTypes };
	}

	private extractParameters(
		document: TextDocument,
		rawDeclaration: string,
		declarationStartOffset: number,
		signatureString: string
	): ReceiverParameter[] {
		// For simplicity, this regex expects each parameter to have the form:
		//     identifier whitespace type
		//
		// Note: This does not (yet) support multiple identifiers sharing one type (e.g. "a, b int")
		const parameters: ReceiverParameter[] = [];

		const sigIndex = rawDeclaration.indexOf(signatureString);
		const paramRegex = /(?<name>[A-Za-z_][A-Za-z0-9_]*)\s+(?<typeName>[\w.*[\]]+)/g;
		let paramMatch: RegExpExecArray | null;

		while ((paramMatch = paramRegex.exec(signatureString)) !== null) {
			const name = paramMatch.groups?.name;
			const typeName = paramMatch.groups?.typeName;
			if (!name || !typeName) {
				continue;
			}
			// Calculate the absolute offsets of the matched parameter.
			// paramMatch.index is the offset in sigStr.
			const matchStartInDecl = sigIndex + (paramMatch.index || 0);
			const matchEndInDecl = matchStartInDecl + (paramMatch[0]?.length || 0);

			// Convert absolute offsets to document Positions.
			const startPos = document.positionAt(declarationStartOffset + matchStartInDecl);
			const endPos = document.positionAt(declarationStartOffset + matchEndInDecl);
			const range = new Range(startPos, endPos);

			parameters.push({ name, typeName, range });
		}

		return parameters;
	}

	private extractRetVal(
		document: TextDocument,
		rawDeclaration: string,
		declarationStartOffset: number,
		returnTypesString: string
	): ReceiverReturnValue[] {
		const returnTypes: ReceiverReturnValue[] = [];

		// Trim parentheses from tuple return values (if relevant)
		let retTypesStr = returnTypesString;
		if (returnTypesString.startsWith('(') && returnTypesString.endsWith(')')) {
			retTypesStr = returnTypesString.slice(1, -1);
		}

		// Similarly, locate the return string in decl.
		const retIndex = rawDeclaration.indexOf(returnTypesString);
		const retRegex = /(?<typeName>[\w.*[\]]+)/g;
		let retMatch: RegExpExecArray | null;
		while ((retMatch = retRegex.exec(retTypesStr)) !== null) {
			const typeName = retMatch.groups?.typeName;
			if (!typeName) {
				continue;
			}

			// Compute the absolute offsets.
			const absoluteStart = retIndex + retMatch.index;
			const absoluteEnd = absoluteStart + retMatch[0].length;
			const startPos = document.positionAt(declarationStartOffset + absoluteStart);
			const endPos = document.positionAt(declarationStartOffset + absoluteEnd);
			const range = new Range(startPos, endPos);

			returnTypes.push({ typeName, range });
		}

		return returnTypes;
	}
}
