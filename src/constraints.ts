import { Monitor } from './monitor';
import { Context } from './context';

export type Constraints = {
    needsIndexAccess: boolean;
    needsOrdering: boolean;
    prefersSequential: boolean;
};

/**
 * Builds a formal set of constraints required by the algorithm,
 * based on the contextual flags detected by the analyzer.
 */
export function buildConstraints(context: Context, monitor: Monitor): Constraints {
    return {
        // If they use v[i] = x, they need a structure that supports index access
        needsIndexAccess: context.usesIndexAccess,
        
        // If they use sort(), lower_bound(), or specifically chose a map/set, they need ordering
        needsOrdering: context.hasOrdering,
        
        // If they frequently use range-based for loops or iterator loops
        prefersSequential: context.sequentialIteration
    };
}

