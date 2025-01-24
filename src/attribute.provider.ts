import { TextDocument, Position } from 'vscode';
import { AttributesProvider } from './annotation.parser';

export function getAttributesProvider(document: TextDocument, position: Position): AttributesProvider {
	// Extract comments relevant to the cursor (above and below)
	const comments = extractRelevantCommentsFromDocument(document, position);

	// Switch context
	return new AttributesProvider(comments);
}

function extractRelevantCommentsFromDocument(document: TextDocument, position: Position): string[] {
	const comments: string[] = [];
	const totalLines = document.lineCount;
	let currentLine = position.line;

	// Extract comments above the cursor
	while (currentLine >= 0) {
		const lineText = document.lineAt(currentLine).text.trim();
		if (!lineText.startsWith("//")) {
			break; // Stop if we hit a non-comment line
		}
		comments.unshift(lineText.trim()); // Add to the front of the array to keep the order
		currentLine--;
	}

	// Extract comments below the cursor
	currentLine = position.line + 1;
	while (currentLine < totalLines) {
		const lineText = document.lineAt(currentLine).text.trim();
		if (!lineText.startsWith("//")) {
			break; // Stop if we hit a non-comment line
		}
		comments.push(lineText.trim()); // Add after the cursor
		currentLine++;
	}

	return comments;
}