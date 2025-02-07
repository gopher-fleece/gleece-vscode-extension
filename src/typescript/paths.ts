// Join two keys together, separated by a dot.
type Join<K, P> = K extends string | number
	? P extends string | number
	? `${K}.${P}`
	: never
	: never;

// A helper to control recursion depth (prevents infinite recursion)
type Prev = [never, 0, 1, 2, 3, 4, 5, ...0[]];

// Recursively extract all dot-separated paths from a nested object T.
// It first restricts keys to those that are string or number.
export type Paths<T, Depth extends number = 5> = [Depth] extends [never]
	? never
	: T extends object
	? {
		[K in Extract<keyof T, string | number>]-?: T[K] extends object
		? `${K}` | Join<K, Paths<T[K], Prev[Depth]>>
		: `${K}`;
	}[Extract<keyof T, string | number>]
	: never;

export type PathValue<T, P extends string> =
	P extends `${infer K}.${infer Rest}` // if the path contains a dot
	? K extends keyof T
	? PathValue<T[K], Rest>
	: never
	: P extends keyof T
	? T[P]
	: never;
