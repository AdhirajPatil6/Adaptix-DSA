/**
 * Context Type Module
 * 
 * Centralizes the analysis context flags that describe how a data structure
 * is being used in the code. Ensures all fields are always initialized.
 */

export interface Context {
    /** Code uses array-style index access: v[i] */
    usesIndexAccess: boolean;
    /** Code uses ordering operations: sort(), lower_bound(), or ordered containers */
    hasOrdering: boolean;
    /** Code uses sequential iteration: range-for or iterator loops */
    sequentialIteration: boolean;
}

/**
 * Factory function that guarantees a fully-initialized Context with safe defaults.
 * All flags default to false (no assumption of usage).
 */
export function createDefaultContext(overrides?: Partial<Context>): Context {
    return {
        usesIndexAccess: false,
        hasOrdering: false,
        sequentialIteration: false,
        ...overrides,
    };
}
