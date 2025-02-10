import {
	CompletionItemProvider,
	CompletionItemLabel,
	CancellationToken,
	CompletionContext,
	CompletionItem,
	Hover,
	MarkdownString,
	Position,
	ProviderResult,
	TextDocument,
	HoverProvider
} from 'vscode';
import { AttributeDescriptions, AttributeNames, AttributeNamesCompletionObjects, RepeatableAttributes } from '../enums';
import { getAnnotationProvider } from '../annotation/annotation.functional';

export class SimpleCompletionProvider implements CompletionItemProvider, HoverProvider {

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
		if (!text.startsWith('// @')) {
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
		if (!text.startsWith('// @')) {
			return undefined;
		}

		const matches = /^\/\/\s+@(\w+)/.exec(text);
		if (!matches) {
			return undefined;
		}

		const provider = getAnnotationProvider(document, position);

		const attribute = provider.getAttribute(matches[1]);

		if (!attribute) {
			return undefined;
		}

		const markdown = new MarkdownString();
		markdown.appendMarkdown(`**Tag**: ${attribute.name}\n\n`);
		if (attribute.value) {
			markdown.appendMarkdown(`**Value**: ${attribute.value}\n\n`);
		}

		if (attribute.properties) {
			markdown.appendMarkdown(`**Properties**: ${JSON.stringify(attribute.properties, null, 2)}\n`);
		}

		if (attribute.description) {
			markdown.appendMarkdown(`**Description**: ${JSON.stringify(attribute.description, null, 2)}\n`);
		}

		const usageDescription = AttributeDescriptions[attribute.name as AttributeNames];
		if (usageDescription) {
			markdown.appendMarkdown(`\n\n\n${usageDescription}`);
		}

		return new Hover(markdown);
	}
}
