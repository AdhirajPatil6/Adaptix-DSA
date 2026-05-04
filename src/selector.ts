import { Constraints } from './constraints';
import { DS_CAPABILITIES } from './capabilities';

export interface SelectionResult {
    valid: string[];
    rejected: { name: string; reasons: string[] }[];
    conflictWarning: string | null;
}

/**
 * Filters the list of possible data structures based on hard constraints.
 */
export function evaluateStructures(constraints: Constraints): SelectionResult {
    const valid: string[] = [];
    const rejected: { name: string; reasons: string[] }[] = [];
    let conflictWarning: string | null = null;

    // Detect conflicting constraints (Step 9)
    if (constraints.needsIndexAccess && !constraints.needsOrdering && constraints.prefersSequential === false) {
        // Technically possible, but index access usually implies sequential or ordered logic
        // This is a mild conflict
    }

    // Step 9: Conflict Detection
    // For instance, needing random index access BUT doing heavy arbitrary inserts/deletes
    // We don't have monitor here yet, but we will catch semantic conflicts
    
    for (const [dsName, capabilities] of Object.entries(DS_CAPABILITIES)) {
        const reasons: string[] = [];

        if (constraints.needsIndexAccess && !capabilities.supportsIndex) {
            reasons.push('Requires random index access (e.g., v[i]), which this structure lacks.');
        }

        if (constraints.needsOrdering && !capabilities.supportsOrdering) {
            reasons.push('Requires element ordering (e.g., sort(), lower_bound()), but this structure is unordered.');
        }

        const nonPositionalStructures = ['std::priority_queue', 'Segment Tree', 'Skip List', 'Trie'];
        if (constraints.needsSequenceEfficiency && (!capabilities.isSequence || nonPositionalStructures.includes(dsName))) {
            reasons.push('Usage implies a sequence where position or front/back efficiency is key (e.g., erase(begin)), but this structure does not support positional efficiency.');
        }

        if (reasons.length > 0) {
            rejected.push({ name: dsName, reasons });
        } else {
            valid.push(dsName);
        }
    }

    if (valid.length === 0) {
        conflictWarning = "Mixed usage detected — no single structure natively supports all requirements. Consider refactoring usage pattern.";
    }

    return { valid, rejected, conflictWarning };
}
