import { CodeActionProvider, TextDocument, Range, CodeActionContext, CodeAction, CodeActionKind, WorkspaceEdit } from 'vscode';

export class GleeceCodeActionProvider implements CodeActionProvider {
	provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): CodeAction[] | undefined {
		const fixes: CodeAction[] = [];

		// Iterate over diagnostics in the range
		for (const diagnostic of context.diagnostics) {
			if (diagnostic.code === 'my-diagnostic-code') {
				const fix = new CodeAction('Fix this issue', CodeActionKind.QuickFix);
				fix.edit = new WorkspaceEdit();
				fix.edit.replace(document.uri, diagnostic.range, 'fixed code');
				fix.diagnostics = [diagnostic];
				fixes.push(fix);
			}
		}

		return fixes;
	}
}
