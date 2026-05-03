/**
 * Refactor Safety Validator
 * 
 * Validates whether a proposed data structure refactor is safe given the
 * current usage context. Prevents refactors that would break code semantics
 * (e.g., switching to an unordered structure when ordering is required).
 */

import { Context } from './context';
import { DS_CAPABILITIES } from './capabilities';

export interface SafetyResult {
    isSafe: boolean;
    warnings: string[];
}

/**
 * Checks if refactoring from one data structure to another is safe
 * given the detected usage context.
 * 
 * @returns SafetyResult with isSafe=true if no constraints are violated,
 *          or isSafe=false with specific warnings explaining the risks.
 */
export function validateRefactorSafety(
    context: Context,
    fromStructure: string,
    toStructure: string
): SafetyResult {
    const warnings: string[] = [];

    // Normalize to std:: prefix for capabilities lookup
    const toKey = toStructure.startsWith('std::') ? toStructure : `std::${toStructure}`;
    const toCaps = DS_CAPABILITIES[toKey];

    if (!toCaps) {
        return { isSafe: false, warnings: [`Unknown target structure: ${toStructure}`] };
    }

    // Check: code uses v[i] but target doesn't support index access
    if (context.usesIndexAccess && !toCaps.supportsIndex) {
        warnings.push(
            `Code uses index access (e.g., v[i]) but ${toKey.replace('std::', '')} does not support random index access. This WILL cause compilation errors.`
        );
    }

    // Check: code requires ordering but target is unordered
    if (context.hasOrdering && !toCaps.supportsOrdering) {
        warnings.push(
            `Code relies on element ordering (sort/lower_bound) but ${toKey.replace('std::', '')} is unordered. Sorted iteration will break.`
        );
    }

    // Check: code does sequential iteration but target has poor cache locality
    if (context.sequentialIteration && !toCaps.fastSequential) {
        warnings.push(
            `Code iterates sequentially but ${toKey.replace('std::', '')} has poor cache locality. Performance may degrade.`
        );
    }

    return {
        isSafe: warnings.length === 0,
        warnings
    };
}
