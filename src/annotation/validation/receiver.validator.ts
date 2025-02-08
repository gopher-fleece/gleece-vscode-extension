import { Diagnostic } from 'vscode';
import { GolangReceiver } from '../../symbolic-analysis/golang.receiver';
import { BaseValidator } from './base.validator';
import { diagnosticError, diagnosticWarning } from '../../diagnostics/helpers';
import { DiagnosticCode } from '../../diagnostics/enums';
import { AttributeNames, KnownJsonProperties } from '../../enums';
import { Attribute } from '../annotation.provider';
import { combineRanges } from '../../utils/range.utils';
import { getAttributeRange } from '../annotation.functional';

export class ReceiverValidator extends BaseValidator<GolangReceiver> {

	public validate(): Diagnostic[] {
		const annotationIssues = this.validateAnnotationsContext();
		const refIssues = this.validateMissingParameterRefs();
		const duplicationIssues = this.validateDuplicateParamRefs();
		const schemaDeclarationIssues = this.validateSchemaDeclarations();

		return annotationIssues.concat(refIssues, duplicationIssues, schemaDeclarationIssues);
	}

	private validateMissingParameterRefs(): Diagnostic[] {
		const paramAttributes = this._annotations.findManyByValue(this._symbol.getParameterNames());
		if (paramAttributes.length === this._symbol.parameters.length) {
			// All params have a matching attribute
			return [];
		}

		const diagnostics: Diagnostic[] = [];

		for (const param of this._symbol.parameters) {
			if (!paramAttributes.find((attr) => attr.value === param.name)) {
				diagnostics.push(
					diagnosticError(
						`Parameter '${param.name}' does not have a matching annotation`,
						param.range,
						DiagnosticCode.MethodLevelMissingParamAnnotation
					)
				);
			}
		}

		return diagnostics;
	}

	private validateDuplicateParamRefs(): Diagnostic[] {
		const namesMap: Map<string, Attribute[]> = new Map();
		for (const attribute of this._annotations.getAttributes()) {
			switch (attribute.name) {
				case AttributeNames.Query:
				case AttributeNames.Path:
				case AttributeNames.Header:
					if (!attribute.value) {
						continue;
					}

					// If the alias already exists, set it to 'true' i.e., mark as an error
					namesMap.set(attribute.value, (namesMap.get(attribute.value) ?? []).concat(attribute));
					break;
				default:
					break;
			}
		}

		const diagnostics: Diagnostic[] = [];
		for (const [alias, conflictingAttribs] of namesMap.entries()) {
			if (conflictingAttribs.length > 1) {
				const paramType = conflictingAttribs[0].name;
				const diagRange = combineRanges(
					conflictingAttribs.map((attr) => getAttributeRange(attr))
				);
				diagnostics.push(
					diagnosticError(
						`${paramType} parameter '${alias}' is referenced by multiple annotations`,
						diagRange,
						DiagnosticCode.MethodLevelConflictingParamAnnotation
					)
				);
			}
		}

		return diagnostics;
	}

	private validateSchemaDeclarations(): Diagnostic[] {
		const attrValueToCount = new Map<string, Attribute[]>();

		for (const attribute of this._annotations.getAttributes()) {
			switch (attribute.name) {
				case AttributeNames.Query:
				case AttributeNames.Path:
				case AttributeNames.Header:
					const alias = attribute.properties?.[KnownJsonProperties.Name];
					if (!alias) {
						continue;
					}
					attrValueToCount.set(alias, (attrValueToCount.get(alias) ?? []).concat(attribute));
					break;
				default:
					break;
			}
		}

		const diagnostics: Diagnostic[] = [];
		for (const [valueName, referencingAttributes] of attrValueToCount.entries()) {
			if (referencingAttributes.length > 1) {
				diagnostics.push(
					diagnosticError(
						`Schema entity '${valueName}' is declared multiple times`,
						combineRanges(referencingAttributes.map((attr) => getAttributeRange(attr))),
						DiagnosticCode.MethodLevelConflictingSchemaEntityAnnotation
					)
				);
			}
		}

		return diagnostics;
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