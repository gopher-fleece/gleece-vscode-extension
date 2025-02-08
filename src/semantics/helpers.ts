import { Diagnostic, DiagnosticSeverity, Range } from 'vscode';
import { Attribute } from '../annotation/annotation.provider';
import { AttributeNames } from '../enums';
import { KNOWN_PROPERTIES } from './configuration';
import { Validation, PropertyValidation, ValidationSequences } from './types';
import { diagnosticWarning } from '../diagnostics/helpers';
import { DiagnosticCode } from '../diagnostics/enums';

export function validateProperties(attribute: Attribute): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	for (const [key, value] of Object.entries(attribute.properties ?? [])) {
		const knownProps = KNOWN_PROPERTIES[attribute.name as AttributeNames];
		const propConf = knownProps?.find((config) => config.name === key);
		if (!propConf) {
			diagnostics.push(
				diagnosticWarning(
					`'${key}' is not a known property of ${attribute.name}`,
					attribute.propertiesRange!,
					DiagnosticCode.AnnotationPropertiesUnknownKey
				)
			);
			continue;
		}

		if (propConf.validations && propConf.validations.length > 0) {
			diagnostics.push(...validatePropertySequence(attribute, key, value, propConf.validations));
		}
	}
	return diagnostics;
}

export function validateSequence(attribute: Attribute, validations: Validation[]): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	for (const { validator, breakOnFailure } of validations) {
		const results = validator(attribute);
		if (typeof results === 'boolean') {
			if (!results) {
				break; // Circuit breaker trip
			}
			continue;
		}
		// Diagnostic results
		if (results.length > 0) {
			diagnostics.push(...results);
			if (breakOnFailure) {
				break;
			}
		}
	}

	return diagnostics;
}


export function validatePropertySequence(
	attribute: Attribute,
	propertyKey: string,
	propertyValue: any,
	validations: PropertyValidation[]
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	for (const { validator, breakOnFailure } of validations) {
		const results = validator(attribute, propertyKey, propertyValue);
		if (typeof results === 'boolean') {
			if (!results) {
				break; // Circuit breaker trip
			}
			continue;
		}
		// Diagnostic results
		if (results.length > 0) {
			diagnostics.push(...results);
			if (breakOnFailure) {
				break;
			}
		}
	}

	return diagnostics;
}

export function combine(attribute: Attribute, sequences: ValidationSequences): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	for (const sequence of Object.values(sequences)) {
		if (sequence && sequence.length > 0) {
			diagnostics.push(...validateSequence(attribute, sequence));
		}
	}
	return diagnostics;
}
