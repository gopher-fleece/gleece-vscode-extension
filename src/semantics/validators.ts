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

function validateDescription(attribute: Attribute): Diagnostic[] {
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


export const Validators: { [Key in AttributeNames]?: (attribute: Attribute) => Diagnostic[] } = {
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
	[AttributeNames.Description]: validateDescription,
}
