import { Disposable, ExtensionContext, Uri } from 'vscode';
import { ResourceManager } from '../../../resource.manager';
import path from 'path';
import fse from 'fs-extra';

export abstract class ReactAppProvider implements Disposable {

	protected _reactAppUri?: Uri;

	protected _resourcesRootPath: string;

	public abstract readonly id: string;

	public abstract readonly title: string;

	public constructor(
		protected readonly _resourceManager: ResourceManager,
		protected readonly _context: ExtensionContext
	) {
		this._resourcesRootPath = this.getResourcesRoot();
	}

	public abstract register(): void;

	public abstract dispose(): void | Promise<void>;

	protected getReactAppUri(): Uri {
		const bundledName = `${this.id}.app.js`;
		const appPath = path.join(this._resourcesRootPath, bundledName);
		if (!(fse.existsSync(appPath))) {
			throw new Error(`Path '${appPath}' does not point to a React App file`);
		}
		return Uri.file(appPath);
	}

	protected getScriptNonce() {
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
