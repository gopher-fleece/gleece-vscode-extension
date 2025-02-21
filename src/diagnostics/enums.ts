export enum DiagnosticCode {
	AnnotationValueShouldNotExist = 'annotation-value-should-not-exist',
	AnnotationValueMustExist = 'annotation-value-must-exist',
	AnnotationValueInvalid = 'annotation-value-invalid',
	AnnotationPropertiesShouldNotExist = 'annotation-properties-should-not-exist',
	AnnotationPropertiesMustExist = 'annotation-properties-must-exist',
	AnnotationPropertiesInvalid = 'annotation-properties-invalid',
	AnnotationPropertiesMissingKey = 'annotation-properties-missing-key',
	AnnotationPropertiesUnknownKey = 'annotation-properties-unknown-key',
	AnnotationPropertiesInvalidValueForKey = 'annotation-properties-invalid-value-for-key',
	AnnotationDescriptionShouldExist = 'annotation-description-should-exist',

	MethodLevelTooManyOfAnnotation = 'method-too-many-of-annotation',
	MethodLevelMissingRequiredAnnotation = 'method-missing-required-annotation',
	MethodLevelAnnotationNotAllowed = 'method-annotation-not-allowed',

	LinkerRouteMissingPath = 'linker-route-missing-path-reference',
	LinkerUnreferencedParameter = 'linker-unreferenced-parameter',
	LinkerMultipleParameterRefs = 'linker-multiple-parameter-refs',
	LinkerPathInvalidRef = 'linker-path-annotation-invalid-reference',
	LinkerDuplicatePathParamRef = 'linker-duplicate-path-param-ref',
	LinkerDuplicatePathAliasRef = 'linker-duplicate-path-alias-ref',
	LinkerIncompleteAttribute = 'linker-incomplete-attribute',

	ControllerLevelMissingTag = 'controller-missing-tag',
	ControllerLevelAnnotationNotAllowed = 'controller-annotation-not-allowed'
}
