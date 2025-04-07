import {
	Disposable,
	TreeDataProvider,
	Uri,
	ViewColumn,
	Webview,
	WebviewPanel,
	WebviewView,
	window
} from 'vscode';
import { ReactAppProvider } from './react.app.provider';

export abstract class ReactTreeViewProvider extends ReactAppProvider implements TreeDataProvider {

	private _viewRegistration?: Disposable;

	protected _panel?: WebviewPanel;

	public register(): void {
		this._viewRegistration = this._resourceManager.withDispose(
			() => window.registerTreeDataProvider(`gleece.${this.id}`, this)
		);

		this._panel = this._resourceManager.withDispose(
			() => window.createWebviewPanel(
				this.id,
				this.title,
				ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [Uri.file(this._resourcesRootPath)]
				}
			)
		);

		this._reactAppUri = this._panel.webview.asWebviewUri(this.getReactAppUri());
	}

	public dispose() {
		if (this._viewRegistration) {
			this._resourceManager.unRegisterDisposable(this._viewRegistration);
			this._viewRegistration.dispose();
		}

		if (this._panel) {
			this._resourceManager.unRegisterDisposable(this._panel);
			this._panel.dispose();
		}
	}

	// Provide the content of the webview (this will inject React code)
	public resolveWebviewView(webviewView: WebviewView) {
		// Set options for the webview
		webviewView.webview.options = {
			enableScripts: true
		};

		// Provide HTML content to the webview
		webviewView.webview.html = this.getWebviewContent(webviewView.webview);
	}

	protected getWebviewContent(webview: Webview) {
		const scriptUri = webview.asWebviewUri(this._reactAppUri!);
		const nonce = this.getScriptNonce();

		// <link href="${styleUri}" rel="stylesheet" />
		return `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta
						http-equiv="Content-Security-Policy"
						content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
					>

					<meta
						name="viewport"
						content="width=device-width, initial-scale=1.0"
					>
				</head>

				<body>
					<script nonce="${nonce}">
						acquireVsCodeApi();
					</script>

					<div id="root"></div>
					
					<script nonce="${nonce}" src="${scriptUri.toString()}"></script>
				</body>
			</html>`;
	}
}
