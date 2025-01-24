import json5 from "json5";
import { AttributeNames } from './enums';

interface Attribute {
	name: string;
	value?: string; // Optional, corresponds to the primary value inside parentheses
	properties?: Record<string, any>; // Parsed JSON5 properties
	description?: string; // Additional text after the annotation
}

export class AttributesProvider {
	// Private properties
	private attributes: Attribute[] = [];
	private nonAttributeComments: Map<number, string> = new Map();

	constructor(comments: string[]) {
		this.parseComments(comments);
	}

	// Public method to get the parsed attributes
	public getAttributes(): Attribute[] {
		return this.attributes;
	}

	// Public method to get the parsed attributes
	public getAttribute(name: AttributeNames | string): Attribute | undefined {
		return this.attributes.find((attr) => attr.name === name);
	}

	public getAttributeNames(): string[] {
		return this.attributes.map((attr) => attr.name);
	}

	// Public method to get non-attribute comments (indexed by line number)
	public getNonAttributeComments(): Map<number, string> {
		return this.nonAttributeComments;
	}

	// Private method for parsing comments
	private parseComments(comments: string[]): void {
		// Captures: 1. TEXT (after @), 2. TEXT (inside parentheses), 3. JSON5 Object, 4. Remaining TEXT
		const parsingRegex = /^\/\/ @(\w+)(?:(?:\(([\w-_/\\{} ]+))(?:\s*,\s*(\{.*\}))?\))?(?:\s+(.+))?$/;

		comments.forEach((comment, lineIndex) => {
			const { attribute, isAttribute, error } = this.parseComment(parsingRegex, comment);

			if (error) {
				throw new Error(`Failed to parse comment on line ${lineIndex}: ${error.message}`);
			}

			if (isAttribute && attribute) {
				this.attributes.push(attribute);
			} else {
				// Trim `//` and any extra spaces
				this.nonAttributeComments.set(lineIndex, comment.replace(/^\/\/\s*/, ""));
			}
		});
	}

	// Private helper to parse each individual comment
	private parseComment(parsingRegex: RegExp, comment: string): { attribute: Attribute | null; isAttribute: boolean; error: Error | null } {
		const matches = parsingRegex.exec(comment);

		if (!matches) {
			return { attribute: null, isAttribute: false, error: null };
		}

		const attributeName = matches[1]; // The TEXT after @ (e.g., Query)
		const primaryValue = matches[2];  // The TEXT inside parentheses (e.g., someValue)
		const jsonConfig = matches[3];    // The JSON5 object (e.g., {someProp: v1})
		const description = matches[4];   // The remaining TEXT (e.g., some description)

		let props: Record<string, any> | undefined;
		if (jsonConfig) {
			try {
				props = json5.parse(jsonConfig);
			} catch (err) {
				return { attribute: null, isAttribute: true, error: new Error(`Invalid JSON5 in annotation: ${jsonConfig}`) };
			}
		}

		const attribute: Attribute = {
			name: attributeName,
			value: primaryValue,
			properties: props,
			description: description,
		};

		return { attribute, isAttribute: true, error: null };
	}
}
