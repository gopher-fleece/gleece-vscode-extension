import { Diagnostic, DiagnosticSeverity, Range } from 'vscode';
import { Attribute } from '../annotation.parser';
import { STATUS_CODES } from 'http';

export function propertiesMustBeValidJson5(attribute: Attribute): Diagnostic[] {
	if (attribute.propertiesParseError) {
		return [new Diagnostic(
			attribute.propertiesRange!,
			`String is not a valid ${(attribute.propertiesParseError as SyntaxError)?.message}`,
			DiagnosticSeverity.Error
		)];
	}

	return [];
}

export function valueMustExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (!attribute.value) {
		return [new Diagnostic(
			attribute.nameRange,
			mustHaveMessage ?? `${attribute.name} annotation annotations must have a value`,
			DiagnosticSeverity.Error
		)];
	}
	return [];
}

export function descriptionShouldExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (!attribute.description) {
		return [new Diagnostic(
			attribute.nameRange,
			mustHaveMessage ?? `${attribute.name} annotation should have a description`,
			DiagnosticSeverity.Warning
		)];
	}
	return [];
}

export function valueShouldNotExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (attribute.value) {
		return [new Diagnostic(
			attribute.nameRange,
			mustHaveMessage ?? `${attribute.name} annotation annotations should not have a value`,
			DiagnosticSeverity.Warning
		)];
	}
	return [];
}

export function valueMustBeNumeric(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	const isNotNumeric = /^\d+$/.exec(attribute.value!);
	if (!isNotNumeric) {
		return [new Diagnostic(
			attribute.valueRange!,
			mustHaveMessage ?? `'${attribute.value}' must be a numeric value`,
			DiagnosticSeverity.Error
		)];
	}

	return [];
}

export function valueMustBeValidRoute(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (!/^\/(?:(?:[\w\-_]+)|(?:\{[\w\-_]+\}))(?:\/(?:(?:[\w\-_]+)|(?:\{[\w\-_]+\})))*$/.exec(attribute.value ?? '')) {
		return [new Diagnostic(
			attribute.valueRange!,
			mustHaveMessage ?? `${attribute.name} annotation annotations may only contain URLs and must start with '/'`,
			DiagnosticSeverity.Error
		)];
	}
	return [];
}

export function valueShouldBeHttpStatusCode(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	const status = STATUS_CODES[attribute.value!];
	if (!status) {
		return [new Diagnostic(
			attribute.valueRange!,
			mustHaveMessage ?? `${attribute.value} is not a standard HTTP status code`,
			DiagnosticSeverity.Warning
		)];
	}

	return [];
}

export function valueMustBeGoIdentifier(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	return mustBeGoIdentifier(
		attribute.value!,
		mustHaveMessage ?? `${attribute.value} is not a valid Go identifier`,
		attribute.valueRange!
	);
}

export function mustBeGoIdentifier(value: string, diagnosticMessage: string, range: Range): Diagnostic[] {
	const isIdent = /^[A-Za-z_][A-Za-z0-9_]*$/.exec(value);
	if (!isIdent) {
		return [new Diagnostic(
			range,
			diagnosticMessage,
			DiagnosticSeverity.Error
		)];
	}

	return [];
}

export function mustBeValidOpenApiName(value: string, diagnosticMessage: string, range: Range): Diagnostic[] {
	const isValid = /^[A-Za-z_-][A-Za-z0-9_-]*$/.exec(value);
	if (!isValid) {
		return [new Diagnostic(
			range,
			diagnosticMessage,
			DiagnosticSeverity.Error
		)];
	}

	return [];
}


export function mustNotBeEmpty(value: any, diagnosticMessage: string, range: Range): Diagnostic[] {
	if (value === null || value === undefined || value === "") {
		return [new Diagnostic(
			range,
			diagnosticMessage,
			DiagnosticSeverity.Error
		)];
	}

	return [];
}

export function mustBeStringArray(value: any, diagnosticMessage: string, range: Range): Diagnostic[] {
	if (Array.isArray(value)) {
		const nonStringItemIndex = value.findIndex((v) => typeof v !== 'string');
		if (nonStringItemIndex < 0) {
			return [];
		}
	}

	return [new Diagnostic(
		range,
		diagnosticMessage,
		DiagnosticSeverity.Error
	)];
}


export function propertiesShouldNotExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (attribute.properties) {
		return [new Diagnostic(
			attribute.propertiesRange!,
			mustHaveMessage ?? `${attribute.name} annotation does not accept any additional JSON5 configuration`,
			DiagnosticSeverity.Warning
		)];
	}

	return [];
}

export function propertiesMustExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (!attribute.properties) {
		return [new Diagnostic(
			attribute.nameRange!,
			mustHaveMessage ?? `${attribute.name} annotation requires additional JSON5 configuration`,
			DiagnosticSeverity.Warning
		)];
	}

	return [];
}

export function propertiesKeyMustExist(attribute: Attribute, key: string, mustHaveMessage?: string): Diagnostic[] {
	if (!attribute.properties?.[key]) {
		return [new Diagnostic(
			attribute.nameRange!,
			mustHaveMessage ?? `${attribute.name} annotation requires property '${key}' in its JSON5 configuration`,
			DiagnosticSeverity.Error
		)];
	}

	return [];
}

export function valueMustBeHttpCodeString(attribute: Attribute, mustHaveMessage?: string) {
	switch (attribute.value) {
		case 'GET':
		case 'POST':
		case 'PUT':
		case 'DELETE':
		case 'PATCH':
		case 'OPTIONS':
		case 'HEAD':
		case 'TRACE':
		case 'CONNECT':
			return [];
	}

	return [new Diagnostic(
		attribute.valueRange!,
		mustHaveMessage ?? `${attribute.name} annotation annotations may only have one of the following values: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, TRACE, CONNECT`,
		DiagnosticSeverity.Error
	)];
}
