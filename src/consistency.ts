import { ExplanationResult } from './explanation';
import { DS_CAPABILITIES } from './capabilities';

export interface ConsistencyResult {
    isValid: boolean;
    confidencePenalty: number;
}

/**
 * Checks if the primary suggestion is actually compatible with the capabilities
 * and explanation logic. If it violates its own capabilities, penalize it heavily.
 */
export function checkConsistency(
    suggestion: string,
    explanation: ExplanationResult
): ConsistencyResult {
    const lookupKey = suggestion.startsWith('std::') ? suggestion : `std::${suggestion}`;
    const caps = DS_CAPABILITIES[lookupKey];

    if (!caps) return { isValid: true, confidencePenalty: 0 };

    let penalty = 0;
    
    // For example, if we suggest a list but the explanation claims O(1) random access
    const claimsIndex = explanation.supportingReasons.some(r => r.toLowerCase().includes('index access'));
    if (claimsIndex && !caps.supportsIndex) {
        penalty += 0.5; // Massive penalty for logical contradiction
    }

    const claimsOrdering = explanation.supportingReasons.some(r => r.toLowerCase().includes('ordering'));
    if (claimsOrdering && !caps.supportsOrdering) {
        penalty += 0.5;
    }

    return {
        isValid: penalty < 0.5,
        confidencePenalty: penalty
    };
}
