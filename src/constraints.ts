import { Monitor } from './monitor';

export type Constraints = {
    needsIndexAccess: boolean;
    needsOrdering: boolean;
    prefersSequential: boolean;
};

export interface AnalysisFlags {
    usesIndexAccess: boolean;
    hasOrdering: boolean;
    sequentialIteration: boolean;
}

/**
 * Builds a formal set of constraints required by the algorithm,
 * based on the contextual flags detected by the analyzer.
 */
export function buildConstraints(flags: AnalysisFlags, monitor: Monitor): Constraints {
    return {
        // If they use v[i] = x, they need a structure that supports index access
        needsIndexAccess: flags.usesIndexAccess,
        
        // If they use sort(), lower_bound(), or specifically chose a map/set, they need ordering
        needsOrdering: flags.hasOrdering,
        
        // If they frequently use range-based for loops or iterator loops
        prefersSequential: flags.sequentialIteration
    };
}
