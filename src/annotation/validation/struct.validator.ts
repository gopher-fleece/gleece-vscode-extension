import { Diagnostic } from 'vscode';
import { BaseValidator } from './base.validator';
import { diagnosticWarning } from '../../diagnostics/helpers';
import { DiagnosticCode } from '../../diagnostics/enums';
import { AttributeNames } from '../../enums';
import { GolangStruct } from '../../symbolic-analysis/gonlang.struct';

export class StructValidator extends BaseValidator<GolangStruct> {

	public validate(): Diagnostic[] {
		const annotationIssues = this.validateAnnotationsContext();
		return annotationIssues;
	}


	private validateAnnotationsContext(): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const counts = this._annotations.getAttributeCounts();

		if (counts.Tag <= 0) {
			const controller = (this._symbol);
			diagnostics.push(diagnosticWarning(
				`Controller '${controller.symbol.name}' does not have a @Tag`,
				this._annotations.range,
				DiagnosticCode.ControllerLevelMissingTag
			));
		}

		if (counts.Query > 0) {
			diagnostics.push(this.createMayNotHaveAnnotation('Controllers', AttributeNames.Query, this._annotations.range));
		}
		if (counts.Path > 0) {
			diagnostics.push(this.createMayNotHaveAnnotation('Controllers', AttributeNames.Path, this._annotations.range));
		}
		if (counts.Body > 0) {
			diagnostics.push(this.createMayNotHaveAnnotation('Controllers', AttributeNames.Body, this._annotations.range));
		}
		if (counts.FormField > 0) {
			diagnostics.push(this.createMayNotHaveAnnotation('Controllers', AttributeNames.FormField, this._annotations.range));
		}
		if (counts.Header > 0) {
			diagnostics.push(this.createMayNotHaveAnnotation('Controllers', AttributeNames.Header, this._annotations.range));
		}
		if (counts.Method > 0) {
			diagnostics.push(this.createMayNotHaveAnnotation('Controllers', AttributeNames.Method, this._annotations.range));
		}

		return diagnostics;
	}

}
