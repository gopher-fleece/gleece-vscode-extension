import { TextDocument, Position } from 'vscode';
import { AttributesProvider, CommentWithPosition } from './annotation.parser';
import { GolangSymbol } from './symbolic-analysis/symbolic.analyzer';

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

export function getProvidersForSymbols(document: TextDocument, symbols: GolangSymbol[]): AttributesProvider[] {
	const providers: AttributesProvider[] = [];
	for (const symbol of symbols) {
		const provider = getProviderForSymbol(document, symbol);
		if (provider) {
			providers.push(provider);
		}
	}
	return providers;
}

export function getProviderForSymbol(document: TextDocument, symbol: GolangSymbol): AttributesProvider | undefined {
	if (!document.lineAt(symbol.range.start.line - 1).text.trim().startsWith('//')) {
		return undefined;
	}

	const comments: CommentWithPosition[] = [];
	let currentLine = symbol.range.start.line - 1; // Start scanning upwards

	// Scan upwards for contiguous comment lines
	while (currentLine >= 0) {
		const line = document.lineAt(currentLine);
		const trimmed = line.text.trim();

		// Stop if we hit non-comment code or an empty line
		if (!trimmed.startsWith('//')) {
			break;
		}

		// Insert at the start to preserve order
		comments.unshift({
			text: trimmed,
			range: line.range,
			startIndex: line.firstNonWhitespaceCharacterIndex,
		});

		currentLine--;
	}

	// If no comments were found, return undefined
	if (comments.length === 0) {
		return undefined;
	}

	return new AttributesProvider(comments, symbol);
}
export function getProvidersForRange(document: TextDocument, startLine?: number, endLine?: number): AttributesProvider[] {
	const providers: AttributesProvider[] = [];
	let comments: CommentWithPosition[] = [];

	const scanStart = startLine ?? 0;
	const scanEnd = endLine ?? document.lineCount;

	for (let i = scanStart; i < scanEnd; i++) {
		const line = document.lineAt(i);
		const trimmedText = line.text.trimStart();

		if (trimmedText.startsWith("//")) {
			// Collect comment line
			comments.push({
				text: trimmedText,
				range: line.range,
				startIndex: line.text.length - trimmedText.length, // Leading whitespace offset
			});
		} else if (comments.length > 0) {
			// If we hit a non-comment and had collected comments, create a provider
			providers.push(new AttributesProvider(comments));
			comments = []; // Reset for the next block
		}
	}

	// Final block handling
	if (comments.length > 0) {
		providers.push(new AttributesProvider(comments));
	}

	return providers;
}
