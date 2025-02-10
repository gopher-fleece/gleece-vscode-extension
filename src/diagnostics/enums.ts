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
	MethodLevelMissingParamAnnotation = 'method-missing-param-annotation',
	MethodLevelConflictingSchemaEntityAnnotation = 'method-conflicting-schema-entity-annotation',
	MethodLevelConflictingParamAnnotation = 'method-conflicting-param-annotation',

	ControllerLevelMissingTag = 'controller-missing-tag',
	ControllerLevelAnnotationNotAllowed = 'controller-annotation-not-allowed'
}
