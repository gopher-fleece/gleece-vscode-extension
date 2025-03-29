import { Disposable, ExtensionContext } from 'vscode';

export class ResourceManager {
	private readonly _context: ExtensionContext;

	public constructor(context: ExtensionContext) {
		this._context = context;
	}

	public registerDisposable(...disposable: Disposable[]): void {
		this._context.subscriptions.push(...disposable);
	}

	public withDispose<T extends Disposable>(creator: (() => T)): T {
		return this.withDisposeMany(creator)[0];
	}

	public withDisposeMany<T extends Disposable>(...creators: (() => T)[]): T[] {
		const created: T[] = [];

		try {
			creators?.forEach((creator) => {
				const newDisposable = creator();
				created.push(newDisposable);
			});
		} finally {
			// Ensure all newly created disposables are registered, even if we've had some failures
			this._context.subscriptions.push(...created);
		}

		return created;
	}

	public unRegisterDisposable(disposable: Disposable): void {
		const idx = this._context.subscriptions.findIndex((d) => d === disposable);
		if (idx >= 0) {
			this._context.subscriptions.splice(idx, 1);
		}
	}
}
