export enum RoutingEngineType {
	GIN = 'gin',
	Echo = 'echo',
	Mux = 'mux',
	Fiber = 'fiber',
	Chi = 'chi'
}

export enum SecuritySchemeType {
	ApiKey = 'apiKey',
	OAuth2 = 'oauth2',
	OpenIdConnect = 'openIdConnect',
	Http = 'http'
}

export enum SecuritySchemeIn {
	Query = 'query',
	Header = 'header',
	Cookie = 'cookie'
}

// SpecGeneratorConfig interface
export interface SpecGeneratorConfig {
	outputPath: string; // Required
}

// SecuritySchemeConfig interface
export interface SecuritySchemeConfig {
	description: string; // Required
	name: string; // Required, starts with a letter
	fieldName: string; // Required, starts with a letter
	type: SecuritySchemeType; // Required
	in: SecuritySchemeIn; // Required
}

interface License {
	extensions: any;
	name: string;
	url: string;
}

interface Contact {
	extensions: any
	name: string;
	url: string;
	email: string;
}

interface Info {
	extensions: any
	title: string;
	description: string;
	termsOfService: string;
	contact: Contact;
	license: License;
	version: string;
}

// OpenAPIGeneratorConfig interface
export interface OpenAPIGeneratorConfig {
	info: Info; // Required
	baseUrl: string; // Required, must be a valid URL
	securitySchemes: SecuritySchemeConfig[]; // Required, non-empty array
	defaultSecurity: SecurityAnnotationComponent; // Required, non-empty array
	specGeneratorConfig: SpecGeneratorConfig; // Required
}

// CustomValidators interface
export interface CustomValidators {
	functionName: string; // Required
	fullPackageName: string; // Required
	validateTagName: string; // Required, starts with a letter
}

// RoutesConfig interface
export interface RoutesConfig {
	engine: RoutingEngineType; // Required, one of "gin"
	templateOverrides: Record<string, string>;
	outputPath: string; // Required, must be a valid file path
	outputFilePerms?: string; // Optional, must match regex ^(0?[0-7]{3})?$
	packageName?: string; // Optional
	customValidators?: CustomValidators[]; // Optional
	authorizationConfig: AuthorizationConfig; // Required
	validateResponsePayload?: boolean; // Optional, default is false
	skipGenerateDateComment?: boolean; // Optional, default is false
}

// AuthorizationConfig interface
export interface AuthorizationConfig {
	authFileFullPackageName: string; // Required, must be a valid file path
	enforceSecurityOnAllRoutes: boolean; // Required
}

// CommonConfig interface
export interface CommonConfig {
	controllerGlobs?: string[]; // Optional, minimum of 1 if provided
}

// Placeholder for openapi3.Info and RouteSecurity
// Replace these with actual definitions if needed
export interface OpenApi3 {
	Info: Info; // Define the structure here
}

export interface RouteSecurity {
	securityMethod: SecurityAnnotationComponent[];
}

// SecurityAnnotationComponent is the schema-scopes parts of a security annotation;
// i.e., @Security(AND, [{name: "schema1", scopes: ["read", "write"]}, {name: "schema2", scopes: ["delete"]}])
export interface SecurityAnnotationComponent {
	name: string;
	scopes: string[];
}

// Experimental configurations - be careful with using it, it may be unstable and change in future versions
export interface ExperimentalConfig {
	validateTopLevelOnlyEnum: boolean;
	generateEnumValidator: boolean;
}

// GleeceConfig interface
export interface GleeceConfig {
	openAPIGeneratorConfig: OpenAPIGeneratorConfig; // Required
	routesConfig: RoutesConfig; // Required
	commonConfig: CommonConfig; // Required
	experimentalConfig?: ExperimentalConfig;
}
