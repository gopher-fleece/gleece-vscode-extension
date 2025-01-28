import {
	CodeActionProvider,
	TextDocument,
	Range,
	CodeActionContext,
	CodeAction,
	CodeActionKind,
	WorkspaceEdit,
	Diagnostic,
	Position
} from 'vscode';
import { DiagnosticCode } from '../diagnostics/enums';

export class GleeceCodeActionProvider implements CodeActionProvider {
	private readonly _valueShouldNotExistRegex = /@\w+(\(.+\))/;
	private readonly _propsShouldNotExistRegex = /@\w+\(.+(\s*,\s*.+)\)/;

	public provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): CodeAction[] | undefined {
		const fixes: (CodeAction | undefined)[] = [];

		// Iterate over diagnostics in the range
		for (const diagnostic of context.diagnostics) {
			switch (diagnostic.code) {
				case DiagnosticCode.AnnotationValueShouldNotExist:
					fixes.push(this.fixValueShouldNotExist(document, diagnostic));
					break;
				case DiagnosticCode.AnnotationPropertiesShouldNotExist:
					fixes.push(this.fixPropertiesShouldNotExist(document, diagnostic));
					break;
				case DiagnosticCode.AnnotationValueMustExist:
					break;
				case DiagnosticCode.AnnotationValueInvalid:
					break;
				case DiagnosticCode.AnnotationPropertiesMustExist:
					break;
				case DiagnosticCode.AnnotationPropertiesInvalid:
					break;
				case DiagnosticCode.AnnotationPropertiesMissingKey:
					break;
				case DiagnosticCode.AnnotationPropertiesUnknownKey:
					break;
				case DiagnosticCode.AnnotationPropertiesInvalidValueForKey:
					break;
				case DiagnosticCode.AnnotationDescriptionShouldExist:
					break;
			}
		}

		const quickFixes = fixes.filter((fix) => !!fix);
		const fixAllAction = this.createFixAllAction(document, [...context.diagnostics]);
		if (fixAllAction) {
			return quickFixes.concat(fixAllAction);
		}

		return quickFixes;
	}

	private fixValueShouldNotExist(document: TextDocument, diagnostic: Diagnostic): CodeAction | undefined {
		return this.fixShouldNotExist(document, diagnostic, this._valueShouldNotExistRegex);
	}

	private fixPropertiesShouldNotExist(document: TextDocument, diagnostic: Diagnostic): CodeAction | undefined {
		return this.fixShouldNotExist(document, diagnostic, this._propsShouldNotExistRegex);
	}

	private fixShouldNotExist(document: TextDocument, diagnostic: Diagnostic, matchRegex: RegExp): CodeAction | undefined {
		if (!diagnostic.range.isSingleLine) {
			return undefined;
		}

		const fixRange = this.getShouldNotExistFixRange(document, diagnostic, matchRegex);
		if (!fixRange) {
			return undefined;
		}

		const fix = new CodeAction('Gleece - Remove extraneous code', CodeActionKind.QuickFix);
		fix.edit = new WorkspaceEdit();
		fix.edit.replace(document.uri, fixRange, '');
		fix.diagnostics = [diagnostic];
		return fix
	}

	private getShouldNotExistFixRange(
		document: TextDocument,
		diagnostic: Diagnostic,
		matchRegex: RegExp
	): Range | undefined {
		if (!diagnostic.range.isSingleLine) {
			return undefined;
		}

		const lineIdx = diagnostic.range.start.line;
		const line = document.lineAt(lineIdx);
		const match = matchRegex.exec(line.text);
		const valueWithParentheses = match?.[1];
		if (!valueWithParentheses) {
			return undefined;
		}

		const matchStartIndex = line.text.indexOf(valueWithParentheses);

		return line.range.with(
			new Position(lineIdx, matchStartIndex),
			new Position(lineIdx, matchStartIndex + valueWithParentheses.length)
		);
	}

	private createFixAllAction(document: TextDocument, diagnostics: Diagnostic[]): CodeAction | undefined {
		const workspaceEdit = new WorkspaceEdit();

		for (const diagnostic of diagnostics) {
			if (!diagnostic.range.isSingleLine) {
				continue;
			}

			let fixRange: Range | undefined;
			switch (diagnostic.code) {
				case DiagnosticCode.AnnotationValueShouldNotExist:
					fixRange = this.getShouldNotExistFixRange(document, diagnostic, this._valueShouldNotExistRegex);
					break;
				case DiagnosticCode.AnnotationPropertiesShouldNotExist:
					fixRange = this.getShouldNotExistFixRange(document, diagnostic, this._propsShouldNotExistRegex);
					break;
			}

			if (!fixRange) {
				continue;
			}

			workspaceEdit.replace(document.uri, fixRange, '');
		}

		if (workspaceEdit.size <= 0) {
			return undefined;
		}

		const fixAllAction = new CodeAction('Gleece - Remove all extraneous code', CodeActionKind.SourceFixAll);
		fixAllAction.edit = workspaceEdit;
		fixAllAction.diagnostics = diagnostics;
		return fixAllAction;
	}
}
