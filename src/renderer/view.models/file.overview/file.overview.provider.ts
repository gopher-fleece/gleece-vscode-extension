import { ReactWebViewProvider } from '../infrastructure/react.webview.provider';

export class FileOverviewProvider extends ReactWebViewProvider {
	public readonly id: string = 'fileOverview';
	public readonly title: string = 'File Overview';
}
