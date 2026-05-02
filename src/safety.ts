import { DecisionResult } from './decision';

export interface SafetyContext {
    hasOrdering: boolean;
    usesIndexAccess: boolean;
    sequentialIteration: boolean;
}

export interface SafetyResult {
    passed: boolean;
    blockedReason: string | null;
}

/**
 * Safety filter that runs AFTER the decision engine.
 * Blocks suggestions that would break correctness based on context flags.
 * This is a fast O(1) check — no regex or string parsing.
 */
export function applySafetyFilter(
    suggestion: string | null,
    currentStructure: string,
    context: SafetyContext
): SafetyResult {
    if (!suggestion) {
        return { passed: true, blockedReason: null };
    }

    // Rule 1: If code uses index access (v[i]), only vector/deque support O(1) random access
    if (context.usesIndexAccess) {
        const noIndexAccess = ['std::list', 'std::set', 'std::unordered_set'];
        if (noIndexAccess.includes(suggestion)) {
            return {
                passed: false,
                blockedReason: `Blocked: ${suggestion} does not support O(1) index access (v[i] detected in code)`
            };
        }
    }

    // Rule 2: If ordering is required, block unordered containers
    if (context.hasOrdering) {
        const unorderedTypes = ['std::unordered_map', 'std::unordered_set'];
        if (unorderedTypes.includes(suggestion)) {
            return {
                passed: false,
                blockedReason: `Blocked: ${suggestion} does not maintain order (sort/lower_bound detected in code)`
            };
        }
    }

    // Rule 3: If sequential iteration dominates, prefer vector over list (cache locality)
    if (context.sequentialIteration) {
        if (suggestion === 'std::list') {
            return {
                passed: false,
                blockedReason: `Blocked: std::list has poor cache locality for sequential iteration (range-for/iterator loop detected)`
            };
        }
    }

    return { passed: true, blockedReason: null };
}
