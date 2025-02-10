import { Disposable, ExtensionContext, HoverProvider, languages } from 'vscode';
import { GleeceCodeActionProvider } from '../code-actions/code.action.provider';
import { SimpleCompletionProvider } from '../completion/gleece.simple.completion.provider';
import { GleeceDiagnosticsListener } from '../diagnostics/listener';
import { SemanticHoverProvider } from '../hover/semantic.hover.provider';
import { ResourceManager } from '../resource.manager';
import { ConfigManager, ConfigValueChangedEvent } from '../configuration/config.manager';
import { logger } from '../logging/logger';
import { SimpleHoverProvider } from '../hover/simple.hover.provider';
import { GoLangId } from '../common.constants';

class GleeceContext implements Disposable {
	private _resourceManager!: ResourceManager;
	private _configManager!: ConfigManager;

	private _completionAndHoverProvider!: SimpleCompletionProvider;
	private _codeActionsProvider!: GleeceCodeActionProvider;
	private _diagnosticsListener!: GleeceDiagnosticsListener;

	private _hoverProviderRegistration?: Disposable;
	private _hoverProvider!: HoverProvider;

	public get resourceManager(): ResourceManager {
		return this._resourceManager;
	}

	public get completionAndHoverProvider(): SimpleCompletionProvider {
		return this._completionAndHoverProvider;
	}

	public get codeActionsProvider(): GleeceCodeActionProvider {
		return this._codeActionsProvider;
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
		this._codeActionsProvider = new GleeceCodeActionProvider();
		this._diagnosticsListener = new GleeceDiagnosticsListener();

		// The logger is registered here so it's collected upon deactivation.
		// The reasoning is that delegating disposal to the logger itself creates a cyclic dependency.
		this._resourceManager.registerDisposable(logger);

		this._configManager.registerConfigListener('analysis.enableSymbolicAwareness', this.onChangeSemanticAnalysis.bind(this));
		const useSemanticAnalysis = this._configManager.getExtensionConfigValue('analysis.enableSymbolicAwareness') ?? false;
		this.onChangeSemanticAnalysis({ previousValue: undefined, newValue: useSemanticAnalysis });
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
		this._configManager.unregisterConfigListener('analysis.enableSymbolicAwareness', this.onChangeSemanticAnalysis.bind(this));
	}

	private onChangeSemanticAnalysis(event: ConfigValueChangedEvent<'analysis.enableSymbolicAwareness'>): void {
		if (event.previousValue === event.newValue) {
			// No change. Noop.
			// Config manager should not call this if value hasn't changed so this check is more to
			// protect against weird calls coming from within the instance itself
			return;
		}

		if (this._hoverProviderRegistration) {
			// Manually dispose the provider here then unregister it.
			// Similar to C# dispose pattern with finalizer
			this._hoverProviderRegistration.dispose();
			this._resourceManager.unRegisterDisposable(this._hoverProviderRegistration);
		}

		this._hoverProvider = event.newValue === true ? new SemanticHoverProvider() : new SimpleHoverProvider();
		this._hoverProviderRegistration = languages.registerHoverProvider(
			{ scheme: 'file', language: GoLangId },
			this._hoverProvider
		);

		this.resourceManager.registerDisposable(this._hoverProviderRegistration);
	}
}

export const gleeceContext = new GleeceContext();
