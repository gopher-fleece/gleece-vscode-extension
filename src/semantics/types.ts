import { Diagnostic } from 'vscode';
import { Attribute } from '../annotation/annotation.provider';

export type Validator = (attribute: Attribute, mustHaveMessage?: string) => Diagnostic[];

export type CircuitBreaker = (attribute: Attribute) => boolean;

export type Validation = { validator: Validator | CircuitBreaker, breakOnFailure: boolean };

export type ValidationSequences = { name?: Validation[], value?: Validation[], properties?: Validation[], description?: Validation[] };


export type PropertyValidator = (attribute: Attribute, propertyKey: string, propertyValue: any) => Diagnostic[];

export type PropertyCircuitBreaker = (attribute: Attribute, propertyKey: string, propertyValue: any) => boolean;

export type PropertyValidation = { validator: PropertyValidator | PropertyCircuitBreaker, breakOnFailure: boolean };

export interface PropertyValidationConfig {
	name: string;
	validations?: PropertyValidation[];
}
