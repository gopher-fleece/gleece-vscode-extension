import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fileOverviewApp = {
	entry: {
		fileOverview: './src/renderer/views/file.overview.app.tsx'
	},
	output: {
		path: path.resolve(__dirname, '..', 'dist'),
		filename: '[name].app.js',
		libraryTarget: 'commonjs2'
	},
	devtool: 'source-map',
	resolve: {
		extensions: ['.js', '.ts', '.tsx', '.json']
	},
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				loader: 'ts-loader',
				options: {}
			},
			{
				test: /\.css$/,
				use: [
					{
						loader: 'style-loader'
					},
					{
						loader: 'css-loader'
					}
				]
			}
		]
	},
	performance: {
		hints: false
	}
};

export default [fileOverviewApp];