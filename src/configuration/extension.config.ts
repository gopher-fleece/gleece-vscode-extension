export enum AnalysisMode {
	Full = 'full',
	Differential = 'differential',
}

export interface GleeceExtensionConfig {
	gleece: {
		config: {
			path: string;
		},
		analysis: {
			mode: AnalysisMode;
		}
	}
}
