import {
	Disposable,
	ExtensionContext,
	Uri,
	ViewColumn,
	Webview,
	WebviewPanel,
	WebviewView,
	WebviewViewProvider,
	window
} from 'vscode';
import { ResourceManager } from '../../resource.manager';
import path from 'path';
import fse from 'fs-extra';

export abstract class ReactWebViewProvider implements WebviewViewProvider, Disposable {

	private _viewRegistration?: Disposable;

	protected _panel?: WebviewPanel;

	protected _reactAppUri?: Uri;

	public abstract readonly id: string;

	public abstract readonly title: string;

	public constructor(
		protected readonly _resourceManager: ResourceManager,
		protected readonly _context: ExtensionContext
	) { }

	public register(): void {
		const resourcesRoot = this.getResourcesRoot();

		this._viewRegistration = this._resourceManager.withDispose(
			() => window.registerWebviewViewProvider(`gleece.${this.id}`, this)
		);

		this._panel = this._resourceManager.withDispose(
			() => window.createWebviewPanel(
				this.id,
				this.title,
				ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [Uri.file(resourcesRoot)]
				}
			)
		);

		const bundledName = `${this.id}.app.js`;
		const appPath = path.join(resourcesRoot, bundledName);
		if (!(fse.existsSync(appPath))) {
			throw new Error(`Path '${appPath}' does not point to a React App file`);
		}

		this._reactAppUri = this._panel.webview.asWebviewUri(Uri.file(appPath));
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
		const nonce = this.getNonce();

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

	private getNonce() {
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let nonce = '';
		for (let i = 0; i < 32; i++) {
			nonce += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return nonce;
	}

	private getResourcesRoot(): string {
		const isDebug = process.env.NODE_ENV === 'development';
		if (isDebug) {
			return path.join(this._context.extensionPath, 'dist');
		}
		return this._context.extensionPath;
	}
}
