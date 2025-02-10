import { CompletionItem } from 'vscode';

export enum KnownJsonProperties {
	Name = 'name',
	SecurityScopes = 'scopes',
	ValidatorString = 'validate'
}

export enum AttributeNames {
	Tag = 'Tag',
	Query = 'Query',
	Path = 'Path',
	Body = 'Body',
	Header = 'Header',
	Deprecated = 'Deprecated',
	Hidden = 'Hidden',
	Security = 'Security',
	AdvancedSecurity = 'AdvancedSecurity',
	Route = 'Route',
	Response = 'Response',
	Description = 'Description',
	Method = 'Method',
	ErrorResponse = 'ErrorResponse'
}

export const KnownJsonPropertiesCompletionObjects: CompletionItem[] = [
	new CompletionItem({ label: KnownJsonProperties.Name, detail: '', description: '' }),
	new CompletionItem({ label: KnownJsonProperties.SecurityScopes, detail: '', description: '' }),
	new CompletionItem({ label: KnownJsonProperties.ValidatorString, detail: '', description: '' })
];

export const AttributeNamesCompletionObjects: CompletionItem[] = [
	new CompletionItem({ label: AttributeNames.Tag, detail: '', description: 'OpenAPI Tag' }),
	new CompletionItem({ label: AttributeNames.Query, detail: '', description: 'Query Parameter' }),
	new CompletionItem({ label: AttributeNames.Path, detail: '', description: 'Path Parameter' }),
	new CompletionItem({ label: AttributeNames.Body, detail: '', description: 'Body Parameter' }),
	new CompletionItem({ label: AttributeNames.Header, detail: '', description: 'Header Parameter' }),
	new CompletionItem({ label: AttributeNames.Deprecated, detail: '', description: 'Deprecated Operation' }),
	new CompletionItem({ label: AttributeNames.Hidden, detail: '', description: 'Hidden Operation' }),
	new CompletionItem({ label: AttributeNames.Security, detail: '', description: 'Security Check' }),
	new CompletionItem({ label: AttributeNames.AdvancedSecurity, detail: '', description: 'Advanced Security Check' }),
	new CompletionItem({ label: AttributeNames.Route, detail: '', description: 'Route URL' }),
	new CompletionItem({ label: AttributeNames.Response, detail: '', description: 'Success Response' }),
	new CompletionItem({ label: AttributeNames.Description, detail: '', description: 'Description' }),
	new CompletionItem({ label: AttributeNames.Method, detail: '', description: 'HTTP Method' }),
	new CompletionItem({ label: AttributeNames.ErrorResponse, detail: '', description: 'Error Response' })
];

/**
 * Some annotations may appear multiple times on a route.
 * If the user is typing one of those, allow completion.
 * Example 1:
 * User is starting to type @Query on a receiver that already has one; Query is 'repeatable' so the autocomplete should
 * recognize it as a valid completion.
 *
 * Example 2:
 * User is starting to type @Body on a receiver that already has one; Body is not 'repeatable' so the autocomplete should not suggest it.
 */
export const RepeatableAttributes: { [Key in AttributeNames]?: boolean } = {
	[AttributeNames.Query]: true,
	[AttributeNames.Path]: true,
	[AttributeNames.Header]: true,
	[AttributeNames.Security]: true,
	[AttributeNames.AdvancedSecurity]: true,
	[AttributeNames.ErrorResponse]: true
};

export const AttributeDescriptions: { [Key in AttributeNames]: string } = {
	[AttributeNames.Tag]: 'The OpenAPI Tag associated with the controller',
	[AttributeNames.Query]: 'A Query parameter',
	[AttributeNames.Path]: 'A path (URL) parameter',
	[AttributeNames.Body]: 'A body parameter',
	[AttributeNames.Header]: 'A header parameter',
	[AttributeNames.Deprecated]: "When placed on an operation, marks it as 'Deprecated'.\n\nMay be inherited from the controller",
	[AttributeNames.Hidden]: 'Prevents the generation of OpenAPI documentation for the operation',
	[AttributeNames.Security]: 'A security check to be performed before calling the operation.\n\nMay be inherited from the controller',
	[AttributeNames.AdvancedSecurity]: 'A granular security check to be performed before calling the operation.\n\nMay be inherited from the controller',
	[AttributeNames.Route]: "Defines a controller/operation's relative path.\n\nOperation routes are prefixed with the controller's routes",
	[AttributeNames.Response]: 'The expected response upon success',
	[AttributeNames.Description]: "The operation's description",
	[AttributeNames.Method]: 'The HTTP method to be used for the operation',
	[AttributeNames.ErrorResponse]: 'An expected error response upon failure'
};

