import { MarkdownString } from 'vscode';

export interface MarkdownColumn {
	label: string;
	values: string[];
	maxWidth?: number;
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
			rowStr += value.padEnd(columnWidths[colIdx]);
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
