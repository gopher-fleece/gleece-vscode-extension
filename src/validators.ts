import { Diagnostic, DiagnosticSeverity, Range } from 'vscode';
import { Attribute } from './annotation.parser';
import { AttributeNames } from './enums';
import { STATUS_CODES } from 'http';

function validateMethod(attribute: Attribute): Diagnostic[] {
	if (attribute.name !== AttributeNames.Method) {
		throw new Error(`Expected a 'Method' attribute but got ${attribute.name}`);
	}

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
		"Method annotations may only have one of the following values: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, TRACE, CONNECT",
		DiagnosticSeverity.Error
	)];
}


function validateRoute(attribute: Attribute): Diagnostic[] {
	if (attribute.name !== AttributeNames.Route) {
		throw new Error(`Expected a 'Route' attribute but got ${attribute.name}`);
	}

	if (!/^\/(?:(?:[\w\-_]+)|(?:\{[\w\-_]+\}))(?:\/(?:(?:[\w\-_]+)|(?:\{[\w\-_]+\})))*$/.exec(attribute.value ?? '')) {
		return [new Diagnostic(
			attribute.valueRange!,
			"Route annotations may only contain URLs and must start with '/'",
			DiagnosticSeverity.Error
		)];
	}
	return [];
}

function validateHttpCodeHolder(attribute: Attribute): Diagnostic[] {
	if (!attribute.value) {
		return [new Diagnostic(
			attribute.valueRange!,
			`${attribute.name} annotations must contain a valid HTTP Status Code`,
			DiagnosticSeverity.Error
		)];
	}

	const isNotNumeric = /^\d+$/.exec(attribute.value);
	if (!isNotNumeric) {
		return [new Diagnostic(
			attribute.valueRange!,
			`Status code '${attribute.value}' is not a valid HTTP status code`,
			DiagnosticSeverity.Error
		)];
	}

	const status = STATUS_CODES[attribute.value];
	if (!status) {
		return [new Diagnostic(
			attribute.valueRange!,
			`${attribute.value} is not a standard HTTP status code`,
			DiagnosticSeverity.Warning
		)];
	}

	return [];
}

function validateIdentifierHolder(attribute: Attribute): Diagnostic[] {
	if (!attribute.value) {
		return [new Diagnostic(
			attribute.valueRange!,
			`${attribute.name} annotations must contain a valid Go identifier`,
			DiagnosticSeverity.Error
		)];
	}

	const isIdent = /^[A-Za-z][A-Za-z0-9]*$/.exec(attribute.value);
	if (!isIdent) {
		return [new Diagnostic(
			attribute.valueRange!,
			`${attribute.value} is not a valid Go identifier`,
			DiagnosticSeverity.Error
		)];
	}

	return [];
}

function validateSecurity(attribute: Attribute): Diagnostic[] {
	if (attribute.name !== AttributeNames.Security) {
		throw new Error(`Expected a 'Security' attribute but got ${attribute.name}`);
	}

	if (attribute.propertiesParseError) {
		return [new Diagnostic(
			attribute.propertiesRange!,
			`String is not a valid ${(attribute.propertiesParseError as SyntaxError)?.message}`,
			DiagnosticSeverity.Error
		)];
	}

	return [];
}

export const Validators: { [Key in AttributeNames]?: (attribute: Attribute) => Diagnostic[] } = {
	[AttributeNames.Method]: validateMethod,
	[AttributeNames.Route]: validateRoute,
	[AttributeNames.Response]: validateHttpCodeHolder,
	[AttributeNames.ErrorResponse]: validateHttpCodeHolder,
	[AttributeNames.Header]: validateIdentifierHolder,
	[AttributeNames.Path]: validateIdentifierHolder,
	[AttributeNames.Query]: validateIdentifierHolder,
	[AttributeNames.Body]: validateIdentifierHolder,
	[AttributeNames.Security]: validateSecurity,
	[AttributeNames.AdvancedSecurity]: validateSecurity,
}
