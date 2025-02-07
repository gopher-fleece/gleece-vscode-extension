import path from 'path';
import {
	FileSystemWatcher,
	Uri,
	window,
	workspace,
	WorkspaceConfiguration
} from 'vscode';
import { ExtensionRootNamespace, GleeceExtensionConfig } from './extension.config';
import { GleeceConfig } from './gleece.config';
import { readFile } from 'fs/promises';
import { resourceManager } from '../extension';
import { Paths, PathValue } from '../typescript/paths';

class ConfigManager {
	private _extensionConfig?: WorkspaceConfiguration;

	private _gleeceConfig?: GleeceConfig;
	private _gleeceConfigWatcher?: FileSystemWatcher;

	private _securitySchemaNames?: string[];

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

	public async init() {
		this._extensionConfig = workspace.getConfiguration(ExtensionRootNamespace);
		await this.loadGleeceConfig();

		resourceManager.registerDisposable(
			workspace.onDidChangeConfiguration(async (event) => {
				if (event.affectsConfiguration('gleece.config.path')) {
					await this.loadGleeceConfig();
					await this.initGleeceConfigWatcher();
				}
			})
		);

		await this.initGleeceConfigWatcher();
	}

	public getExtensionConfigValue<TKey extends Paths<GleeceExtensionConfig>>(key: TKey): PathValue<GleeceExtensionConfig, TKey> | undefined {
		return this._extensionConfig?.get<PathValue<GleeceExtensionConfig, TKey>>(key);
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

	private async initGleeceConfigWatcher(): Promise<void> {
		if (this._gleeceConfigWatcher) {
			this._gleeceConfigWatcher.dispose();
			resourceManager.unRegisterDisposable(this._gleeceConfigWatcher);
		}

		// Get the current config file path
		const configPath = this.getExtensionConfigValue('config.path') ?? 'gleece.config.json';
		const absPath = Uri.file(this.resolvePathFromWorkspace(configPath) ?? configPath);

		// Create a new watcher
		this._gleeceConfigWatcher = workspace.createFileSystemWatcher(absPath.fsPath);

		// Listen for changes, deletions, and creations
		this._gleeceConfigWatcher.onDidChange(async () => {
			console.debug(`Gleece config file updated`);
			await this.loadGleeceConfig();
		});

		this._gleeceConfigWatcher.onDidDelete(async () => {
			console.debug(`Gleece config file deleted`);
		});

		this._gleeceConfigWatcher.onDidCreate(async () => {
			console.debug(`Gleece config file created`);
			await this.loadGleeceConfig();
		});

		resourceManager.registerDisposable(this._gleeceConfigWatcher);
	}

}

export const configManager = new ConfigManager();
