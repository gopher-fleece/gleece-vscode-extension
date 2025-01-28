import { Disposable, ExtensionContext } from 'vscode';

export class ResourceManager {
	private readonly _context: ExtensionContext;

	public constructor(context: ExtensionContext) {
		this._context = context;
	}

	public registerDisposable(disposable: Disposable): void {
		this._context.subscriptions.push(disposable);
	}
}
