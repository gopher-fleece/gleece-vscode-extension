import { ExtensionContext } from 'vscode';
import { FileOverviewProvider } from '../file.overview/file.overview.provider';
import { ReactWebViewProvider } from './react.webview.provider';
import { ResourceManager } from '../../../resource.manager';
import { logger } from '../../../logging/logger';
import { inspect } from 'util';

export class GleeceViewProvider {
	private _views: ReactWebViewProvider[] = [];

	public constructor(
		private readonly _context: ExtensionContext,
		private readonly _resourceManager: ResourceManager
	) {
		this._views.push(
			new FileOverviewProvider(_resourceManager, _context)
		);

		this._views.forEach(
			(view) => {
				try {
					view.register();
				} catch (err) {
					logger.error(`Could not register view '${view.title}' (ID ${view.id}) - ${inspect(err)}`);
				}
			}
		);
	}
}
