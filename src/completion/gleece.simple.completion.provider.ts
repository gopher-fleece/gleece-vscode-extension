import {
	CompletionItemProvider,
	CompletionItemLabel,
	CancellationToken,
	CompletionContext,
	CompletionItem,
	Position,
	ProviderResult,
	TextDocument
} from 'vscode';
import { AttributeNames, AttributeNamesCompletionObjects, RepeatableAttributes } from '../enums';
import { getAnnotationProvider } from '../annotation/annotation.functional';

export class SimpleCompletionProvider implements CompletionItemProvider {

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
}
