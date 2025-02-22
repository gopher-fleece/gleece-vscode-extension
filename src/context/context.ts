import {
	CodeActionKind,
	commands,
	CompletionItemProvider,
	Disposable,
	ExtensionContext,
	HoverProvider,
	languages,
	window,
	workspace
} from 'vscode';
import { GleeceCodeActionProvider } from '../code-actions/code.action.provider';
import { SimpleCompletionProvider } from '../completion/gleece.simple.completion.provider';
import { GleeceDiagnosticsProvider } from '../diagnostics/provider';
import { SemanticHoverProvider } from '../hover/semantic.hover.provider';
import { ResourceManager } from '../resource.manager';
import { ConfigManager, ExtensionConfigValueChangedEvent } from '../configuration/config.manager';
import { logger } from '../logging/logger';
import { SimpleHoverProvider } from '../hover/simple.hover.provider';
import { GoLangId } from '../common.constants';

/**
 * The main context for the extension
 *
 * @description As the extension uses various configurations requiring different disposables and have a potentially unknown lifetime,
 * it's useful to have cental location that takes care of our current state, similar to a React store.
 *
 * It also helps in preventing cyclic dependency issues between components like the symbolic analyzer and providers
 *
 * @class GleeceContext
 * @implements {Disposable}
 */
class GleeceContext implements Disposable {
	private _resourceManager!: ResourceManager;
	private _configManager!: ConfigManager;

	private _codeActionsProvider!: GleeceCodeActionProvider;
	private _diagnosticsProvider!: GleeceDiagnosticsProvider;

	private _hoverProviderRegistration?: Disposable;
	private _hoverProvider!: HoverProvider;

	private _completionProvider!: CompletionItemProvider;

	/**
	 * Tracks disposables and ensures resource cleanup.
	 * When a new disposable is created, it should be registered with the resource manager.
	 *
	 * Note that the resource manager is just a simple encapsulation of VS code's finalizer queue (i.e., 'subscriptions' array)
	 *
	 * @readonly
	 * @type {ResourceManager}
	 * @memberof GleeceContext
	 */
	public get resourceManager(): ResourceManager {
		return this._resourceManager;
	}

	/**
	 * Provides completion suggestions during typing
	 *
	 * @readonly
	 * @type {CompletionItemProvider}
	 * @memberof GleeceContext
	 */
	public get completionProvider(): CompletionItemProvider {
		return this._completionProvider;
	}

	/**
	 * Provides code actions/fixes
	 *
	 * @readonly
	 * @type {GleeceCodeActionProvider}
	 * @memberof GleeceContext
	 */
	public get codeActionsProvider(): GleeceCodeActionProvider {
		return this._codeActionsProvider;
	}

	/**
	 * Listens in on document changes and analyzes them to produce diagnostics.
	 * Can be used to analyze a file on-demand.
	 *
	 * Lifecycle is managed by the context
	 *
	 * @readonly
	 * @type {GleeceDiagnosticsProvider}
	 * @memberof GleeceContext
	 */
	public get diagnosticsProvider(): GleeceDiagnosticsProvider {
		return this._diagnosticsProvider;
	}

	/**
	 * Allows access to the extension configuration as well as the gleece.config.json file
	 * @readonly
	 * @type {ConfigManager}
	 * @memberof GleeceContext
	 */
	public get configManager(): ConfigManager {
		return this._configManager;
	}

	/**
	 * Initializes the context
	 * Must be called at extension activation before all other operations
	 *
	 * @param {ExtensionContext} context The actual context passed by VS Code during extension activation
	 * @return {Promise<void>}
	 * @memberof GleeceContext
	 */
	public async init(context: ExtensionContext): Promise<void> {

		this._resourceManager = new ResourceManager(context);
		this._configManager = new ConfigManager();
		await this._configManager.init();

		this._completionProvider = new SimpleCompletionProvider();
		this._codeActionsProvider = new GleeceCodeActionProvider();
		this._diagnosticsProvider = new GleeceDiagnosticsProvider();

		// Currently, only a simple completion provider has been implemented.
		// In the future, this may change.
		this._completionProvider = new SimpleCompletionProvider();

		// The logger is registered here so it's collected upon deactivation.
		// The reasoning is that delegating disposal to the logger itself creates a cyclic dependency.
		this._resourceManager.registerDisposable(logger);

		this._configManager.registerConfigListener('analysis.enableSymbolicAwareness', this.onChangeSymbolicAwareness.bind(this));
		const useSemanticAnalysis = this._configManager.getExtensionConfigValue('analysis.enableSymbolicAwareness') ?? false;
		this.onChangeSymbolicAwareness({ previousValue: undefined, newValue: useSemanticAnalysis });

		// Note that the 'hover' provider is currently registered in onChangeSemanticAnalysis, not the registerProviders method.
		// Will need to revamp.
		this.registerStandardProviders();
		this.registerEvents();
		this.registerCommands();
	}

	/**
	 * Registers the standard providers, i.e., providers that do no 'change'.
	 *
	 * @private
	 * @memberof GleeceContext
	 */
	private registerStandardProviders(): void {
		this._resourceManager.registerDisposable(
			languages.registerCompletionItemProvider(
				GoLangId,
				this._completionProvider,
				'@'
			),

			languages.registerCodeActionsProvider(
				{ scheme: 'file', language: GoLangId },
				this.codeActionsProvider,
				{ providedCodeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll] }
			)
		);
	}

	private registerEvents(): void {
		this._resourceManager.registerDisposable(
			workspace.onDidOpenTextDocument((document) => this.diagnosticsProvider.onDemandFullDiagnostics(document)),
			workspace.onDidChangeTextDocument(async (event) => {
				if (
					event.document === window.activeTextEditor?.document
					&& event.document.languageId === GoLangId
					&& event.contentChanges.length > 0
				) {
					await this.diagnosticsProvider.onCurrentDocumentChanged(event);
				}
			}),
			workspace.onDidCloseTextDocument((document) => this.diagnosticsProvider.onDocumentClosed(document))
		);

		this._configManager.gleeceConfigChanged.attach(this.invokeReAnalyze.bind(this));
	}

	private registerCommands(): void {
		this._resourceManager.registerDisposable(
			commands.registerCommand('gleece.reAnalyzeFile', () => {
				if (window.activeTextEditor) {
					this.diagnosticsProvider.onDemandFullDiagnostics(window.activeTextEditor.document)
						.catch((err) => logger.error('Could not re-analyze file', err));
				} else {
					logger.warnPopup('Cannot re-analyze - no file is open');
				}
			})
		);
	}

	public registerDisposable(disposable: Disposable): void {
		this._resourceManager.registerDisposable(disposable);
	}

	public unRegisterDisposable(disposable: Disposable): void {
		this._resourceManager.unRegisterDisposable(disposable);
	}

	public dispose(): void {
		this._configManager.dispose();
		this._diagnosticsProvider.dispose();
		this._hoverProviderRegistration?.dispose?.();
	}

	/**
	 * Reacts to changes in the extension's configuration value `analysis.enableSymbolicAwareness`.
	 *
	 * @description Symbolic awareness requires a radically different approach than simple context-free analysis.
	 * When this setting changes, some providers may have to be replaced;
	 * While not strictly necessary (the same provider can handle both the simple and complex cases), it helps reduce
	 * cyclomatic complexity, runtime overhead (compute/memory) and overall clutter.
	 *
	 * @private
	 * @param {ExtensionConfigValueChangedEvent<'analysis.enableSymbolicAwareness'>} event
	 * @return {void}
	 * @memberof GleeceContext
	 */
	private onChangeSymbolicAwareness(event: ExtensionConfigValueChangedEvent<'analysis.enableSymbolicAwareness'>): void {
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
		}

		this._hoverProvider = event.newValue === true ? new SemanticHoverProvider() : new SimpleHoverProvider();
		this._hoverProviderRegistration = languages.registerHoverProvider(
			{ scheme: 'file', language: GoLangId },
			this._hoverProvider
		);

		this.invokeReAnalyze();
	}

	/**
	 * Invokes a re-analysis of the last analyzed document using the current diagnostic provider
	 *
	 * @private
	 * @memberof GleeceContext
	 */
	private invokeReAnalyze(): void {
		this._diagnosticsProvider.reAnalyzeLastDocument()
			.catch((err) => logger.error(`Failed during re-analysis following a configuration change - ${err}`));
	}
}

export const gleeceContext = new GleeceContext();
