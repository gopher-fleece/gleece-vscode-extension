import json5 from "json5";
import { AttributeNames, KnownJsonProperties } from '../enums';
import { Diagnostic, Position, Range } from 'vscode';
import { Validators } from '../semantics/validators';
import { diagnosticError, diagnosticWarning } from '../diagnostics/helpers';
import { DiagnosticCode } from '../diagnostics/enums';
import { GolangSymbol, GolangSymbolType } from '../symbolic-analysis/golang.common';
import { GolangStruct } from '../symbolic-analysis/gonlang.struct';
import { ReceiverValidator } from './validation/receiver.validator';
import { GolangReceiver } from '../symbolic-analysis/golang.receiver';
import { StructValidator } from './validation/struct.validator';
import { combineRanges } from '../utils/range.utils';
import { getAttributeRange } from './annotation.functional';

interface GroupWithIndex {
	match: string;
	start: number;
	end: number;
}

// Interface for attributes with positional information
export interface Attribute {
	name: string;
	nameRange: Range;

	value?: string; // Optional, corresponds to the primary value inside parentheses
	valueRange?: Range;

	properties?: Record<string, any>; // Parsed JSON5 properties
	propertiesRange?: Range;
	propertiesParseError?: unknown;

	description?: string; // Additional text after the annotation
	descriptionRange?: Range;
}

// Interface for comments with positions
export interface CommentWithPosition {
	text: string;
	range: Range;
	startIndex: number;
}

// Interface for handling non-attribute comments with range
export interface NonAttributeComment {
	text: string;
	range: Range;
}

type AttributeCounts = { [Key in AttributeNames]: number };

export class AnnotationProvider {
	private _symbol?: GolangSymbol;
	private _attributes: Attribute[] = [];
	private _attributeCounts?: AttributeCounts;
	private _nonAttributeComments: NonAttributeComment[] = [];
	private _range: Range;
	private _lastValidationResult?: Diagnostic[];

	public get lastValidationResult(): Diagnostic[] {
		return this._lastValidationResult ?? [];
	}

	public get range(): Range {
		return this._range;
	}

	public constructor(comments: CommentWithPosition[], associatedSymbol?: GolangSymbol) {
		if (comments.length <= 0) {
			throw new Error("AttributeProvider called with no comments");
		}

		this._symbol = associatedSymbol;
		this.parseComments(comments);

		// We're operating on the assumption comments are ordered and each one spans exactly one line.
		const firstComment = comments[0];
		const lastComment = comments[comments.length - 1];
		this._range = new Range(
			new Position(firstComment.range.start.line, 0),
			new Position(lastComment.range.end.line, lastComment.text.length),
		);
	}

	public shiftRange(offsetLines: number): void {
		if (offsetLines === 0) {
			return;
		}

		this._range = new Range(
			new Position(this._range.start.line + offsetLines, 0),
			new Position(
				this._range.end.line + offsetLines,
				this._range.end.character - this._range.start.character
			),
		);

		// Adjust each diagnostic to its new range
		for (const diagnostic of this.lastValidationResult) {
			diagnostic.range = diagnostic.range.with(
				new Position(diagnostic.range.start.line + offsetLines, diagnostic.range.start.character),
				new Position(diagnostic.range.end.line + offsetLines, diagnostic.range.end.character),
			);
		}
	}

	public isEmpty(): boolean {
		return !(this._attributes?.length > 0) && !(this._nonAttributeComments.length > 0);
	}

	public hasAttribute(name: AttributeNames): boolean {
		return !!this.getAttribute(name);
	}

	public getAttribute(name: AttributeNames | string): Attribute | undefined {
		return this._attributes.find((attr) => attr.name === name);
	}

	public getAttributes(): Attribute[] {
		return this._attributes;
	}

	public getAttributeNames(): string[] {
		return this._attributes.map((attr) => attr.name);
	}

	// Public method to get non-attribute comments (indexed by line number)
	public getNonAttributeComments(): NonAttributeComment[] {
		return this._nonAttributeComments;
	}

	public findOneByValueOrNameAlias(nameOrAlias: string): Attribute | undefined {
		for (const attr of this._attributes) {
			const alias = attr.properties?.[KnownJsonProperties.Name];
			if ((alias === undefined && attr.value === nameOrAlias) || attr.properties?.[KnownJsonProperties.Name] === nameOrAlias) {
				return attr;
			}
		}
		return undefined;
	}

	public findManyByValueOrNameAlias(nameOrAliasList: string[]): { nameOrAlias: string, attribute: Attribute }[] {
		const matches: { nameOrAlias: string, attribute: Attribute }[] = [];

		for (const nameOrAlias of nameOrAliasList) {
			for (const attribute of this._attributes) {
				if (attribute.value === nameOrAlias || attribute.properties?.[KnownJsonProperties.Name] === nameOrAlias) {
					matches.push({ nameOrAlias, attribute });
					break;
				}
			}
		}
		return matches;
	}

	public findManyByValue(values: string[]): Attribute[] {
		const matches: Attribute[] = [];

		for (const nameOrAlias of values) {
			for (const attribute of this._attributes) {
				if (attribute.value === nameOrAlias) {
					matches.push(attribute);
					break;
				}
			}
		}
		return matches;
	}

	public getAttributeCounts(): AttributeCounts {
		// We're treating the whole class as immutable in terms of what annotations it holds.
		if (this._attributeCounts) {
			return this._attributeCounts;
		}

		const counts: AttributeCounts = {
			Tag: 0,
			Query: 0,
			Path: 0,
			Body: 0,
			Header: 0,
			Deprecated: 0,
			Hidden: 0,
			Security: 0,
			AdvancedSecurity: 0,
			Route: 0,
			Response: 0,
			Description: 0,
			Method: 0,
			ErrorResponse: 0,
		};

		for (const attrib of this._attributes) {
			counts[attrib.name as AttributeNames]++;
		}

		this._attributeCounts = counts;
		return counts;
	}

	public getDiagnostics(withCache?: boolean): Diagnostic[] {
		if (withCache && this._lastValidationResult !== undefined) {
			return this._lastValidationResult;
		}

		const errors: Diagnostic[] = [];
		for (const attrib of this._attributes) {
			const validator = Validators[attrib.name as AttributeNames];
			if (validator) {
				const validationErrors = validator(attrib);
				if (validationErrors) {
					errors.push(...validationErrors);
				}
			}
		}

		const methodLevelErrors = this.validateSelf();
		this._lastValidationResult = errors.concat(methodLevelErrors);
		return this._lastValidationResult;
	}

	private validateSelf(): Diagnostic[] {
		const commonIssues = this.validateCommon();

		let specificIssues: Diagnostic[] = [];
		switch (this._symbol?.type) {
			case GolangSymbolType.Struct:
				specificIssues = this.validateStruct();
				break;
			case GolangSymbolType.Receiver:
				specificIssues = this.validateReceiver();
				break;
			default:
				break;
		}

		return commonIssues.concat(specificIssues);
	}

	private validateCommon(): Diagnostic[] {
		return [];
	}

	private validateStruct(): Diagnostic[] {
		const validator = new StructValidator(this._symbol as GolangStruct, this);
		return validator.validate();
	}

	private validateReceiver(): Diagnostic[] {
		const validator = new ReceiverValidator(this._symbol as GolangReceiver, this);
		return validator.validate();
	}

	// Private method for parsing comments
	private parseComments(comments: CommentWithPosition[]): void {
		// Captures: 1. TEXT (after @), 2. TEXT (inside parentheses), 3. JSON5 Object, 4. Remaining TEXT
		const parsingRegex = /^\/\/ @(\w+)(?:(?:\(([\w-_/\\{} ]+))(?:\s*,\s*(\{.*\}))?\))?(?:\s+(.+))?$/;

		for (const comment of comments) {
			const { attribute, isAttribute, error } = this.parseComment(parsingRegex, comment);

			if (error) {
				throw new Error(`Failed to parse comment on line ${comment.range.start.line}: ${error.message}`);
			}

			if (isAttribute && attribute) {
				this._attributes.push(attribute);
			} else {
				// Trim `//` and any extra spaces
				this._nonAttributeComments.push({
					text: comment.text.replace(/^\/\/\s*/, ""),
					range: comment.range
				});
			}
		}
	}

	// Private helper to parse each individual comment
	private parseComment(parsingRegex: RegExp, comment: CommentWithPosition): { attribute: Attribute | null; isAttribute: boolean; error: Error | null } {
		const matches = parsingRegex.exec(comment.text);

		if (!matches) {
			return { attribute: null, isAttribute: false, error: null };
		}

		const groupsWithIndexes = this.getGroupIndexes(matches, comment.text);

		const nameGroup = groupsWithIndexes[0]; // The TEXT after @ (e.g., Query)
		const valueGroup = groupsWithIndexes[1];  // The TEXT inside parentheses (e.g., someValue)
		const propertiesGroup = groupsWithIndexes[2];    // The JSON5 object (e.g., {someProp: v1})
		const descriptionGroup = groupsWithIndexes[3];   // The remaining TEXT (e.g., some description)

		let props: Record<string, any> | undefined;
		let jsonError: unknown;
		if (propertiesGroup?.match) {
			try {
				props = json5.parse(propertiesGroup.match);
			} catch (err) {
				jsonError = err;
			}
		}

		const lineNumber = comment.range.start.line;

		const attribute: Attribute = {
			name: nameGroup!.match,
			nameRange: new Range(lineNumber, nameGroup!.start - 1, lineNumber, nameGroup!.end),
			value: valueGroup?.match,
			valueRange: valueGroup ? new Range(lineNumber, valueGroup.start, lineNumber, valueGroup.end) : undefined,
			properties: props,
			propertiesRange: propertiesGroup ? new Range(lineNumber, propertiesGroup.start, lineNumber, propertiesGroup.end) : undefined,
			propertiesParseError: jsonError,
			description: descriptionGroup?.match,
			descriptionRange: descriptionGroup ? new Range(lineNumber, descriptionGroup.start, lineNumber, descriptionGroup.end) : undefined,
		};

		return { attribute, isAttribute: true, error: null };
	}

	private getGroupIndexes(match: RegExpExecArray, input: string): (GroupWithIndex | undefined)[] {
		const groupIndexes: (GroupWithIndex | undefined)[] = [];
		let currentIndex = match.index;

		for (let i = 1; i < match.length; i++) {
			const group = match[i];
			if (group !== undefined) {
				const start = input.indexOf(group, currentIndex); // Find group's start index
				const end = start + group.length; // Calculate group's end index
				groupIndexes.push({ match: group, start, end });
				currentIndex = end; // Update the search starting position
			} else {
				groupIndexes.push(undefined);
			}
		}

		return groupIndexes;
	}
}
