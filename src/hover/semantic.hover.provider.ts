import {
	CompletionItemLabel,
	CancellationToken,
	CompletionContext,
	CompletionItem,
	Hover,
	Position,
	ProviderResult,
	TextDocument,
	HoverProvider,
	MarkdownString
} from 'vscode';
import { AttributeNames, AttributeNamesCompletionObjects, RepeatableAttributes } from '../enums';
import { getAnnotationProvider, getProvidersForSymbols } from '../annotation/annotation.functional';
import { semanticProvider } from '../semantics/semantics.provider';
import { GolangSymbolicAnalyzer } from '../symbolic-analysis/symbolic.analyzer';
import { GolangStruct } from '../symbolic-analysis/gonlang.struct';
import { GolangSymbolType } from '../symbolic-analysis/golang.common';
import { GolangReceiver } from '../symbolic-analysis/golang.receiver';
import { createMarkdownTable } from './markdown.factory';

export class SemanticHoverProvider implements HoverProvider {

	// Provide completion items dynamically based on the active document's annotations
	public provideCompletionItems(
		document: TextDocument,
		position: Position,
		_token: CancellationToken,
		_context: CompletionContext
	): ProviderResult<CompletionItem[]> {
		const line = document.lineAt(position);
		const text = line.text.trim();


		// Check if the cursor is in a place where we expect annotations (after '// @')
		if (text.startsWith('// @')) {
			return undefined;
		}

		const provider = getAnnotationProvider(document, position);

		const existingAttribNames = provider.getAttributeNames();
		const relevantCompletions = AttributeNamesCompletionObjects.filter((obj) => {
			const labelValue = (obj.label as CompletionItemLabel)?.label ?? obj.label;
			return RepeatableAttributes[labelValue as AttributeNames] || !existingAttribNames.includes(labelValue);
		});

		return relevantCompletions;
	}

	// Optionally, provide documentation for completions when user hovers over them
	public provideHover(
		document: TextDocument,
		position: Position,
		_token: CancellationToken
	): ProviderResult<Hover> {
		const line = document.lineAt(position);
		const text = line.text.trim();

		// If it's an annotation, show a hover with more information
		if (text.startsWith('// @')) {
			return this.onCommentHover(document, position);
		}

		return this.onUnknownHover(document, position);
	}

	private async onCommentHover(document: TextDocument, position: Position): Promise<Hover | undefined> {
		const provider = getAnnotationProvider(document, position);
		const analyzer = await semanticProvider.getAnalyzerForDocument(document, true);
		const annotatedSymbol = analyzer.findOneImmediatelyAfter(provider.range);
		if (annotatedSymbol) {
			//
		}

		return undefined;
	}

	private async onUnknownHover(document: TextDocument, position: Position): Promise<Hover | undefined> {
		const analyzer = await semanticProvider.getAnalyzerForDocument(document, true);
		const symbol = analyzer.getSymbolAtPosition(position);

		switch (symbol?.type) {
			case GolangSymbolType.Struct:
				if ((symbol as GolangStruct).isController) {
					return this.onControllerHover(document, analyzer, symbol as GolangStruct);
				}
				return undefined;
			case GolangSymbolType.Receiver:
				break;
			default:
				break;
		}
		return undefined;
	}

	private onControllerHover(
		document: TextDocument,
		analyzer: GolangSymbolicAnalyzer,
		struct: GolangStruct
	): Hover | undefined {
		const receivers = analyzer.symbols.filter((symbol) =>
			symbol.type === GolangSymbolType.Receiver
			&& (symbol as GolangReceiver).ownerStructName === struct.symbol.name
		) as GolangReceiver[];


		const receiverHolders = getProvidersForSymbols(document, receivers);

		return new Hover(
			createMarkdownTable(
				[
					{
						label: 'API',
						maxWidth: 45,
						values: receivers.map((r) => r.name)
					},
					{
						label: 'Method',
						maxWidth: 10,
						values: receiverHolders.map((r) => (r.getAttribute(AttributeNames.Method)?.value ?? ''))
					},
					{
						label: 'Route',
						maxWidth: 45,
						values: receiverHolders.map((r) => (`\`${r.getAttribute(AttributeNames.Route)?.value ?? ''}\``))
					}
				],
				new MarkdownString(`**${struct.symbol.name}**\n\n`)
			)
		);
	}
}
