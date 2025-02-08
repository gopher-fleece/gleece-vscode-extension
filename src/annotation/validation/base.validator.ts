import { Diagnostic, Position, Range } from 'vscode';
import { GolangSymbol } from '../../symbolic-analysis/golang.common';
import { AnnotationProvider, Attribute } from '../annotation.provider';
import { DiagnosticCode } from '../../diagnostics/enums';
import { diagnosticError } from '../../diagnostics/helpers';
import { AttributeNames } from '../../enums';

export abstract class BaseValidator<TType extends GolangSymbol> {

	public constructor(
		protected readonly _symbol: TType,
		protected readonly _annotations: AnnotationProvider
	) { }

	public abstract validate(): Diagnostic[];

	protected createTooManyOfXError(attributeName: AttributeNames, range: Range): Diagnostic {
		return diagnosticError(
			`A controller method may have a maximum of one @${attributeName} annotation`,
			range,
			DiagnosticCode.MethodLevelTooManyOfAnnotation
		);
	}

	protected createMayNotHaveAnnotation(
		entity: 'Controllers' | 'Receivers',
		attributeName: AttributeNames,
		range: Range
	): Diagnostic {
		return diagnosticError(
			`${entity} may not have a @${attributeName} annotation`,
			range,
			entity === 'Controllers'
				? DiagnosticCode.ControllerLevelAnnotationNotAllowed
				: DiagnosticCode.MethodLevelAnnotationNotAllowed
		);
	}

	protected createMissingRequiredAnnotationError(attributeName: AttributeNames, range: Range): Diagnostic {
		return diagnosticError(
			`A controller method must have a @${attributeName} annotation`,
			range,
			DiagnosticCode.MethodLevelMissingRequiredAnnotation
		);
	}
}
