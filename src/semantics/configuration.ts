import { Attribute } from '../annotation.parser';
import { AttributeNames } from '../enums';
import { validateProperties } from './helpers';
import { PropertyValidation, PropertyValidationConfig, Validation } from './types';
import { mustNotBeEmpty, mustBeValidOpenApiName, mustBeStringArray, valueMustExist, propertiesMustBeValidJson5 } from './validator.assertions';

export const stdNameValidation: PropertyValidation[] = [
	{
		breakOnFailure: true,
		validator: (attribute: Attribute, propertyKey: string, propertyValue: any) => {
			return mustNotBeEmpty(propertyValue, "'name' must not be empty", attribute.propertiesRange!)
		}
	},
	{
		breakOnFailure: false,
		validator: (attribute: Attribute, propertyKey: string, propertyValue: any) => {
			return mustBeValidOpenApiName(
				propertyValue,
				`'name' must be a valid OpenAPI ${attribute.name} parameter identifier`,
				attribute.propertiesRange!
			)
		}
	}
];

export const stdNameAndValidateConfig: PropertyValidationConfig[] = [
	{ name: 'name', validations: stdNameValidation },
	{ name: 'validate' }
];

export const stdScopesConfig: PropertyValidationConfig[] = [
	{
		name: 'scopes', validations: [
			{
				breakOnFailure: true,
				validator: (attribute: Attribute, propertyKey: string, propertyValue: any) => {
					return mustNotBeEmpty(propertyValue, "'scopes' must not be empty", attribute.propertiesRange!)
				}
			},
			{
				breakOnFailure: true,
				validator: (attribute: Attribute, propertyKey: string, propertyValue: any) => {
					return mustBeStringArray(propertyValue, "'scopes' must be an array of strings", attribute.propertiesRange!)
				}
			},
		]
	},
];

export const stdValueValidations: Validation[] = [
	{ breakOnFailure: true, validator: valueMustExist },
];

export const stdPropertyValidations: Validation[] = [
	{ breakOnFailure: true, validator: propertiesMustBeValidJson5 },
	{ breakOnFailure: true, validator: (attribute: Attribute) => !!attribute.properties }, // Circuit breaker
	{ breakOnFailure: false, validator: validateProperties },
];

export const KnownProperties: { [Key in AttributeNames]: PropertyValidationConfig[] } = {
	[AttributeNames.Tag]: [],
	[AttributeNames.Query]: stdNameAndValidateConfig,
	[AttributeNames.Path]: stdNameAndValidateConfig,
	[AttributeNames.Body]: stdNameAndValidateConfig,
	[AttributeNames.Header]: stdNameAndValidateConfig,
	[AttributeNames.Deprecated]: [],
	[AttributeNames.Hidden]: [],
	[AttributeNames.Security]: stdScopesConfig,
	[AttributeNames.AdvancedSecurity]: stdScopesConfig,
	[AttributeNames.Route]: [],
	[AttributeNames.Response]: [],
	[AttributeNames.Description]: [],
	[AttributeNames.Method]: [],
	[AttributeNames.ErrorResponse]: [],
}
