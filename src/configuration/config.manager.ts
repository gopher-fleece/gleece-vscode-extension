import path from 'path';
import { window, workspace, WorkspaceConfiguration } from 'vscode';
import { GleeceExtensionConfig } from './extension.config';
import { GleeceConfig } from './gleece.config';
import { readFile } from 'fs/promises';
import { resourceManager } from '../extension';

class ConfigManager {
	private _extensionConfig?: WorkspaceConfiguration;

	private _gleeceConfig?: GleeceConfig;

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
		this._extensionConfig = workspace.getConfiguration('gleece.extension')
		await this.loadGleeceConfig();

		resourceManager.registerDisposable(
			workspace.onDidChangeConfiguration(async (event) => {
				if (event.affectsConfiguration('gleece.extension.gleeceConfigPath')) {
					await this.loadGleeceConfig();
				}
			})
		);
	}

	public getExtensionConfigValue<TKey extends keyof GleeceExtensionConfig>(key: TKey): GleeceExtensionConfig[TKey] | undefined {
		return this._extensionConfig?.get<GleeceExtensionConfig[TKey]>(key);
	}

	private async loadGleeceConfig(): Promise<void> {
		const configPath = this.getExtensionConfigValue('gleeceConfigPath') ?? 'gleece.config.json';
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
			return { error, data: '' }
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
}

export const configManager = new ConfigManager();
