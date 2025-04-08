import { Disposable, OutputChannel, window } from 'vscode';
import { GleeceCapitalized } from '../common.constants';

export enum LogLevel {
	Debug = 'DEBUG',
	Info = 'INFO',
	Warn = 'WARN',
	Error = 'ERROR'
}

class Logger implements Disposable {
	private _channel: OutputChannel;

	public constructor() {
		this._channel = window.createOutputChannel(GleeceCapitalized);
	}

	public debug(message: string): void {
		this.write(`[DEBUG] ${message}`);
	}

	public info(message: string): void {
		this.write(`[INFO]  ${message}`);
	}

	public warn(message: string): void {
		this.write(`[WARN]  ${message}`);
	}

	public warnPopup(message: string): void {
		this.warn(message);
		window.showWarningMessage(message);
	}

	public errorPopup(message: string, logPrefix?: string): void {
		this.warn(`${logPrefix ? `${logPrefix} ` : ''}${message}`);
		window.showErrorMessage(message);
	}

	public error(message: string, error?: { toString: () => string }): void {
		this.write(`[ERROR] ${message}`);
		if (error) {
			this.write(typeof error === 'string' ? error : error.toString());
		}
	}

	public timeOperation<T>(label: string, fn: () => T, level?: LogLevel): T {
		const start = performance.now();
		const result = fn();
		const end = performance.now();
		this.writePerfMessage(level ?? LogLevel.Debug, label, start, end);
		return result;
	}

	public async timeOperationAsync<T>(label: string, fn: () => PromiseLike<T>, level?: LogLevel): Promise<T> {
		const start = performance.now();
		const result = await fn();
		const end = performance.now();
		this.writePerfMessage(level ?? LogLevel.Debug, label, start, end);
		return result;
	}

	private formatPerfMessage(label: string, start: number, end: number): string {
		return `${label} took ${(end - start).toFixed(2)}ms`;
	}

	private writePerfMessage(level: LogLevel, label: string, start: number, end: number): void {
		const message = this.formatPerfMessage(label, start, end);
		switch (level) {
			case LogLevel.Debug:
				this.debug(message);
				break;
			case LogLevel.Info:
				this.info(message);
				break;
			case LogLevel.Warn:
				this.warn(message);
				break;
			case LogLevel.Error:
				this.error(message);
				break;
		}
	}

	private write(message: string): void {
		const now = new Date();
		this._channel.appendLine(`${now.toLocaleString()} ${message}`);
	}

	public dispose() {
		this._channel?.dispose();
	}
}

export const logger = new Logger();
