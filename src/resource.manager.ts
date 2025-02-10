import { Disposable, ExtensionContext } from 'vscode';

export class ResourceManager {
	private readonly _context: ExtensionContext;

	public constructor(context: ExtensionContext) {
		this._context = context;
	}

	public registerDisposable(...disposable: Disposable[]): void {
		this._context.subscriptions.push(...disposable);
	}

	public unRegisterDisposable(disposable: Disposable): void {
		const idx = this._context.subscriptions.findIndex((d) => d === disposable);
		if (idx >= 0) {
			this._context.subscriptions.splice(idx, 1);
		}
	}
}
