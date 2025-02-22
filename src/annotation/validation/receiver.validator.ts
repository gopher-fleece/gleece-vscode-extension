import { Diagnostic } from 'vscode';
import { GolangReceiver } from '../../symbolic-analysis/golang.receiver';
import { BaseValidator } from './base.validator';
import { diagnosticWarning } from '../../diagnostics/helpers';
import { DiagnosticCode } from '../../diagnostics/enums';
import { AttributeNames } from '../../enums';
import { AnnotationProvider } from '../annotation.provider';
import { AnnotationLinkValidator } from '../linker/annotation.link.validator';

export class ReceiverValidator extends BaseValidator<GolangReceiver> {
	private readonly _linkValidator: AnnotationLinkValidator;

	public constructor(
		symbol: GolangReceiver,
		annotations: AnnotationProvider
	) {
		super(symbol, annotations);
		this._linkValidator = new AnnotationLinkValidator(symbol, annotations);
	}

	public validate(): Diagnostic[] {
		const contextIssues = this.validateAnnotationsContext();
		const linkErrors = this._linkValidator.validate();

		return contextIssues.concat(linkErrors);
	}

	private validateAnnotationsContext(): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const counts = this._annotations.getAttributeCounts();
		if (counts.Tag > 0) {
			diagnostics.push(diagnosticWarning(
				'Receivers may not have a @Tag annotation',
				this._annotations.range,
				DiagnosticCode.MethodLevelAnnotationNotAllowed
			));
		}

		if (counts.Body > 1) {
			diagnostics.push(this.createTooManyOfXError(AttributeNames.Body, this._annotations.range));
		}

		switch (counts.Method) {
			case 0:
				diagnostics.push(this.createMissingRequiredAnnotationError(AttributeNames.Method, this._annotations.range));
				break;
			case 1:
				break;
			default:
				diagnostics.push(this.createTooManyOfXError(AttributeNames.Method, this._annotations.range));
				break;
		}

		switch (counts.Route) {
			case 0:
				diagnostics.push(this.createMissingRequiredAnnotationError(AttributeNames.Route, this._annotations.range));
				break;
			case 1:
				break;
			default:
				diagnostics.push(this.createTooManyOfXError(AttributeNames.Route, this._annotations.range));
				break;
		}

		return diagnostics;
	}
}
