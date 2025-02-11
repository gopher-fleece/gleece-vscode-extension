import {
	CodeActionKind,
	commands,
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

class GleeceContext implements Disposable {
	private _resourceManager!: ResourceManager;
	private _configManager!: ConfigManager;

	private _completionAndHoverProvider!: SimpleCompletionProvider;
	private _codeActionsProvider!: GleeceCodeActionProvider;
	private _diagnosticsProvider!: GleeceDiagnosticsProvider;

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

	public get diagnosticsListener(): GleeceDiagnosticsProvider {
		return this._diagnosticsProvider;
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
		this._diagnosticsProvider = new GleeceDiagnosticsProvider();

		// The logger is registered here so it's collected upon deactivation.
		// The reasoning is that delegating disposal to the logger itself creates a cyclic dependency.
		this._resourceManager.registerDisposable(logger);

		this._configManager.registerConfigListener('analysis.enableSymbolicAwareness', this.onChangeSymbolicAwareness.bind(this));
		const useSemanticAnalysis = this._configManager.getExtensionConfigValue('analysis.enableSymbolicAwareness') ?? false;
		this.onChangeSymbolicAwareness({ previousValue: undefined, newValue: useSemanticAnalysis });

		// Note that the 'hover' provider is currently registered in onChangeSemanticAnalysis, not the registerProviders method.
		// Will need to revamp.
		this.registerProviders();
		this.registerEvents();
		this.registerCommands();
	}

	private registerProviders(): void {
		this._resourceManager.registerDisposable(
			languages.registerCompletionItemProvider(
				GoLangId,
				this.completionAndHoverProvider,
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
			workspace.onDidOpenTextDocument((document) => this.diagnosticsListener.onDemandFullDiagnostics(document)),
			workspace.onDidChangeTextDocument(async (event) => {
				if (
					event.document === window.activeTextEditor?.document
					&& event.document.languageId === GoLangId
					&& event.contentChanges.length > 0
				) {
					await this.diagnosticsListener.onCurrentDocumentChanged(event);
				}
			}),
			workspace.onDidCloseTextDocument((document) => this.diagnosticsListener.onDocumentClosed(document))
		);

		this._configManager.gleeceConfigChanged.attach(this.invokeReAnalyze.bind(this));
	}

	private registerCommands(): void {
		this._resourceManager.registerDisposable(
			commands.registerCommand('gleece.reAnalyzeFile', () => {
				if (window.activeTextEditor) {
					this.diagnosticsListener.onDemandFullDiagnostics(window.activeTextEditor.document)
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

	private invokeReAnalyze(): void {
		this._diagnosticsProvider.reAnalyzeLastDocument()
			.catch((err) => logger.error(`Failed during re-analysis following a configuration change - ${err}`));
	}
}

export const gleeceContext = new GleeceContext();
