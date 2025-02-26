import { Diagnostic, Range } from 'vscode';
import { AttributeNames, KnownJsonProperties } from '../../enums';
import { GolangReceiver } from '../../symbolic-analysis/golang.receiver';
import { AnnotationProvider, Attribute } from '../annotation.provider';
import { diagnosticError } from '../../diagnostics/helpers';
import { DiagnosticCode } from '../../diagnostics/enums';
import { getAttributeAlias, getAttributeRange } from '../annotation.functional';
import didYouMean from 'didyoumean';

interface ClassifiedAttributes {
	routeAttribute: Attribute | undefined;
	pathAttributes: Attribute[];
	nonPathAttributes: Map<string, Attribute>;
}

/**
 * Provides annotation/URL/function parameters cross-validation
 *
 * @description The purpose of this class is to analyze the linkages between URL parameters,
 * annotations and the annotated receiver's parameters.
 *
 * @export
 * @class AnnotationLinkValidator
 */
export class AnnotationLinkValidator {
	constructor(
		private readonly _functionSymbol: GolangReceiver,
		private readonly _annotations: AnnotationProvider
	) { }


	/**
	 * Validates the held annotations/function links.
	 * Performed checks:
	 *
	 * * Each URL parameter may only appear once
	 * * Each URL parameter must have a matching `@Path` annotation
	 * * Each `@Path` annotation must link to a `@Route` URL parameter via *Alias* or *Value*
	 * * Each `@Path` annotation must link to a function parameter via *Value*
	 * * `@Path` annotation values must be unique
	 * * `@Path` annotation aliases must be unique
	 * * Each function parameter must be referenced by *exactly* one `@Path`/`@Query`/`@Header`/`@Body` annotation
	 *
	 * @return {Diagnostic[]}
	 * @memberof AnnotationLinkValidator
	 */
	public validate(): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];

		const funcParamNames = new Set(this._functionSymbol.getParameterNames()); // A list of function parameters
		const seenFuncParams = new Map<string, Attribute>(); // Tracks function params referenced by annotations

		// 1. Classify the attributes into parameters for link checking.
		const { routeAttribute, pathAttributes, nonPathAttributes } = this.classifyAttributes();

		// 2. Check @Route parameters for duplications and matching matching @Path attributes
		if (routeAttribute) {
			diagnostics.push(...this.validateRoute(pathAttributes, routeAttribute));
		}

		// 3. Validate @Path attributes against function parameters
		diagnostics.push(...this.validatePathAnnotations(
			routeAttribute,
			pathAttributes,
			funcParamNames,
			seenFuncParams
		));

		// 4. Validate other annotations against function parameters
		diagnostics.push(...this.validateNonPathAnnotations(nonPathAttributes, funcParamNames, seenFuncParams));

		// 5. Ensure all function parameters are referenced
		for (const paramName of funcParamNames) {
			if (!seenFuncParams.has(paramName)) {
				diagnostics.push(diagnosticError(
					`Function parameter '${paramName}' is not referenced by a parameter annotation`,
					this._functionSymbol.parameters.find((p) => p.name == paramName)!.range,
					DiagnosticCode.LinkerUnreferencedParameter
				));
			}
		}

		return diagnostics;
	}

	/**
	 * Classifies the held attributes into route/path/other parameters
	 *
	 * @private
	 * @return {ClassifiedAttributes}
	 * @memberof AnnotationLinkValidator
	 */
	private classifyAttributes(): ClassifiedAttributes {
		let routeAttribute: Attribute | undefined;
		const pathAttributes: Attribute[] = [];
		const nonPathAttributes: Map<string, Attribute> = new Map();

		for (const attr of this._annotations.getAttributes()) {
			/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
			switch (attr.name) {
				case AttributeNames.Route:
					routeAttribute = attr;
					break;
				case AttributeNames.Path:
					pathAttributes.push(attr);
					break;
				case AttributeNames.Query:
				case AttributeNames.Header:
				case AttributeNames.Body:
				case AttributeNames.FormField:
					nonPathAttributes.set(attr.value!, attr);
					break;
			}
			/* eslint-enable @typescript-eslint/no-unsafe-enum-comparison */
		}

		return { routeAttribute, pathAttributes, nonPathAttributes };
	}

	/**
	 * Validates a given route does not have duplicate parameters and has all its parameters
	 * referenced by matching `@Path` annotations
	 *
	 * @private
	 * @param {Attribute[]} pathAttributes
	 * @param {Attribute} routeAttribute
	 * @return {Diagnostic[]}
	 * @memberof AnnotationLinkValidator
	 */
	private validateRoute(pathAttributes: Attribute[], routeAttribute: Attribute): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];

		const urlParams = this.extractUrlParams(routeAttribute.value ?? '');
		const referencedAliases = new Set(pathAttributes.map((attr) => getAttributeAlias(attr)));

		const paramCounts: { [Key: string]: boolean } = {};
		for (const urlParam of urlParams) {

			// Verify each URL param appears exactly once
			if (paramCounts[urlParam]) {
				diagnostics.push(diagnosticError(
					`Duplicate route parameter '${urlParam}'`,
					this.getRangeForUrlParam(routeAttribute, urlParam),
					DiagnosticCode.LinkerRouteMissingPath
				));
			} else {
				paramCounts[urlParam] = true;
			}

			// Verify each URL param has a matching @Path annotation
			if (!referencedAliases.has(urlParam)) {
				diagnostics.push(diagnosticError(
					`Route parameter '${urlParam}' does not have a corresponding @Path annotation`,
					this.getRangeForUrlParam(routeAttribute, urlParam),
					DiagnosticCode.LinkerRouteMissingPath
				));
			}
		}

		return diagnostics;
	}

	/**
	 * Validates @Path annotations against the annotated function's parameters
	 *
	 * @private
	 * @param {Map<string, Attribute>} pathAttributes
	 * @param {Set<string>} funcParamNames
	 * @param {Map<string, Attribute>} seenFuncParams ***In/Out*** - The function parameters seen thus far by the linker.
	 *
	 * **The value of this parameter is modified by the method**
	 * @return {Diagnostic[]}
	 * @memberof AnnotationLinkValidator
	 */
	private validatePathAnnotations(
		routeAttribute: Attribute | undefined,
		pathAttributes: Attribute[],
		funcParamNames: Set<string>,
		seenFuncParams: Map<string, Attribute> // Out param
	): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const seenRefValues = new Set<string>();
		const seenAliases = new Set<string>();

		const urlParams = new Set(this.extractUrlParams(routeAttribute?.value ?? ''));

		for (const pathAttr of pathAttributes) {
			// Note that func params are referenced by the Value field, not the alias.
			const expectedFuncParamName = pathAttr.value!;

			// Check if the path references a known func parameter
			if (!funcParamNames.has(expectedFuncParamName)) {
				const suggestion = this.getContextualAppendedSuggestion(
					expectedFuncParamName,
					Array.from(funcParamNames),
					seenFuncParams.keys()
				);
				diagnostics.push(diagnosticError(
					`@Path '${expectedFuncParamName}' is not a parameter of ${this._functionSymbol.name}${suggestion}`,
					pathAttr.valueRange!,
					DiagnosticCode.LinkerPathInvalidRef
				));
			} else {
				// Check if the referenced parameter has already been linked by a different annotation
				if (seenFuncParams.has(expectedFuncParamName)) {
					diagnostics.push(diagnosticError(
						`Function parameter '${expectedFuncParamName}' is referenced by multiple @Path attributes`,
						pathAttr.valueRange!,
						DiagnosticCode.LinkerMultipleParameterRefs
					));
				}
				seenFuncParams.set(expectedFuncParamName, pathAttr);
			}

			// Check if the Path value appears multiple times
			if (seenRefValues.has(expectedFuncParamName)) {
				diagnostics.push(diagnosticError(
					`Duplicate @Path parameter reference '${expectedFuncParamName}'`,
					getAttributeRange(pathAttr),
					DiagnosticCode.LinkerDuplicatePathParamRef
				));
			} else {
				seenRefValues.add(expectedFuncParamName);
			}

			const alias = pathAttr.properties?.[KnownJsonProperties.Name];
			if (alias) {
				// Check if the Path's alias (i.e. 'name' property) appears multiple times
				if (seenAliases.has(alias)) {
					diagnostics.push(diagnosticError(
						`Duplicate @Path parameter alias '${alias}'`,
						getAttributeRange(pathAttr),
						DiagnosticCode.LinkerDuplicatePathAliasRef
					));
				} else {
					seenAliases.add(alias);
				}

				// Check if the alias exists as a URL parameter
				if (!urlParams.has(alias)) {
					const suggestion = this.getAppendedSuggestion(alias, Array.from(urlParams));
					diagnostics.push(diagnosticError(
						`Unknown @Path parameter alias '${alias}'${suggestion}`,
						getAttributeRange(pathAttr),
						DiagnosticCode.LinkerPathInvalidRef
					));
				}
			}
		}

		return diagnostics;
	}

	/**
	 * Validates non-@Path parameter annotations against the annotated function's parameters
	 *
	 * @private
	 * @param {Map<string, Attribute>} nonPathAttributes
	 * @param {Set<string>} funcParamNames
	 * @param {Map<string, Attribute>} seenFuncParams ***In/Out*** - The function parameters seen thus far by the linker.
	 *
	 * **The value of this parameter is modified by the method**
	 * @return {Diagnostic[]}
	 * @memberof AnnotationLinkValidator
	 */
	private validateNonPathAnnotations(
		nonPathAttributes: Map<string, Attribute>,
		funcParamNames: Set<string>,
		seenFuncParams: Map<string, Attribute> // Out param
	): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		for (const [param, attr] of nonPathAttributes) {
			if (!param || !attr.valueRange) {
				// Partial annotation. Should be linted by the context free analyzer (i.e., not here)
				continue;
			}

			if (!funcParamNames.has(param)) {
				const suggestion = this.getContextualAppendedSuggestion(param, funcParamNames, seenFuncParams.keys());
				diagnostics.push(diagnosticError(
					`@${attr.name} '${param}' does not match any parameter of ${this._functionSymbol.name}${suggestion}`,
					attr.valueRange,
					DiagnosticCode.LinkerPathInvalidRef
				));
			} else {
				seenFuncParams.set(param, attr);
			}

		}
		return diagnostics;
	}

	/**
	 * Extracts URL path parameters from a route string
	 * @example '/user/{id}/details' => ['id']
	 */
	private extractUrlParams(route: string): string[] {
		const matches = route.match(/\{(\w+)\}/g);
		return matches ? matches.map(match => match.slice(1, -1)) : [];
	}

	/**
	 * Gets a usable `Range` for the given route URL parameter
	 *
	 * @private
	 * @param {Attribute} route
	 * @param {string} param
	 * @return {Range}
	 * @memberof AnnotationLinkValidator
	 */
	private getRangeForUrlParam(route: Attribute, param: string): Range {
		const paramIdx = route.value!.indexOf(`{${param}}`);
		return new Range(
			route.valueRange!.start.line,
			route.valueRange!.start.character + paramIdx,
			route.valueRange!.end.line,
			route.valueRange!.start.character + paramIdx + param.length + 2
		);
	}

	/**
	 * Gets a 'did you mean' suggestion based on the input and options
	 * Intended to be directly appended to the end of diagnostic texts
	 *
	 * @private
	 * @param {string} input
	 * @param {string[]} options
	 * @return {string}
	 * @memberof AnnotationLinkValidator
	 */
	private getAppendedSuggestion(input: string, options: string[]): string {
		const suggestion = didYouMean(input, options);
		return suggestion ? `. Did you mean ${suggestion}?` : '';
	}

	/**
	 * Gets a 'did you mean' suggestion based on the input and options whilst ignoring options that are already 'consumed'
	 * Intended to be directly appended to the end of diagnostic texts
	 *
	 * @private
	 * @param {string} input
	 * @param {Iterable<string>} allOpts
	 * @param {Iterable<string>} alreadyUsedOpts
	 * @return {string}
	 * @memberof AnnotationLinkValidator
	 */
	private getContextualAppendedSuggestion(input: string, allOpts: Iterable<string>, alreadyUsedOpts: Iterable<string>): string {
		const opts = new Set(allOpts);
		Array.from(alreadyUsedOpts).forEach((used) => opts.delete(used));

		const suggestion = didYouMean(input, Array.from(opts));
		return suggestion ? `. Did you mean '${suggestion}'?` : '';
	}
}
