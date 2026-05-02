import { ExplanationResult } from './explanation';
import { DS_CAPABILITIES } from './capabilities';

/**
 * Ensures the explanation does not claim properties the suggested structure lacks.
 */
export function validateExplanation(
    suggestion: string,
    explanation: ExplanationResult
): ExplanationResult {
    const dsName = suggestion.replace('std::', '');
    // Standardize to std:: format for lookup
    const lookupKey = suggestion.startsWith('std::') ? suggestion : `std::${suggestion}`;
    const caps = DS_CAPABILITIES[lookupKey];

    if (!caps) return explanation; // Unknown structure

    const filteredSupporting = explanation.supportingReasons.filter(reason => {
        const lowerReason = reason.toLowerCase();
        
        // Semantic checks
        if (lowerReason.includes('index access') && !caps.supportsIndex) {
            return false;
        }
        if (lowerReason.includes('ordering') && !caps.supportsOrdering) {
            return false;
        }
        if (lowerReason.includes('sequential') && !caps.fastSequential) {
            return false;
        }
        
        return true;
    });

    return {
        ...explanation,
        supportingReasons: filteredSupporting
    };
}
