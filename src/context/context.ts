import { Disposable, ExtensionContext, HoverProvider } from 'vscode';
import { GleeceCodeActionProvider } from '../code-actions/code.action.provider';
import { SimpleCompletionProvider } from '../completion/gleece.simple.completion.provider';
import { GleeceDiagnosticsListener } from '../diagnostics/listener';
import { SemanticHoverProvider } from '../hover/semantic.hover.provider';
import { ResourceManager } from '../resource.manager';
import { ConfigManager } from '../configuration/config.manager';
import { logger } from '../logging/logger';

class GleeceContext implements Disposable {
	private _resourceManager!: ResourceManager;
	private _configManager!: ConfigManager;

	private _completionAndHoverProvider!: SimpleCompletionProvider;
	private _codeActionsProvider!: GleeceCodeActionProvider;
	private _semanticHoverProvider!: SemanticHoverProvider;
	private _diagnosticsListener!: GleeceDiagnosticsListener;

	private _enableSymbolicAwareness: boolean = true;

	public get resourceManager(): ResourceManager {
		return this._resourceManager;
	}

	public get completionAndHoverProvider(): SimpleCompletionProvider {
		return this._completionAndHoverProvider;
	}

	public get codeActionsProvider(): GleeceCodeActionProvider {
		return this._codeActionsProvider;
	}

	public get hoverProvider(): HoverProvider {
		return this._semanticHoverProvider;
	}

	public get diagnosticsListener(): GleeceDiagnosticsListener {
		return this._diagnosticsListener;
	}

	public get configManager(): ConfigManager {
		return this._configManager;
	}

	public async init(context: ExtensionContext): Promise<void> {

		this._resourceManager = new ResourceManager(context);
		this._configManager = new ConfigManager();
		await this._configManager.init();

		this._completionAndHoverProvider = new SimpleCompletionProvider();
		this._semanticHoverProvider = new SemanticHoverProvider();
		this._codeActionsProvider = new GleeceCodeActionProvider();
		this._diagnosticsListener = new GleeceDiagnosticsListener();

		// The logger is registered here so it's collected upon deactivation.
		// The reasoning is that delegating disposal to the logger itself creates a cyclic dependency.
		this._resourceManager.registerDisposable(logger);

		this._configManager.registerConfigListener('analysis.enableSymbolicAwareness', this.setEnableSymbolicAwareness.bind(this));
		this._enableSymbolicAwareness = this._configManager.getExtensionConfigValue('analysis.enableSymbolicAwareness') ?? false;
	}

	public registerDisposable(disposable: Disposable): void {
		this._resourceManager.registerDisposable(disposable);
	}

	public unRegisterDisposable(disposable: Disposable): void {
		this._resourceManager.unRegisterDisposable(disposable);
	}

	public deactivate(): void {
		this._diagnosticsListener.deactivate();
	}

	public dispose(): void {
		this._configManager.unregisterConfigListener('analysis.enableSymbolicAwareness', this.setEnableSymbolicAwareness.bind(this));
	}

	private setEnableSymbolicAwareness(value?: boolean): void {
		this._enableSymbolicAwareness = value ?? false;
	}
}

export const gleeceContext = new GleeceContext();
