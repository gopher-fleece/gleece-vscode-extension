export enum AnalysisMode {
	Full = 'full',
	Differential = 'differential',
}

export const ExtensionRootNamespace = 'gleece';

export interface GleeceExtensionConfig {
	config: {
		path: string;
	},
	analysis: {
		mode: AnalysisMode;
		enableSymbolicAwareness: boolean;
	}
}
