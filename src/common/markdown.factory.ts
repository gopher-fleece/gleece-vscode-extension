import { MarkdownString } from 'vscode';

export enum TextOverflow {
	Clip = 'clip',
	Ellipsis = 'ellipsis',
	String = 'string'
}

export interface MarkdownColumn {
	label: string;
	values: string[];
	maxWidth?: number;
	textOverflow?: TextOverflow;
}

/**
 * Creates a markdown table from the given data
 *
 * @export
 * @param {MarkdownColumn[]} columns The table's columns and values
 * @param {MarkdownString} [markdownToAppendTo] An optional MarkdownString to append to
 * @return {MarkdownString}
 */
export function createMarkdownTable(columns: MarkdownColumn[], markdownToAppendTo?: MarkdownString): MarkdownString {
	const columnWidths: number[] = [];
	let maxValues: number = 0;

	// Calculate the maximum width for each column
	for (const column of columns) {
		const columnMaxLength = Math.max(...column.values.map((v) => v.length), column.label.length);
		if (column.maxWidth) {
			columnWidths.push(Math.min(columnMaxLength, column.maxWidth));
		} else {
			columnWidths.push(columnMaxLength);
		}
		maxValues = Math.max(maxValues, column.values.length);
	}

	const markdown = markdownToAppendTo ?? new MarkdownString();

	// Build table top, header, and separator
	let tableTop = '┌─';
	let headers = '│ ';
	let headerSep = '├─';
	let tableFooter = '└─';

	for (let i = 0; i < columns.length; i++) {
		const colWidth = columnWidths[i];
		tableTop += '─'.repeat(colWidth);
		headers += columns[i].label.padEnd(colWidth);
		headerSep += '─'.repeat(colWidth);
		tableFooter += '─'.repeat(colWidth);

		if (i + 1 < columns.length) {
			tableTop += '─┬─';
			headers += ' │ ';
			headerSep += '─┼─';
			tableFooter += '─┴─';
		} else {
			tableTop += '─┐\n';
			headers += ' │\n';
			headerSep += '─┤\n';
			tableFooter += '─┘\n';
		}
	}

	markdown.appendMarkdown('```\n');
	markdown.appendMarkdown(tableTop);
	markdown.appendMarkdown(headers);
	markdown.appendMarkdown(headerSep);

	// Build table rows
	for (let rowIdx = 0; rowIdx < maxValues; rowIdx++) {
		let rowStr = '│ ';
		for (let colIdx = 0; colIdx < columns.length; colIdx++) {
			const value = columns[colIdx].values[rowIdx] ?? '';
			const valueWithOverflowBehavior = withOverflow(value, columnWidths[colIdx], columns[colIdx].textOverflow);
			rowStr += valueWithOverflowBehavior.padEnd(columnWidths[colIdx]);
			if (colIdx + 1 < columns.length) {
				rowStr += ' │ ';
			} else {
				rowStr += ' │';
			}
		}
		markdown.appendMarkdown(rowStr + '\n');
	}

	// Add table footer
	markdown.appendMarkdown(tableFooter);
	markdown.appendMarkdown('```\n');

	return markdown;
}

function withOverflow(text: string, maxLength: number, overflow?: TextOverflow): string {
	if (text.length < maxLength) {
		return text;
	}

	const quoteType = text[0] === text[text.length - 1] ? text[0] : undefined;

	switch (overflow) {
		case TextOverflow.Clip:
			return quoteType
				? text.slice(0, maxLength - 1) + quoteType
				: text.slice(0, maxLength);
		case TextOverflow.String:
			return text;
		case TextOverflow.Ellipsis:
		default:
			return quoteType
				? text.slice(0, maxLength - 4) + `${quoteType}...`
				: text.slice(0, maxLength - 3) + '...';
	}
}
