import { Monitor } from './monitor';
import { Constraints } from './constraints';

export interface ExplanationResult {
    primaryReason: string;
    supportingReasons: string[];
    tradeoffs: string[];
    rejectedReasons: string[];
}

export function generateExplanation(
    suggestion: string,
    rejected: { name: string; reasons: string[] }[],
    monitor: Monitor,
    constraints: Constraints
): ExplanationResult {
    const primaryReason = `Optimal for ${monitor.searchRatio > 0.6 ? 'search-heavy' : (monitor.insertRatio > 0.6 ? 'insert-heavy' : 'mixed')} workloads with ${monitor.totalOperations} operations.`;
    
    const supportingReasons: string[] = [];
    if (monitor.searchRatio > 0.6) supportingReasons.push(`${(monitor.searchRatio * 100).toFixed(0)}% search operations → ${suggestion.replace('std::', '')} provides fast O(${suggestion.includes('unordered') ? '1' : 'log N'}) lookups.`);
    if (monitor.insertRatio > 0.6) supportingReasons.push(`${(monitor.insertRatio * 100).toFixed(0)}% insert operations → avoids expensive O(N) memory shifting.`);
    if (monitor.deleteRatio > 0.3) supportingReasons.push(`${(monitor.deleteRatio * 100).toFixed(0)}% delete operations → allows efficient node detachment.`);
    
    if (constraints.needsOrdering) supportingReasons.push(`Preserves required element ordering natively.`);
    if (constraints.needsIndexAccess) supportingReasons.push(`Supports O(1) random index access required by your code.`);
    if (constraints.prefersSequential) supportingReasons.push(`Offers excellent cache locality for the sequential iteration patterns detected.`);

    const tradeoffs: string[] = [];
    if (suggestion.includes('vector') || suggestion.includes('deque')) tradeoffs.push(`O(N) search complexity.`);
    if (suggestion.includes('unordered')) tradeoffs.push(`Higher memory overhead due to hash table.`);
    if (suggestion.includes('list') || suggestion.includes('map') || suggestion.includes('set')) tradeoffs.push(`Poor cache locality.`);

    const rejectedReasons: string[] = rejected.map(r => 
        `**${r.name.replace('std::', '')}**: ${r.reasons.join(' ')}`
    );

    return {
        primaryReason,
        supportingReasons,
        tradeoffs,
        rejectedReasons
    };
}
