// KnownTemplate enum
export enum KnownTemplate {
	ROUTES = 'routes',
	CONTROLLER_RESPONSE_PARTIAL = 'controller.response.partial'
}

// RoutingEngineType enum
export enum RoutingEngineType {
	GIN = 'gin'
}

// SecuritySchemeType enum
export enum SecuritySchemeType {
	// Add possible values here based on the Go definition
}

// SecuritySchemeIn enum
export enum SecuritySchemeIn {
	// Add possible values here based on the Go definition
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
	templateOverrides: Record<KnownTemplate, string>;
	outputPath: string; // Required, must be a valid file path
	outputFilePerms?: string; // Optional, must match regex ^(0?[0-7]{3})?$
	packageName?: string; // Optional
	customValidators?: CustomValidators[]; // Optional
	authorizationConfig: AuthorizationConfig; // Required
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

// GleeceConfig interface
export interface GleeceConfig {
	openAPIGeneratorConfig: OpenAPIGeneratorConfig; // Required
	routesConfig: RoutesConfig; // Required
	commonConfig: CommonConfig; // Required
}
