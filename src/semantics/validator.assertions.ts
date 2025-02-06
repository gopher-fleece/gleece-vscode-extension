import { Diagnostic, Range } from 'vscode';
import { Attribute } from '../annotation.parser';
import { STATUS_CODES } from 'http';
import { diagnosticError, diagnosticWarning } from '../diagnostics/helpers';
import { DiagnosticCode } from '../diagnostics/enums';

export function propertiesMustBeValidJson5(attribute: Attribute): Diagnostic[] {
	if (attribute.propertiesParseError) {
		return [
			diagnosticError(
				`String is not a valid ${(attribute.propertiesParseError as SyntaxError)?.message}`,
				attribute.propertiesRange!,
				DiagnosticCode.AnnotationPropertiesInvalid
			)
		];
	}

	return [];
}

export function valueMustExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (!attribute.value) {
		return [
			diagnosticError(
				mustHaveMessage ?? `${attribute.name} annotation annotations must have a value`,
				attribute.nameRange,
				DiagnosticCode.AnnotationValueMustExist
			)
		];
	}
	return [];
}

export function descriptionShouldExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (!attribute.description) {
		return [
			diagnosticWarning(
				mustHaveMessage ?? `${attribute.name} annotation should have a description`,
				attribute.nameRange,
				DiagnosticCode.AnnotationValueMustExist
			)
		];
	}
	return [];
}

export function valueShouldNotExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (attribute.value) {
		return [
			diagnosticWarning(
				mustHaveMessage ?? `${attribute.name} annotations should not have a value`,
				attribute.valueRange!,
				DiagnosticCode.AnnotationValueShouldNotExist
			)
		];
	}
	return [];
}

export function valueMustBeNumeric(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	const isNotNumeric = /^\d+$/.exec(attribute.value!);
	if (!isNotNumeric) {
		return [
			diagnosticError(
				mustHaveMessage ?? `'${attribute.value}' must be a numeric value`,
				attribute.valueRange!,
				DiagnosticCode.AnnotationValueInvalid
			)
		];
	}

	return [];
}

export function valueMustBeValidRoute(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	/// Matches any sub URL that starts with '/' including empty ones
	if (!/^\/((?:(?:[\w\-_]+)|(?:\{[\w\-_]+\}))(?:\/(?:(?:[\w\-_]+)|(?:\{[\w\-_]+\})))*)*$/.exec(attribute.value ?? '')) {
		return [
			diagnosticError(
				mustHaveMessage ?? `${attribute.name} annotation annotations may only contain URLs and must start with '/'`,
				attribute.valueRange!,
				DiagnosticCode.AnnotationValueInvalid
			)
		];
	}
	return [];
}

export function valueMustBeHttpStatusCode(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	const status = STATUS_CODES[attribute.value!];
	if (!status) {
		return [
			diagnosticError(
				mustHaveMessage ?? `${attribute.value} is not a standard HTTP status code`,
				attribute.valueRange!,
				DiagnosticCode.AnnotationValueInvalid
			)
		];
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
		return [
			diagnosticWarning(
				diagnosticMessage,
				range,
				DiagnosticCode.AnnotationValueInvalid
			)
		];
	}

	return [];
}

export function mustBeValidOpenApiName(value: string, diagnosticMessage: string, range: Range): Diagnostic[] {
	const isValid = /^[A-Za-z_-][A-Za-z0-9_-]*$/.exec(value);
	if (!isValid) {
		return [
			diagnosticError(
				diagnosticMessage,
				range,
				DiagnosticCode.AnnotationValueInvalid
			)
		];
	}

	return [];
}


export function mustNotBeEmpty(value: any, diagnosticMessage: string, range: Range): Diagnostic[] {
	if (value === null || value === undefined || value === "") {
		return [
			diagnosticError(
				diagnosticMessage,
				range,
				DiagnosticCode.AnnotationValueMustExist
			)
		];
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

	return [
		diagnosticError(
			diagnosticMessage,
			range,
			DiagnosticCode.AnnotationPropertiesInvalidValueForKey
		)
	];
}


export function propertiesShouldNotExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (attribute.properties) {
		return [
			diagnosticWarning(
				mustHaveMessage ?? `${attribute.name} annotation does not accept any additional JSON5 configuration`,
				attribute.propertiesRange!,
				DiagnosticCode.AnnotationPropertiesShouldNotExist
			)
		];
	}

	return [];
}

export function propertiesMustExist(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	if (!attribute.properties) {
		return [
			diagnosticError(
				mustHaveMessage ?? `${attribute.name} annotation requires additional JSON5 configuration`,
				attribute.nameRange,
				DiagnosticCode.AnnotationPropertiesShouldNotExist
			)
		];
	}

	return [];
}

export function propertiesKeyMustExist(attribute: Attribute, key: string, mustHaveMessage?: string): Diagnostic[] {
	if (!attribute.properties?.[key]) {
		return [
			diagnosticError(
				mustHaveMessage ?? `${attribute.name} annotation requires property '${key}' in its JSON5 configuration`,
				attribute.propertiesRange!,
				DiagnosticCode.AnnotationPropertiesMissingKey
			)
		];
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

	return [
		diagnosticError(
			mustHaveMessage ?? `${attribute.name} annotation annotations may only have one of the following values: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, TRACE, CONNECT`,
			attribute.valueRange!,
			DiagnosticCode.AnnotationValueInvalid
		)
	];
}
