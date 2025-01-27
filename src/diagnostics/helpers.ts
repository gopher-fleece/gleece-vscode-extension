import { Diagnostic, DiagnosticSeverity, Range } from 'vscode';
import { Gleece } from '../common.constants';
import { DiagnosticCode } from './enums';

function createDiagnostic(
	message: string,
	severity: DiagnosticSeverity,
	range: Range,
	code?: number | string,
): Diagnostic {
	const diagnostic = new Diagnostic(range, message, severity);
	diagnostic.source = Gleece
	if (code !== undefined) {
		diagnostic.code = code;
	}
	return diagnostic;
}

export function diagnosticHint(message: string, range: Range, code: DiagnosticCode): Diagnostic {
	return createDiagnostic(message, DiagnosticSeverity.Hint, range, code);
}

export function diagnosticInfo(message: string, range: Range, code: DiagnosticCode): Diagnostic {
	return createDiagnostic(message, DiagnosticSeverity.Information, range, code);
}

export function diagnosticWarning(message: string, range: Range, code: DiagnosticCode): Diagnostic {
	return createDiagnostic(message, DiagnosticSeverity.Warning, range, code);
}

export function diagnosticError(message: string, range: Range, code: DiagnosticCode): Diagnostic {
	return createDiagnostic(message, DiagnosticSeverity.Error, range, code);
}
