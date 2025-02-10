import { Disposable, OutputChannel, window } from 'vscode';

class Logger implements Disposable {
	private _channel: OutputChannel;

	public constructor() {
		this._channel = window.createOutputChannel('Gleece');
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

	public error(message: string, error?: { toString: () => string }): void {
		this.write(`[ERROR] ${message}`);
		if (error) {
			this.write(typeof error === 'string' ? error : error.toString());
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
