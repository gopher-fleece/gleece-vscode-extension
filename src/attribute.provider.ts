import { TextDocument, Position } from 'vscode';
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

export function getProvidersForEntireDocument(document: TextDocument): AttributesProvider[] {
	const commentBlocks: { startLine: number; endLine: number }[] = [];
	let currentBlockStart = -1;

	// Scan the document line by line
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i).text.trimStart();

		// If it's a comment line
		if (line.startsWith("//")) {
			// Start a new block if we're not already in one
			if (currentBlockStart === -1) {
				currentBlockStart = i;
			}
		} else {
			// If we're ending a comment block, record its range
			if (currentBlockStart !== -1) {
				commentBlocks.push({ startLine: currentBlockStart, endLine: i - 1 });
				currentBlockStart = -1;
			}
		}
	}

	// Handle a trailing comment block
	if (currentBlockStart !== -1) {
		commentBlocks.push({ startLine: currentBlockStart, endLine: document.lineCount - 1 });
	}

	// Parse comment blocks into `AttributesProvider`
	return commentBlocks.map(({ startLine, endLine }) => {
		const comments: CommentWithPosition[] = [];

		for (let i = startLine; i <= endLine; i++) {
			const line = document.lineAt(i);
			const trimmedText = line.text.trimStart();

			comments.push({
				text: trimmedText.trim(),
				range: line.range,
				startIndex: line.text.length - trimmedText.length, // Leading whitespace offset
			});
		}

		return new AttributesProvider(comments);
	});
}
