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
import { AttributeNames, AttributeNamesCompletionObjects, KnownJsonProperties, RepeatableAttributes } from '../enums';
import { getAnnotationProvider, getProviderForSymbol, getProvidersForSymbols } from '../annotation/annotation.functional';
import { semanticProvider } from '../semantics/semantics.provider';
import { GolangSymbolicAnalyzer } from '../symbolic-analysis/symbolic.analyzer';
import { GolangStruct } from '../symbolic-analysis/gonlang.struct';
import { GolangSymbol, GolangSymbolType } from '../symbolic-analysis/golang.common';
import { GolangReceiver } from '../symbolic-analysis/golang.receiver';
import { createMarkdownTable } from '../common/markdown.factory';
import { gleeceContext } from '../context/context';
import { AnnotationProvider, Attribute } from '../annotation/annotation.provider';

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
		const analyzer = await semanticProvider.getAnalyzerForDocument(document, true);
		const annotations = getAnnotationProvider(document, position);
		const symbol = analyzer.findOneImmediatelyAfter(annotations.range);
		return this.getHoverForSymbol(document, analyzer, symbol);
	}

	private async onUnknownHover(document: TextDocument, position: Position): Promise<Hover | undefined> {
		const analyzer = await semanticProvider.getAnalyzerForDocument(document, true);
		const symbol = analyzer.getSymbolAtPosition(position);
		return this.getHoverForSymbol(document, analyzer, symbol);
	}

	private getHoverForSymbol(document: TextDocument, analyzer: GolangSymbolicAnalyzer, symbol?: GolangSymbol): Hover | undefined {
		switch (symbol?.type) {
			case GolangSymbolType.Struct:
				if ((symbol as GolangStruct).isController) {
					return this.onControllerHover(document, analyzer, symbol as GolangStruct);
				}
				break;
			case GolangSymbolType.Receiver:
				return this.onReceiverHover(document, analyzer, (symbol as GolangReceiver));
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

	private onReceiverHover(
		document: TextDocument,
		analyzer: GolangSymbolicAnalyzer,
		receiver: GolangReceiver
	): Hover | undefined {
		const annotations = getProviderForSymbol(document, receiver);
		if (!annotations) {
			// Func has no comments. Ignore
			return undefined;
		}

		const parentController = analyzer.getStructByName(receiver.ownerStructName);
		const markdown = new MarkdownString(`**${receiver.name}** (*${parentController?.symbol.name ?? 'N/A'}*)\n\n`);

		const method = annotations.getAttribute(AttributeNames.Method)?.value ?? 'N/A';
		const route = annotations.getAttribute(AttributeNames.Route)?.value ?? 'N/A';

		markdown.appendMarkdown(`*${method}* \`${route}\`\n`);
		this.appendReceiverSecurityMarkdown(document, analyzer, receiver, annotations, markdown);

		return new Hover(markdown);
	}

	private appendReceiverSecurityMarkdown(
		document: TextDocument,
		analyzer: GolangSymbolicAnalyzer,
		receiver: GolangReceiver,
		annotationsForSymbol: AnnotationProvider,
		markdown: MarkdownString
	): void {
		const methodSecurities = annotationsForSymbol.getSecurities();
		if (methodSecurities?.length > 0) {
			markdown.appendMarkdown('- Security - Explicit\n');
			for (const secAttr of methodSecurities) {
				markdown.appendMarkdown(`	- *${secAttr.value ?? 'N/A'}* : ${this.getSecurityScopesString(secAttr)}\n`);
			}

			return;
		}

		const parentController = analyzer.getStructByName(receiver.ownerStructName);
		if (!parentController || !parentController.isController) {
			// Shouldn't happen but just in case.
			return;
		}

		const controllerAnnotations = getProviderForSymbol(document, parentController);
		if (controllerAnnotations) {
			const controllerSecurities = controllerAnnotations.getSecurities();
			if (controllerSecurities.length > 0) {
				markdown.appendMarkdown('- Security - Inherited\n');
				for (const secAttr of controllerSecurities) {
					markdown.appendMarkdown(`	- *${secAttr.value ?? 'N/A'}* : ${this.getSecurityScopesString(secAttr)}\n`);
				}

				return;
			}
		}

		const defaultSecurity = gleeceContext.configManager.gleeceConfig?.openAPIGeneratorConfig.defaultSecurity;
		if (defaultSecurity) {
			markdown.appendMarkdown('- Security - Default\n');
			markdown.appendMarkdown(`	- *${defaultSecurity.name}* : ${defaultSecurity.scopes.map((s) => `*${s}*`).join(', ')}\n`);
			return;
		}

		markdown.appendMarkdown('- Security - **None**');
		return;
	}

	private getSecurityScopesString(attribute: Attribute): string {
		const scopes = attribute.properties?.[KnownJsonProperties.SecurityScopes];
		if (scopes && Array.isArray(scopes)) {
			return scopes.map((s) => `*${s}*`).join(', ');
		}
		return 'N/A';
	}
}
