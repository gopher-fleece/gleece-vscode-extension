import * as vscode from 'vscode';
import JSON5 from 'json5';

enum Annotation {
    method = '@Method',
    route = '@Route',
    tag = '@Tag',
    query = '@Query',
    path = '@Path',
    body = '@Body',
    header = '@Header',
    response = '@Response',
    errorResponse = '@ErrorResponse',
    description = '@Description',
    deprecated = '@Deprecated',
    security = '@Security',
}

interface AnnotationValidOptions {
    options?: string[];
    paramValidator?: (param: string) => boolean;
    hasDescription: boolean;
}

function isValidInteger(str: string): boolean {
    return /^-?\d+$/.test(str);
}

function isValidPath(path: string): boolean {
    // Basic validation rules:
    // 1. Must start with a forward slash
    // 2. Can contain multiple segments separated by forward slashes
    // 3. Can contain parameters in curly braces
    // 4. Can't have consecutive forward slashes
    // 5. Can't end with a forward slash (optional, remove if needed)

    // If the path is empty or doesn't start with a slash, it's invalid
    if (!path || !path.startsWith('/')) {
        return false;
    }

    // Check for consecutive slashes
    if (path.includes('//')) {
        return false;
    }

    // Remove trailing slash for validation (optional, remove if you want to allow trailing slashes)
    path = path.endsWith('/') ? path.slice(0, -1) : path;

    // Regular expression to validate the path
    const pathRegex = /^\/(?:[a-zA-Z0-9-_]+|\{[a-zA-Z0-9-_]+\})(?:\/(?:[a-zA-Z0-9-_]+|\{[a-zA-Z0-9-_]+\}))*$/;

    return pathRegex.test(path);
}

const annotationValidOptions: { [key in Annotation]: AnnotationValidOptions } = {
    [Annotation.method]: {
        paramValidator: (param: string) => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(param),
        hasDescription: false,
    },
    [Annotation.route]: {
        paramValidator: (param: string) => isValidPath(param),
        hasDescription: false,
    },
    [Annotation.tag]: {
        hasDescription: false,
    },
    [Annotation.query]: {
        options: ['validate', 'name'],
        paramValidator: (param: string) => param.indexOf(' ') === -1,
        hasDescription: true,
    },
    [Annotation.path]: {
        options: ['validate', 'name'],
        paramValidator: (param: string) => param.indexOf(' ') === -1,
        hasDescription: true,
    },
    [Annotation.body]: {
        options: ['validate', 'name'],
        paramValidator: (param: string) => param.indexOf(' ') === -1,
        hasDescription: true,
    },
    [Annotation.header]: {
        options: ['validate', 'name'],
        paramValidator: (param: string) => param.indexOf(' ') === -1,
        hasDescription: true,
    },
    [Annotation.response]: {
        paramValidator: (param: string) => {
            if (!isValidInteger(param)) {
                return false;
            }
            const num = parseInt(param, 10);
            return num >= 100 && num < 400;
        },
        hasDescription: true,
    },
    [Annotation.errorResponse]: {
        paramValidator: (param: string) => {
            if (!isValidInteger(param)) {
                return false;
            }
            const num = parseInt(param, 10);
            return num >= 400 && num < 600;
        },
        hasDescription: true,
    },
    [Annotation.description]: {
        hasDescription: true,
    },
    [Annotation.deprecated]: {
        hasDescription: false,
    },
    [Annotation.security]: {
        options: ['scopes'],
        paramValidator: (param: string) => param.indexOf(' ') === -1,
        hasDescription: false,
    },
};

// Create decoration types at the top level
const decorationTypes = {
    annotation: vscode.window.createTextEditorDecorationType({
        color: '#00BCD4',
        fontWeight: 'bold'
    }),
    parentheses: vscode.window.createTextEditorDecorationType({
        color: '#00BCD4',
        fontWeight: 'bold'
    }),
    parameter: vscode.window.createTextEditorDecorationType({
        color: '#09d67a',
    }),
    options: vscode.window.createTextEditorDecorationType({
        color: '#0b7b8a',
    }),
    invalidOptions: vscode.window.createTextEditorDecorationType({
        color: '#e34d1b',
    }),
    description: vscode.window.createTextEditorDecorationType({
        color: '#0b72b5',
        fontStyle: 'italic'
    }),
    comment: vscode.window.createTextEditorDecorationType({
        color: '#808080',
        fontStyle: 'italic'
    }),
    commentSlashes: vscode.window.createTextEditorDecorationType({
        color: '#808080',
        fontWeight: 'bold'
    })
};

function splitByFirstComma(input: string, splitter: string): [string, string] {
    const index = input.indexOf(splitter);
    if (index === -1) {
        return [input, ''];
    }
    return [
        input.slice(0, index),
        input.slice(index + 1)
    ];
}

// Add this function to parse JSON5 options
function parseOptions(annotation: Annotation, optionsString: string): boolean {
    try {
        const results = JSON5.parse(optionsString);

        if (Array.isArray(results)) {
            return false;
        }

        for (const optionsKey of Object.keys(results)) {
            if (!annotationValidOptions[annotation].options?.includes(optionsKey)) {
                return false;
            }
        }
        return true;
    } catch (error) {
        return false;
    }
}

export function activate(context: vscode.ExtensionContext) {
    let activeEditor = vscode.window.activeTextEditor;

    function updateDecorations() {
        if (!activeEditor) {
            return;
        }

        if (!activeEditor.document.fileName.endsWith('.go')) {
            return;
        }

        const text = activeEditor.document.getText();
        const lines = text.split('\n');

        const annotationDecorations: vscode.DecorationOptions[] = [];
        const parameterDecorations: vscode.DecorationOptions[] = [];
        const optionsDecorations: vscode.DecorationOptions[] = [];
        const invalidOptionsDecorations: vscode.DecorationOptions[] = [];
        const descriptionDecorations: vscode.DecorationOptions[] = [];
        const commentDecorations: vscode.DecorationOptions[] = [];
        const parenthesesDecorations: vscode.DecorationOptions[] = [];
        const commentSlashesDecorations: vscode.DecorationOptions[] = [];

        lines.forEach((line, lineIndex) => {
            if (!line?.trimStart()?.startsWith('//')) {
                return;
            }

            const commentText = line.split('//')[1].trim();
            const annotation = commentText?.split('(')?.[0]?.split(' ')?.[0] as Annotation;

            if (!Object.values(Annotation).includes(annotation as Annotation)) {
                return;
            }

            const lineStart = line.indexOf(annotation);
            if (lineStart === -1) {
                return;
            }

            const slashesStart = line.indexOf('//');
            const slashesRange = new vscode.Range(
                new vscode.Position(lineIndex, slashesStart),
                new vscode.Position(lineIndex, slashesStart + 2)
            );
            commentSlashesDecorations.push({ range: slashesRange });

            const annotationRange = new vscode.Range(
                new vscode.Position(lineIndex, lineStart),
                new vscode.Position(lineIndex, lineStart + annotation.length)
            );
            annotationDecorations.push({ range: annotationRange });

            const annotationLeftText = line.substring(lineStart + annotation.length).trim();
            let description = '';
            let annotationArgs = '';
            let annotationParam = '';
            let annotationOptions = '';

            if (annotationLeftText.startsWith('(')) {
                // Handle case with parentheses
                const openParenIndex = line.indexOf('(', lineStart);
                if (openParenIndex !== -1) {
                    const openParenRange = new vscode.Range(
                        new vscode.Position(lineIndex, openParenIndex),
                        new vscode.Position(lineIndex, openParenIndex + 1)
                    );
                    parenthesesDecorations.push({ range: openParenRange });
                }

                const closeParenIndex = line.indexOf(')', openParenIndex);
                if (closeParenIndex !== -1) {
                    const closeParenRange = new vscode.Range(
                        new vscode.Position(lineIndex, closeParenIndex),
                        new vscode.Position(lineIndex, closeParenIndex + 1)
                    );
                    parenthesesDecorations.push({ range: closeParenRange });

                    annotationArgs = line.substring(openParenIndex + 1, closeParenIndex).trim();
                    const argsPars = splitByFirstComma(annotationArgs, ",");
                    annotationParam = argsPars[0]?.trim() || '';
                    annotationOptions = argsPars[1]?.trim() || '';

                    if (annotationParam) {
                        const validOptions = annotationValidOptions[annotation].paramValidator?.(annotationParam) ?? true;
                        const paramStart = line.indexOf(annotationParam);
                        const paramRange = new vscode.Range(
                            new vscode.Position(lineIndex, paramStart),
                            new vscode.Position(lineIndex, paramStart + annotationParam.length)
                        );
                        if (!validOptions) {
                            invalidOptionsDecorations.push({ range: paramRange });
                        } else {
                            parameterDecorations.push({ range: paramRange });
                        }
                    }

                    if (annotationOptions) {
                        const validOptions = parseOptions(annotation, annotationOptions);
                        const optStart = line.indexOf(annotationOptions);
                        const optRange = new vscode.Range(
                            new vscode.Position(lineIndex, optStart),
                            new vscode.Position(lineIndex, optStart + annotationOptions.length)
                        );

                        if (!validOptions) {
                            invalidOptionsDecorations.push({ range: optRange });
                        } else {
                            optionsDecorations.push({ range: optRange });
                        }
                    }

                    // Get description after closing parenthesis
                    description = line.substring(closeParenIndex + 1).trim();
                }
            } else {
                // No parentheses - treat everything after annotation as description
                description = annotationLeftText;
            }

            // Add description decoration if there is any description text
            if (description) {
                const descStart = line.indexOf(description);
                const descRange = new vscode.Range(
                    new vscode.Position(lineIndex, descStart),
                    new vscode.Position(lineIndex, descStart + description.length)
                );
                if (annotationValidOptions[annotation].hasDescription) {
                    descriptionDecorations.push({ range: descRange });
                } else {
                    commentDecorations.push({ range: descRange });
                }
            }
        });

        // Apply all decorations
        activeEditor.setDecorations(decorationTypes.annotation, annotationDecorations);
        activeEditor.setDecorations(decorationTypes.parameter, parameterDecorations);
        activeEditor.setDecorations(decorationTypes.options, optionsDecorations);
        activeEditor.setDecorations(decorationTypes.invalidOptions, invalidOptionsDecorations);
        activeEditor.setDecorations(decorationTypes.description, descriptionDecorations);
        activeEditor.setDecorations(decorationTypes.comment, commentDecorations);
        activeEditor.setDecorations(decorationTypes.parentheses, parenthesesDecorations);
        activeEditor.setDecorations(decorationTypes.commentSlashes, commentSlashesDecorations);
    }

    if (activeEditor) {
        updateDecorations();
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            updateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            updateDecorations();
        }
    }, null, context.subscriptions);
}

export function deactivate() {
    Object.values(decorationTypes).forEach(decoration => decoration.dispose());
}