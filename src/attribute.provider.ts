import { TextDocument, Position, Range } from 'vscode';
import { AttributesProvider, CommentWithPosition } from './annotation.parser';

export function getAttributesProvider(document: TextDocument, position: Position): AttributesProvider {
	// Extract comments relevant to the cursor (above and below), including their line positions
	const comments = getSurroundingComments(document, position);

	// Switch context
	return new AttributesProvider(comments);
}

function getSurroundingComments(document: TextDocument, position: Position): CommentWithPosition[] {
	const comments: CommentWithPosition[] = [];
	const totalLines = document.lineCount;
	let currentLine = position.line;

	// Extract comments above the cursor
	while (currentLine >= 0) {
		const lineObject = document.lineAt(currentLine);
		const trimmedStartText = lineObject.text.trimStart();
		if (!trimmedStartText.startsWith("//")) {
			break; // Stop if we hit a non-comment line
		}

		comments.unshift({
			text: trimmedStartText.trim(),
			range: lineObject.range,
			startIndex: lineObject.text.length - trimmedStartText.length,
		});
		currentLine--;
	}

	// Extract comments below the cursor
	currentLine = position.line + 1;
	while (currentLine < totalLines) {
		const lineObject = document.lineAt(currentLine);
		const trimmedStartText = lineObject.text.trimStart();
		if (!trimmedStartText.startsWith("//")) {
			break; // Stop if we hit a non-comment line
		}
		comments.push({
			text: trimmedStartText.trim(),
			range: lineObject.range,
			startIndex: lineObject.text.length - trimmedStartText.length,
		});
		currentLine++;
	}

	return comments;
}
