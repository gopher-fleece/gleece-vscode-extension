import path from 'path';
import {
	ConfigurationChangeEvent,
	Disposable,
	FileSystemWatcher,
	Uri,
	workspace,
	WorkspaceConfiguration
} from 'vscode';
import { ExtensionRootNamespace, GleeceExtensionConfig } from './extension.config';
import { GleeceConfig } from './gleece.config';
import { readFile } from 'fs-extra';
import { Paths, PathValue } from '../typescript/paths';
import { logger } from '../logging/logger';
import { ITypedEvent, TypedEvent } from 'weak-event';
import { inspect, isDeepStrictEqual } from 'util';
import { GleeceRuntimePackage, GoModFileName } from '../common.constants';

export interface ExtensionConfigValueChangedEvent<TKey extends Paths<GleeceExtensionConfig>> {
	previousValue?: PathValue<GleeceExtensionConfig, TKey>;
	newValue?: PathValue<GleeceExtensionConfig, TKey>;
}

export interface GleeceConfigValueChangedEvent {
	previousValue?: GleeceConfig;
	newValue?: GleeceConfig;
}

type ExtensionConfigValueChangedEventHandler<
	TKey extends Paths<GleeceExtensionConfig>
> = (
	e: ExtensionConfigValueChangedEvent<TKey>
) => any;

export interface GleeceConfigPathChangedEvent {
	previousValue?: string;
	newValue?: string;
}

export class ConfigManager implements Disposable {
	private _extensionConfig?: WorkspaceConfiguration;

	private _goModWatcher?: FileSystemWatcher;
	private _isGleeceProject?: boolean;

	private _gleeceConfig?: GleeceConfig;
	private _gleeceConfigPath?: string;
	private _gleeceConfigChanged: TypedEvent<ConfigManager, GleeceConfigValueChangedEvent> = new TypedEvent();
	private _gleeceConfigWatcher?: FileSystemWatcher;
	private _gleeceConfigPathChanged: TypedEvent<ConfigManager, GleeceConfigPathChangedEvent> = new TypedEvent();

	private _securitySchemaNames?: string[];

	private _registeredConfigHandlers: Map<Paths<GleeceExtensionConfig>, ExtensionConfigValueChangedEventHandler<any>[]> = new Map();
	private _extensionConfigChanged: TypedEvent<ConfigManager, ConfigurationChangeEvent> = new TypedEvent();
	private _extensionConfigChangedListener?: Disposable;

	public get gleeceConfig(): GleeceConfig | undefined {
		return this._gleeceConfig;
	}

	public get gleeceConfigPath(): string | undefined {
		return this._gleeceConfigPath;
	}

	public get gleeceConfigPathChanged(): ITypedEvent<ConfigManager, GleeceConfigPathChangedEvent> {
		return this._gleeceConfigPathChanged;
	}

	public get gleeceConfigChanged(): ITypedEvent<ConfigManager, GleeceConfigValueChangedEvent> {
		return this._gleeceConfigChanged;
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
		await logger.timeOperationAsync(
			'Configuration manager initialization',
			async () => {
				this._extensionConfig = workspace.getConfiguration(ExtensionRootNamespace);
				await this.updateIsGleeceProject();
				await this.loadGleeceConfig();
				this._extensionConfigChangedListener = workspace.onDidChangeConfiguration(this.onExtensionConfigChanged.bind(this));
				this.initGoModWatcher();
				this.initGleeceConfigWatcher();
			}
		);
	}

	public getExtensionConfigValue<TKey extends Paths<GleeceExtensionConfig>>(key: TKey): PathValue<GleeceExtensionConfig, TKey> | undefined {
		return this._extensionConfig?.get<PathValue<GleeceExtensionConfig, TKey>>(key);
	}

	public setExtensionConfigValue<TKey extends Paths<GleeceExtensionConfig>>(
		key: TKey,
		value: PathValue<GleeceExtensionConfig, TKey> | undefined
	): void {
		this._extensionConfig?.update(key, value);
	}

	public registerConfigListener<TKey extends Paths<GleeceExtensionConfig>>(
		configKey: TKey,
		handler: ExtensionConfigValueChangedEventHandler<TKey>
	): void {
		const existingHandlers = this._registeredConfigHandlers.get(configKey) ?? [];
		this._registeredConfigHandlers.set(configKey, existingHandlers.concat(handler));
	}

	public unregisterConfigListener<TKey extends Paths<GleeceExtensionConfig>>(
		configKey: TKey,
		handler: ExtensionConfigValueChangedEventHandler<TKey>
	): void {
		const existingHandlers = this._registeredConfigHandlers.get(configKey) ?? [];
		const idx = existingHandlers.findIndex((existingHandler) => existingHandler === handler);
		if (idx >= 0) {
			if (existingHandlers.length > 1) {
				existingHandlers.splice(idx, 1);
				this._registeredConfigHandlers.set(configKey, existingHandlers);
			} else {
				this._registeredConfigHandlers.delete(configKey); // Delete the key altogether to reclaim a little space
			}
		}
	}

	private async onExtensionConfigChanged(event: ConfigurationChangeEvent): Promise<void> {
		// First, if the change affects our root, re-fetch the entire configuration
		const oldConfig = this._extensionConfig;
		if (event.affectsConfiguration('gleece')) {
			// Force a reload of the configuration
			this._extensionConfig = workspace.getConfiguration(ExtensionRootNamespace);
			logger.debug('Extension config has been updated');
		} else {
			// No point in continuing if our namespace hasn't changed
			return;
		}

		// Then, if it affects the gleece.config path, we need to re-load the file and re-initialize the watcher
		const pathKey = 'config.path';
		if (event.affectsConfiguration(`gleece.${pathKey}`)) {
			await this.loadGleeceConfig();
			this.initGleeceConfigWatcher();
			const previousValue: string | undefined = oldConfig?.get(pathKey);
			this._gleeceConfigPathChanged.invokeAsync(
				this,
				{
					previousValue,
					newValue: this.getExtensionConfigValue('config.path')
				}
			).catch((err) => logger.error('Caught an error whilst dispatching configuration path changed event', err));
		}

		// Then we notify the generic event listeners
		this._extensionConfigChanged.invokeAsync(this, event, { swallowExceptions: true })
			.catch((err) => logger.error('Caught an error whilst dispatching configuration changed event', err));


		// Finally, we notify the specific event listeners and provide the freshly obtained config value
		const dispatchPromises: Promise<any>[] = [];
		for (const key of this._registeredConfigHandlers.keys()) {
			const fullConfigKey = `gleece.${key}`;
			if (event.affectsConfiguration(fullConfigKey)) {
				const changeHandlers = this._registeredConfigHandlers.get(key) ?? [];
				if (changeHandlers.length <= 0) {
					continue;
				}

				logger.debug(`Configuration section '${key}' has changed. Notifying ${changeHandlers.length} listener/s`);
				const previousValue = oldConfig ? oldConfig.get(key) : undefined;
				const newValue = this.getExtensionConfigValue(key);
				for (const handler of changeHandlers) {
					dispatchPromises.push(handler({ previousValue, newValue }));
				}
			}
		}

		const results = await Promise.allSettled(dispatchPromises);
		if (results.find((res) => res.status === 'rejected')) {
			logger.warn('[ConfigManager.fanOutConfigChangedEvents] One or more config change notifications could not be dispatched');
		}
	}

	private async updateIsGleeceProject(): Promise<void> {
		const { error, data } = await this.loadFile(GoModFileName);
		if (error) {
			logger.warn(`Could not load go.mod - ${(error as Error)?.message ?? inspect(error)}`);
			this._isGleeceProject = false;
		}

		this._isGleeceProject = data?.includes(GleeceRuntimePackage) === true;
	}

	private async loadGleeceConfig(): Promise<void> {
		if (!this._isGleeceProject) {
			if (this._gleeceConfig) {
				logger.debug('Project does not have a go.mod file but gleece.config was already read');
			}
			return;
		}

		const configPath = this.getExtensionConfigValue('config.path') ?? 'gleece.config.json';
		const { error, data } = await this.loadFile(configPath);
		if (error) {
			logger.errorPopup(`Failed to load configuration file: ${(error as any)?.message}`);
			return;
		}
		try {
			this._gleeceConfigPath = this.resolvePathFromWorkspace(configPath);
			const oldConfig = this._gleeceConfig;
			this._gleeceConfig = JSON.parse(data);
			const configChanged = !isDeepStrictEqual(oldConfig, this._gleeceConfig);
			if (configChanged) {
				this._gleeceConfigChanged.invokeAsync(
					this,
					{
						previousValue: structuredClone(oldConfig),
						newValue: structuredClone(this._gleeceConfig)
					}
				).catch((err) => logger.error(`Failed to dispatch Gleece Config Changed event to one or more listeners - ${err}`));
			}
			this._securitySchemaNames = undefined;
		} catch (error) {
			logger.warn(`Could not parse Gleece configuration file at '${configPath}' -  ${(error as any)?.message}`);
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
		this._gleeceConfigWatcher?.dispose?.();

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
	}

	private initGoModWatcher(): void {
		this._goModWatcher?.dispose?.();
		// Create a new watcher
		this._goModWatcher = workspace.createFileSystemWatcher(this.resolvePathFromWorkspace(GoModFileName) ?? GoModFileName);

		// Listen for changes, deletions, and creations
		this._goModWatcher.onDidChange(async () => {
			await this.updateIsGleeceProject();
			logger.debug(`Detected go.mod update, project is ${this._isGleeceProject ? '' : 'not '}a gleece project`);
		});

		this._goModWatcher.onDidDelete(() => {
			this._isGleeceProject = false;
			logger.debug('Detected go.mod deletion');
		});

		this._goModWatcher.onDidCreate(async () => {
			await this.updateIsGleeceProject();
			logger.debug(`Detected go.mod creation, project is ${this._isGleeceProject ? '' : 'not '}a gleece project`);
		});
	}

	public dispose() {
		this._registeredConfigHandlers.clear();
		this._extensionConfigChangedListener?.dispose?.();
		this._gleeceConfigWatcher?.dispose?.();
	}

}
