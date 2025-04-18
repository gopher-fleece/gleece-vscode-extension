import { Diagnostic } from 'vscode';
import { Attribute } from '../annotation/annotation.provider';
import { AttributeNames } from '../enums';
import { STD_VALUE_VALIDATION, STD_PROPERTY_VALIDATION } from './configuration';
import { combine, validateProperties } from './helpers';
import {
	valueMustBeValidRoute,
	valueMustBeGoIdentifier,
	propertiesMustBeValidJson5,
	propertiesMustExist,
	propertiesKeyMustExist,
	valueMustBeNumeric,
	valueMustBeHttpStatusCode,
	valueShouldNotExist,
	descriptionShouldExist,
	valueMustBeHttpCodeString,
	propertiesShouldNotExist
} from './validator.assertions';
import { diagnosticError } from '../diagnostics/helpers';
import { DiagnosticCode } from '../diagnostics/enums';
import { gleeceContext } from '../context/context';
import didYouMean from 'didyoumean';


function validateMethod(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...STD_VALUE_VALIDATION,
				{ breakOnFailure: false, validator: valueMustBeHttpCodeString }
			],
			properties: [
				{ breakOnFailure: false, validator: propertiesShouldNotExist },
				...STD_PROPERTY_VALIDATION
			]
		}
	);
}

function validateRoute(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...STD_VALUE_VALIDATION,
				{ breakOnFailure: false, validator: valueMustBeValidRoute }
			],
			properties: [
				{ breakOnFailure: false, validator: propertiesShouldNotExist }
			]
		}
	);
}

function validateSimpleParam(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...STD_VALUE_VALIDATION,
				{ breakOnFailure: false, validator: valueMustBeGoIdentifier }
			],
			properties: STD_PROPERTY_VALIDATION
		}
	);
}

function validateBody(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...STD_VALUE_VALIDATION,
				{ breakOnFailure: false, validator: valueMustBeGoIdentifier }
			],
			properties: STD_PROPERTY_VALIDATION
		}
	);
}

function validateTag(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: STD_VALUE_VALIDATION,
			properties: STD_PROPERTY_VALIDATION
		}
	);
}

function validateSecurity(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: STD_VALUE_VALIDATION,
			properties: [
				{ breakOnFailure: true, validator: propertiesMustBeValidJson5 },
				{ breakOnFailure: true, validator: propertiesMustExist },
				{ breakOnFailure: false, validator: (attribute: Attribute) => propertiesKeyMustExist(attribute, 'scopes') },
				{ breakOnFailure: false, validator: validateProperties },
				{
					breakOnFailure: false,
					validator: (attribute: Attribute) => {
						const validNames = gleeceContext.configManager.securitySchemaNames;
						const validSchemaName = validNames.includes(attribute.value!);
						if (!validSchemaName) {
							const suggestion = didYouMean(attribute.value ?? '', validNames);
							return [diagnosticError(
								`Schema '${attribute.value}' is not specified in ` +
								`${gleeceContext.configManager.getExtensionConfigValue('config.path')}.\n` +
								(suggestion ? `Did you mean \`${suggestion}\`?\n` : '') +
								`Known schemas are: ${validNames.join(', ')}`,
								attribute.valueRange!,
								DiagnosticCode.AnnotationPropertiesInvalidValueForKey
							)];
						}
						return [];
					}
				}
			]
		}
	);
}

function validateResponse(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...STD_VALUE_VALIDATION,
				{
					breakOnFailure: true,
					validator: (attribute: Attribute) => valueMustBeNumeric(
						attribute,
						`Status code '${attribute.value}' is not a valid HTTP status code`
					)
				},
				{
					breakOnFailure: false,
					validator: (attribute: Attribute) => valueMustBeHttpStatusCode(
						attribute,
						`${attribute.value} is not a standard HTTP status code`
					)
				}
			],
			properties: [
				{ breakOnFailure: false, validator: propertiesShouldNotExist }
			]
		}
	);
}

/**
 * Validates an annotation with a description and no value or properties
 *
 * @param {Attribute} attribute
 * @return {Diagnostic[]}
 */
function validateSimpleAnnotation(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				{
					breakOnFailure: false,
					validator: valueShouldNotExist
				}
			],
			properties: STD_PROPERTY_VALIDATION,
			description: [
				{ breakOnFailure: true, validator: descriptionShouldExist }
			]
		}
	);
}

function validateHidden(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				{
					breakOnFailure: false,
					validator: valueShouldNotExist
				}
			],
			properties: [
				{ breakOnFailure: false, validator: propertiesShouldNotExist }
			]
		}
	);
}

export const Validators: { [Key in AttributeNames]: (attribute: Attribute) => Diagnostic[] } = {
	[AttributeNames.Method]: validateMethod,
	[AttributeNames.Route]: validateRoute,
	[AttributeNames.Response]: validateResponse,
	[AttributeNames.ErrorResponse]: validateResponse,
	[AttributeNames.Header]: validateSimpleParam,
	[AttributeNames.Path]: validateSimpleParam,
	[AttributeNames.Query]: validateSimpleParam,
	[AttributeNames.Body]: validateBody,
	[AttributeNames.FormField]: validateSimpleParam,
	[AttributeNames.Security]: validateSecurity,
	[AttributeNames.AdvancedSecurity]: validateSecurity,
	[AttributeNames.Tag]: validateTag,
	[AttributeNames.Description]: validateSimpleAnnotation,
	[AttributeNames.Hidden]: validateHidden,
	[AttributeNames.Deprecated]: validateSimpleAnnotation,
	[AttributeNames.TemplateContext]: () => [] // No validation
};
