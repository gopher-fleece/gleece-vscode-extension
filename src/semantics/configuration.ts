import { Attribute } from '../annotation/annotation.provider';
import { AttributeNames } from '../enums';
import { validateProperties } from './helpers';
import { PropertyValidation, PropertyValidationConfig, Validation } from './types';
import {
	mustNotBeEmpty, mustBeValidOpenApiName, mustBeStringArray, valueMustExist, propertiesMustBeValidJson5
} from './validator.assertions';

export const STD_NAME_VALIDATION: PropertyValidation[] = [
	{
		breakOnFailure: true,
		validator: (attribute: Attribute, _propertyKey: string, propertyValue: any) => {
			return mustNotBeEmpty(propertyValue, "'name' must not be empty", attribute.propertiesRange!);
		}
	},
	{
		breakOnFailure: false,
		validator: (attribute: Attribute, _propertyKey: string, propertyValue: any) => {
			return mustBeValidOpenApiName(
				propertyValue,
				`'name' must be a valid OpenAPI ${attribute.name} parameter identifier`,
				attribute.propertiesRange!
			);
		}
	}
];

export const STD_NAME_AND_VALIDATION_CONFIG: PropertyValidationConfig[] = [
	{ name: 'name', validations: STD_NAME_VALIDATION },
	{ name: 'validate' }
];

export const STD_VALIDATION_CONFIG: PropertyValidationConfig[] = [
	{ name: 'validate' }
];

export const STD_SCOPES_CONFIG: PropertyValidationConfig[] = [
	{
		name: 'scopes', validations: [
			{
				breakOnFailure: true,
				validator: (attribute: Attribute, _propertyKey: string, propertyValue: any) => {
					return mustNotBeEmpty(propertyValue, "'scopes' must not be empty", attribute.propertiesRange!);
				}
			},
			{
				breakOnFailure: true,
				validator: (attribute: Attribute, _propertyKey: string, propertyValue: any) => {
					return mustBeStringArray(propertyValue, "'scopes' must be an array of strings", attribute.propertiesRange!);
				}
			}
		]
	}
];

export const STD_VALUE_VALIDATION: Validation[] = [
	{ breakOnFailure: true, validator: valueMustExist }
];

export const STD_PROPERTY_VALIDATION: Validation[] = [
	{ breakOnFailure: true, validator: propertiesMustBeValidJson5 },
	{ breakOnFailure: true, validator: (attribute: Attribute) => !!attribute.properties }, // Circuit breaker
	{ breakOnFailure: false, validator: validateProperties }
];

export const KNOWN_PROPERTIES: { [Key in AttributeNames]: PropertyValidationConfig[] } = {
	[AttributeNames.Tag]: [],
	[AttributeNames.Query]: STD_NAME_AND_VALIDATION_CONFIG,
	[AttributeNames.Path]: STD_NAME_AND_VALIDATION_CONFIG,
	[AttributeNames.Body]: STD_VALIDATION_CONFIG,
	[AttributeNames.Header]: STD_NAME_AND_VALIDATION_CONFIG,
	[AttributeNames.Deprecated]: [],
	[AttributeNames.Hidden]: [],
	[AttributeNames.Security]: STD_SCOPES_CONFIG,
	[AttributeNames.AdvancedSecurity]: STD_SCOPES_CONFIG,
	[AttributeNames.Route]: [],
	[AttributeNames.Response]: [],
	[AttributeNames.Description]: [],
	[AttributeNames.Method]: [],
	[AttributeNames.ErrorResponse]: []
};
