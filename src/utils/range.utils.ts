import { Range, Position } from 'vscode';

export function combineRanges(ranges: Range[]): Range {
	let minStart: Position = ranges[0].start;
	let maxEnd: Position = ranges[0].end;

	// Iterate over all ranges to find the earliest start and latest end.
	for (const range of ranges) {
		if (range.start.isBefore(minStart)) {
			minStart = range.start;
		}
		if (range.end.isAfter(maxEnd)) {
			maxEnd = range.end;
		}
	}

	return new Range(minStart, maxEnd);
}
