import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import stylisticPlugin from '@stylistic/eslint-plugin';

export default tsEslint.config(
	{
		ignores: ['eslint.config.mjs', 'webpack.config.js', '.yarn', 'dist', 'coverage', '*/generated/*'],
	},
	eslint.configs.recommended,
	...tsEslint.configs.recommendedTypeChecked,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
				ecmaVersion: 2024

			},
		},
		plugins: {
			'@stylistic': stylisticPlugin,
		},
		rules: {
			'import/prefer-default-export': 'off',
			'arrow-body-style': 'off',
			'class-methods-use-this': 'off',
			'no-restricted-syntax': 'off',
			'no-continue': 'off',
			'no-console': 'off',
			'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
			'import/no-unresolved': 'off',
			'max-len': ['error', { 'code': 155, 'ignoreRegExpLiterals': true }],
			'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
			'no-tabs': 'off',
			'@typescript-eslint/indent': 'off',
			'@stylistic/comma-dangle': ['error', {
				'arrays': 'never',
				'objects': 'never',
				'imports': 'never',
				'exports': 'never',
				'functions': 'never'
			}],
			'padded-blocks': 'off',
			'no-lonely-if': 'off',
			'no-plusplus': 'off',
			'no-underscore-dangle': 'off',
			'spaced-comment': ['error', 'always', {
				'line': {
					'markers': ['#region', '#endregion']
				}
			}],
			'object-curly-newline': ['error', { 'ImportDeclaration': { 'minProperties': 5 } }],
			'@stylistic/eol-last': ['error', 'always'],
			'@stylistic/no-trailing-spaces': 'error',
			'@stylistic/semi': ['error', 'always'],
			'@stylistic/quotes': ['error', 'single', { "avoidEscape": true }],
			'@stylistic/no-multi-spaces': ['error', { 'ignoreEOLComments': true }],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-namespace': 'off', // Personally like namespaces as static function containers
			'@typescript-eslint/no-unsafe-member-access': 'off', // Not ideal but we're manipulating low level constructs here so its quite inconvenient
			'@typescript-eslint/no-unsafe-argument': 'off', // Same deal as above
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					'args': 'all',
					'argsIgnorePattern': '^_',
					'caughtErrors': 'all',
					'caughtErrorsIgnorePattern': '^_',
					'destructuredArrayIgnorePattern': '^_',
					'varsIgnorePattern': '^_',
					'ignoreRestSiblings': true
				}
			]
		},
	},
	{
		files: ["builder/**/*.ts"],
		rules: {
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off'
		},
	},
	{
		files: ["test/**/*.ts"],
		rules: {
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
		},
	},
);
