import path from 'path';
import {
	ConfigurationChangeEvent,
	FileSystemWatcher,
	Uri,
	window,
	workspace,
	WorkspaceConfiguration
} from 'vscode';
import { ExtensionRootNamespace, GleeceExtensionConfig } from './extension.config';
import { GleeceConfig } from './gleece.config';
import { readFile } from 'fs/promises';
import { Paths, PathValue } from '../typescript/paths';
import { logger } from '../logging/logger';
import { gleeceContext } from '../context/context';
import { ITypedEvent, TypedEvent } from 'weak-event';

export class ConfigManager {
	private _extensionConfig?: WorkspaceConfiguration;

	private _gleeceConfig?: GleeceConfig;
	private _gleeceConfigWatcher?: FileSystemWatcher;

	private _securitySchemaNames?: string[];

	private _registeredConfigHandlers: Map<Paths<GleeceExtensionConfig>, ((value?: any) => any)[]> = new Map();
	private _extensionConfigChanged: TypedEvent<ConfigManager, ConfigurationChangeEvent> = new TypedEvent();

	public get gleeceConfig(): GleeceConfig | undefined {
		return this._gleeceConfig;
	}

	public get securitySchemaNames(): string[] {
		if (this._securitySchemaNames) {
			return this._securitySchemaNames;
		}

		this._securitySchemaNames = this._gleeceConfig?.openAPIGeneratorConfig?.securitySchemes?.map((schema) => schema.name) ?? [];
		return this._securitySchemaNames;
	}

	public extensionConfigChanged(): ITypedEvent<ConfigManager, ConfigurationChangeEvent> {
		return this._extensionConfigChanged;
	}

	public async init() {
		this._extensionConfig = workspace.getConfiguration(ExtensionRootNamespace);
		await this.loadGleeceConfig();

		gleeceContext.registerDisposable(
			workspace.onDidChangeConfiguration(this.onExtensionConfigChanged.bind(this))
		);

		this.initGleeceConfigWatcher();
	}

	public getExtensionConfigValue<TKey extends Paths<GleeceExtensionConfig>>(key: TKey): PathValue<GleeceExtensionConfig, TKey> | undefined {
		return this._extensionConfig?.get<PathValue<GleeceExtensionConfig, TKey>>(key);
	}

	public registerConfigListener<TKey extends Paths<GleeceExtensionConfig>>(
		configKey: TKey,
		handler: (newValue?: PathValue<GleeceExtensionConfig, TKey>) => any
	): void {
		const existingHandlers = this._registeredConfigHandlers.get(configKey) ?? [];
		this._registeredConfigHandlers.set(configKey, existingHandlers.concat(handler));
	}

	public unregisterConfigListener<TKey extends Paths<GleeceExtensionConfig>>(
		configKey: TKey,
		handler: (newValue?: PathValue<GleeceExtensionConfig, TKey>) => any
	): void {
		const existingHandlers = this._registeredConfigHandlers.get(configKey) ?? [];
		const idx = existingHandlers.findIndex((existingHandler) => existingHandler === handler);
		if (idx >= 0) {
			existingHandlers.splice(idx, 1);
			this._registeredConfigHandlers.set(configKey, existingHandlers);
		}
	}

	private async onExtensionConfigChanged(event: ConfigurationChangeEvent): Promise<void> {
		// First, if the change affects our root, re-fetch the entire configuration
		if (event.affectsConfiguration('gleece')) {
			this._extensionConfig = workspace.getConfiguration(ExtensionRootNamespace);
		}

		// Then, if it affects the gleece.config path, we need to re-load the file and re-initialize the watcher
		if (event.affectsConfiguration('gleece.config.path')) {
			await this.loadGleeceConfig();
			this.initGleeceConfigWatcher();
		}

		// Then we notify the generic event listeners
		this._extensionConfigChanged.invokeAsync(this, event, { swallowExceptions: true })
			.catch((err) => logger.error('Caught an error whilst dispatching configuration changed event', err));


		// Finally, we notify the specific event listeners and provide the freshly obtained config value
		const dispatchPromises: Promise<any>[] = [];
		for (const key of this._registeredConfigHandlers.keys()) {
			if (event.affectsConfiguration(`gleece.${key}`)) {
				const newValue = this.getExtensionConfigValue(key);
				for (const handler of this._registeredConfigHandlers.get(key) ?? []) {
					dispatchPromises.push(handler(newValue));
				}
			}
		}

		const results = await Promise.allSettled(dispatchPromises);
		if (results.find((res) => res.status === 'rejected')) {
			logger.warn('[ConfigManager.fanOutConfigChangedEvents] One or more config change notifications could not be dispatched');
		}
	}

	private async loadGleeceConfig(): Promise<void> {
		const configPath = this.getExtensionConfigValue('config.path') ?? 'gleece.config.json';
		const { error, data } = await this.loadFile(configPath);
		if (error) {
			window.showErrorMessage(`Failed to load configuration file: ${(error as any)?.message}`);
			return;
		}
		try {
			this._gleeceConfig = JSON.parse(data);
			this._securitySchemaNames = undefined;
		} catch (error) {
			window.showErrorMessage(`Could not parse Gleece configuration file at '${configPath}' -  ${(error as any)?.message}`);
		}
	}

	private async loadFile(filePath: string): Promise<{ data: string, error?: unknown }> {
		try {
			const absolutePath = this.resolvePathFromWorkspace(filePath);
			if (!absolutePath) {
				return { error: `no workspace folder is open - cannot determine absolute path '${filePath}'`, data: '' };
			}
			return { data: await readFile(absolutePath, 'utf8') };
		} catch (error) {
			return { error, data: '' };
		}
	}

	private resolvePathFromWorkspace(filePath: string): string | undefined {
		const workspaceFolders = workspace.workspaceFolders;

		if (workspaceFolders && workspaceFolders.length > 0) {
			const workspacePath = workspaceFolders[0].uri.fsPath; // Get the first workspace folder
			return path.resolve(workspacePath, filePath); // Resolve the file path relative to the workspace
		}

		return undefined;
	}

	private initGleeceConfigWatcher(): void {
		if (this._gleeceConfigWatcher) {
			this._gleeceConfigWatcher.dispose();
			gleeceContext.unRegisterDisposable(this._gleeceConfigWatcher);
		}

		// Get the current config file path
		const configPath = this.getExtensionConfigValue('config.path') ?? 'gleece.config.json';
		const absPath = Uri.file(this.resolvePathFromWorkspace(configPath) ?? configPath);

		// Create a new watcher
		this._gleeceConfigWatcher = workspace.createFileSystemWatcher(absPath.fsPath);

		// Listen for changes, deletions, and creations
		this._gleeceConfigWatcher.onDidChange(async () => {
			logger.debug('Gleece config file updated');
			await this.loadGleeceConfig();
		});

		this._gleeceConfigWatcher.onDidDelete(() => {
			logger.debug('Gleece config file deleted');
		});

		this._gleeceConfigWatcher.onDidCreate(async () => {
			logger.debug('Gleece config file created');
			await this.loadGleeceConfig();
		});

		gleeceContext.registerDisposable(this._gleeceConfigWatcher);
	}

}
