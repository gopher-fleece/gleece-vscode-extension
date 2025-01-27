import { Diagnostic } from 'vscode';
import { Attribute } from '../annotation.parser';
import { AttributeNames } from '../enums';
import { stdValueValidations, stdPropertyValidations } from './configuration';
import { combine, validateProperties } from './helpers';
import {
	valueMustBeValidRoute,
	valueMustBeGoIdentifier,
	propertiesMustBeValidJson5,
	propertiesMustExist,
	propertiesKeyMustExist,
	valueMustBeNumeric,
	valueShouldBeHttpStatusCode,
	valueShouldNotExist,
	descriptionShouldExist,
	valueMustBeHttpCodeString
} from './validator.assertions';
import { configManager } from '../configuration/config.manager';
import { diagnosticError } from '../diagnostics/helpers';
import { DiagnosticCode } from '../diagnostics/enums';


function validateMethod(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...stdValueValidations,
				{ breakOnFailure: false, validator: valueMustBeHttpCodeString },
			],
			properties: stdPropertyValidations,
		},
	);
}

function validateRoute(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...stdValueValidations,
				{ breakOnFailure: false, validator: valueMustBeValidRoute },
			],
			properties: stdPropertyValidations,
		},
	);
}

function validateSimpleParam(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...stdValueValidations,
				{ breakOnFailure: false, validator: valueMustBeGoIdentifier },
			],
			properties: stdPropertyValidations,
		},
	);
}

function validateBody(attribute: Attribute, mustHaveMessage?: string): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...stdValueValidations,
				{ breakOnFailure: false, validator: valueMustBeGoIdentifier },
			],
			properties: stdPropertyValidations,
		},
	);
}

function validateTag(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: stdValueValidations,
			properties: stdPropertyValidations,
		}
	);
}

function validateSecurity(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: stdValueValidations,
			properties: [
				{ breakOnFailure: true, validator: propertiesMustBeValidJson5 },
				{ breakOnFailure: true, validator: propertiesMustExist },
				{ breakOnFailure: false, validator: (attribute: Attribute) => propertiesKeyMustExist(attribute, 'scopes') },
				{ breakOnFailure: false, validator: validateProperties },
				{
					breakOnFailure: false,
					validator: (attribute: Attribute) => {
						const validSchemaName = configManager.securitySchemaNames.includes(attribute.value!);
						if (!validSchemaName) {
							return [diagnosticError(
								`Schema '${attribute.value}' is not specified in ` +
								`${configManager.getExtensionConfigValue('gleeceConfigPath')}.\n` +
								`Known schemas are: ${configManager.securitySchemaNames.join(', ')}`,
								attribute.valueRange!,
								DiagnosticCode.AnnotationPropertiesInvalidValueForKey
							)];
						}
						return [];
					}
				},
			],
		}
	);
}

function validateResponse(attribute: Attribute): Diagnostic[] {
	return combine(
		attribute,
		{
			value: [
				...stdValueValidations,
				{
					breakOnFailure: true,
					validator: (attribute: Attribute) => valueMustBeNumeric(
						attribute,
						`Status code '${attribute.value}' is not a valid HTTP status code`
					)
				},
				{
					breakOnFailure: false,
					validator: (attribute: Attribute) => valueShouldBeHttpStatusCode(
						attribute,
						`${attribute.value} is not a standard HTTP status code`
					),
				},
			],
			properties: stdPropertyValidations,
		},
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
					validator: valueShouldNotExist,
				},
			],
			properties: stdPropertyValidations,
			description: [
				{ breakOnFailure: true, validator: descriptionShouldExist },
			],
		},
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
	[AttributeNames.Security]: validateSecurity,
	[AttributeNames.AdvancedSecurity]: validateSecurity,
	[AttributeNames.Tag]: validateTag,
	[AttributeNames.Description]: validateSimpleAnnotation,
	[AttributeNames.Hidden]: validateSimpleAnnotation,
	[AttributeNames.Deprecated]: validateSimpleAnnotation,
}
