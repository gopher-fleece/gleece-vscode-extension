import { TextDocument, Position, Range } from 'vscode';
import { AnnotationProvider, Attribute, CommentWithPosition } from './annotation.provider';
import { GolangSymbol } from '../symbolic-analysis/golang.common';
import { KnownJsonProperties } from '../enums';

export function getAnnotationProvider(document: TextDocument, position: Position): AnnotationProvider {
	// Extract comments relevant to the cursor (above and below), including their line positions
	const comments = getSurroundingComments(document, position);
	return new AnnotationProvider(comments);
}

function getSurroundingComments(document: TextDocument, position: Position): CommentWithPosition[] {
	const comments: CommentWithPosition[] = [];
	const totalLines = document.lineCount;
	let currentLine = position.line;

	// Extract comments above the cursor
	while (currentLine >= 0) {
		const lineObject = document.lineAt(currentLine);
		const trimmedStartText = lineObject.text.trimStart();
		if (!trimmedStartText.startsWith('//')) {
			break; // Stop if we hit a non-comment line
		}

		comments.unshift({
			text: trimmedStartText.trim(),
			range: lineObject.range,
			startIndex: lineObject.text.length - trimmedStartText.length
		});
		currentLine--;
	}

	// Extract comments below the cursor
	currentLine = position.line + 1;
	while (currentLine < totalLines) {
		const lineObject = document.lineAt(currentLine);
		const trimmedStartText = lineObject.text.trimStart();
		if (!trimmedStartText.startsWith('//')) {
			break; // Stop if we hit a non-comment line
		}
		comments.push({
			text: trimmedStartText.trim(),
			range: lineObject.range,
			startIndex: lineObject.text.length - trimmedStartText.length
		});
		currentLine++;
	}

	return comments;
}

export function getProvidersForSymbols(document: TextDocument, symbols: GolangSymbol[]): AnnotationProvider[] {
	const providers: AnnotationProvider[] = [];
	for (const symbol of symbols) {
		const provider = getProviderForSymbol(document, symbol);
		if (provider) {
			providers.push(provider);
		}
	}
	return providers;
}

export function getProviderForSymbol(document: TextDocument, symbol: GolangSymbol): AnnotationProvider | undefined {
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
			startIndex: line.firstNonWhitespaceCharacterIndex
		});

		currentLine--;
	}

	// If no comments were found, return undefined
	if (comments.length === 0) {
		return undefined;
	}

	return new AnnotationProvider(comments, symbol);
}
export function getProvidersForRange(document: TextDocument, startLine?: number, endLine?: number): AnnotationProvider[] {
	const providers: AnnotationProvider[] = [];
	let comments: CommentWithPosition[] = [];

	const scanStart = startLine ?? 0;
	const scanEnd = endLine ?? document.lineCount;

	for (let i = scanStart; i < scanEnd; i++) {
		const line = document.lineAt(i);
		const trimmedText = line.text.trimStart();

		if (trimmedText.startsWith('//')) {
			// Collect comment line
			comments.push({
				text: trimmedText,
				range: line.range,
				startIndex: line.text.length - trimmedText.length // Leading whitespace offset
			});
		} else if (comments.length > 0) {
			// If we hit a non-comment and had collected comments, create a provider
			providers.push(new AnnotationProvider(comments));
			comments = []; // Reset for the next block
		}
	}

	// Final block handling
	if (comments.length > 0) {
		providers.push(new AnnotationProvider(comments));
	}

	return providers;
}

export function getAttributeRange(attribute: Attribute): Range {
	// Should re-write Attribute to a class...

	// A bit awkward but we need to take up until the end of the attribute line which is not tracked in the attribute interface itself.
	const endRange = attribute.descriptionRange ?? attribute.propertiesRange ?? attribute.valueRange ?? attribute.nameRange;
	return new Range(
		attribute.nameRange.start.line,
		0,
		endRange.end.line,
		endRange.end.character
	);
}

/**
 * Gets an attribute's Name **property**, if one exists, or its value, if it does not.
 * The returned value (if defined) can serve as an alias. For example, given a @Path attribute,
 * the alias will be the expected URL parameter name and **not** the function parameter name
 *
 * @export
 * @param {Attribute} attribute
 * @return {string}
 */
export function getAttributeAlias(attribute: Attribute): string | undefined {
	return attribute.properties?.[KnownJsonProperties.Name] ?? attribute.value;
}

export function getAttributeValueRangeOrFullRange(attribute: Attribute): Range {
	return attribute.valueRange ?? getAttributeRange(attribute);
}

