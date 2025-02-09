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
	MarkdownString,
} from 'vscode';
import { AttributeNames, AttributeNamesCompletionObjects, RepeatableAttributes } from '../enums';
import { getAnnotationProvider, getProvidersForSymbols } from '../annotation/annotation.functional';
import { semanticProvider } from '../semantics/semantics.provider';
import { GolangSymbolicAnalyzer } from '../symbolic-analysis/symbolic.analyzer';
import { GolangStruct } from '../symbolic-analysis/gonlang.struct';
import { GolangSymbolType } from '../symbolic-analysis/golang.common';
import { GolangReceiver } from '../symbolic-analysis/golang.receiver';
import dedent from 'dedent';

export class SemanticHoverProvider implements HoverProvider {

	// Provide completion items dynamically based on the active document's annotations
	public provideCompletionItems(
		document: TextDocument,
		position: Position,
		token: CancellationToken,
		context: CompletionContext
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
		token: CancellationToken
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
				const struct = symbol as GolangStruct;
				if (struct.isController) {
					return this.onControllerHover(document, analyzer, struct);
				}
				return undefined;
			case GolangSymbolType.Receiver:
				break;
			default:
				break
		}
		return undefined;
	}

	private async onControllerHover(
		document: TextDocument,
		analyzer: GolangSymbolicAnalyzer,
		struct: GolangStruct
	): Promise<Hover | undefined> {
		const receivers = analyzer.symbols.filter((symbol) =>
			symbol.type === GolangSymbolType.Receiver
			&& (symbol as GolangReceiver).ownerStructName === struct.symbol.name
		) as GolangReceiver[];


		const receiverHolders = getProvidersForSymbols(document, receivers);
		const markdown = new MarkdownString('<div>', true); // Open a main div
		markdown.isTrusted = true;
		markdown.supportHtml = true;

		markdown.appendMarkdown(dedent(`
			<span style='color:var(--vscode-symbolIcon-classForeground);'>
				${struct.symbol.name}
			</span>
		`));

		for (let i = 0; i < receiverHolders.length; i++) {
			const annotations = receiverHolders[i];
			const verb = annotations.getAttribute(AttributeNames.Method)?.value ?? 'UNKNOWN';
			const route = annotations.getAttribute(AttributeNames.Route)?.value ?? 'UNKNOWN';
			markdown.appendMarkdown(dedent(`
				<div>
					<span style='color:var(--vscode-symbolIcon-methodForeground);'>${receivers[i].name}</span>
					<span style='color:var(--vscode-symbolIcon-structForeground);'>${verb}</span>
					<span style='color:var(--vscode-symbolIcon-stringForeground);'>${route}</span>
				</div>
			`));
		}

		markdown.appendMarkdown('</div>'); // Close the main div
		return new Hover(markdown);
	}
}
