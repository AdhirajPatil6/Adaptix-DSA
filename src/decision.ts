import { Monitor } from './monitor';
import { IntentSignal } from './intent';
import { LearningLayer } from './learning';

export interface DecisionResult {
    suggestedStructure: string | null;
    reason: string | null;
    expectedImprovement: string | null;
    ruleTriggered: string | null;
    currentComplexity: string | null;
    suggestedComplexity: string | null;
    speedup: string | null;
    confidence: number;
    confidenceLabel: 'Strong' | 'Moderate' | 'Low' | 'None';
    whyCurrentBad: string | null;
    whySuggestedBetter: string | null;
    alternativeStructure: string | null;
    alternativeReason: string | null;
}

function getComplexityWeight(ds: string, operation: 'search' | 'insert' | 'delete'): number {
    // Enhanced cost weight map with realistic penalties
    // Base: O(1)=1, O(logN)=5, O(N)=100
    if (ds.includes('vector')) {
        if (operation === 'insert') { return 1; }  // amortized push_back
        if (operation === 'search') { return 100; } // linear scan
        return 100; // erase is O(n) shift
    }
    if (ds.includes('list')) {
        if (operation === 'search') { return 100 * 3; } // O(n) + cache-miss penalty (3x)
        if (operation === 'insert') { return 1; }
        return 1; // O(1) node detach
    }
    if (ds === 'std::map' || ds === 'std::set') { return 5; } // O(log n)
    if (ds === 'std::unordered_map' || ds === 'std::unordered_set') {
        // O(1) amortized, but add collision penalty
        return operation === 'search' ? 1.5 : 1;
    }
    return 10;
}

function getComplexityString(ds: string, operation: 'search' | 'insert' | 'delete'): string {
    const weight = getComplexityWeight(ds, operation);
    if (weight === 1) { return 'O(1)'; }
    if (weight === 5) { return 'O(log n)'; }
    if (weight === 100) { return 'O(n)'; }
    return 'O(n)';
}

function calculateCost(ds: string, monitor: Monitor): number {
    return (monitor.insertCount * getComplexityWeight(ds, 'insert')) +
        (monitor.searchCount * getComplexityWeight(ds, 'search')) +
        (monitor.deleteCount * getComplexityWeight(ds, 'delete'));
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function calculateConfidence(
    monitor: Monitor,
    hasOrdering: boolean,
    dominantRatio: number,
    intentSignal?: IntentSignal
): { confidence: number; confidenceLabel: 'Strong' | 'Moderate' | 'Low' } {
    // Base: how clearly one operation type dominates
    let base = dominantRatio;

    // Volume bonus: more operations = more data = more confident (capped at 0.2)
    const volumeBonus = clamp(monitor.totalOperations / 10, 0, 0.2);

    // Conflicting signals penalty: multiple high ratios = ambiguous pattern
    const highRatios = [monitor.insertRatio, monitor.searchRatio, monitor.deleteRatio]
        .filter(r => r > 0.25).length;
    const conflictPenalty = highRatios >= 3 ? -0.25 : highRatios >= 2 ? -0.1 : 0;

    // Intent alignment bonus (Step 8): if intent agrees, boost confidence
    const intentBonus = (intentSignal && intentSignal.intent !== 'none')
        ? intentSignal.strength * 0.15
        : 0;

    const confidence = clamp(base + volumeBonus + conflictPenalty + intentBonus, 0, 1);

    const confidenceLabel: 'Strong' | 'Moderate' | 'Low' =
        confidence >= 0.8 ? 'Strong' :
        confidence >= 0.5 ? 'Moderate' : 'Low';

    return { confidence, confidenceLabel };
}

function getWhyCurrentBad(ds: string, monitor: Monitor, domOp: 'search' | 'insert' | 'delete'): string {
    const opName = domOp.charAt(0).toUpperCase() + domOp.slice(1);
    const count = domOp === 'search' ? monitor.searchCount :
                  domOp === 'insert' ? monitor.insertCount : monitor.deleteCount;
    const complexity = getComplexityString(ds, domOp);
    return `${ds.replace('std::', '')} ${domOp} is ${complexity} — detected ${count} ${opName.toLowerCase()} operations`;
}

function getWhySuggestedBetter(suggested: string, domOp: 'search' | 'insert' | 'delete'): string {
    const complexity = getComplexityString(suggested, domOp);
    return `${suggested.replace('std::', '')} ${domOp} is ${complexity} — optimized for this workload pattern`;
}

export class DecisionEngine {
    constructor(private learningLayer?: LearningLayer) {}

    public determineBestStructure(
        monitor: Monitor,
        hasOrdering: boolean = false,
        intentSignal?: IntentSignal
    ): DecisionResult {
        const { currentStructure, searchRatio, insertRatio, deleteRatio, totalOperations } = monitor;

        const emptyResult: DecisionResult = {
            suggestedStructure: null, reason: null, expectedImprovement: null,
            ruleTriggered: null, currentComplexity: null, suggestedComplexity: null, speedup: null,
            confidence: 0, confidenceLabel: 'None', whyCurrentBad: null, whySuggestedBetter: null,
            alternativeStructure: null, alternativeReason: null
        };

        if (totalOperations < 1) { return emptyResult; }

        let suggestion: string | null = null;
        let reason = '';
        let ruleTriggered = '';
        let domOp: 'search' | 'insert' | 'delete' = 'insert';
        let alternativeStructure: string | null = null;
        let alternativeReason: string | null = null;

        if (searchRatio > 0.6) {
            domOp = 'search';
            if (hasOrdering) {
                suggestion = 'std::map';
                reason = 'Frequent searches with required ordering. Map preserves sort order.';
                ruleTriggered = 'search_ratio > 0.6 AND has_ordering';
            } else {
                suggestion = currentStructure.includes('set') ? 'std::unordered_set' : 'std::unordered_map';
                reason = `High search volume. Unordered structures provide O(1) lookup.`;
                ruleTriggered = 'search_ratio > 0.6 AND NOT has_ordering';
            }
        } else if (insertRatio > 0.6 && !hasOrdering) {
            domOp = 'insert';
            suggestion = 'std::vector';
            reason = `High insertion rate at back. Vectors offer cache locality and O(1) amortized inserts.`;
            ruleTriggered = 'insert_ratio > 0.6 AND NOT has_ordering';
        } else if (deleteRatio > 0.3 && insertRatio > 0.3 && !hasOrdering) {
            domOp = 'delete';
            suggestion = 'std::list';
            reason = 'Mixed inserts and removals detected. List allows O(1) node detachment.';
            ruleTriggered = 'delete_ratio > 0.3 AND insert_ratio > 0.3';
        } else if (hasOrdering) {
            domOp = 'search';
            suggestion = currentStructure.includes('map') ? 'std::map' : 'std::set';
            reason = 'Ordering detected, balances tree structure needed.';
            ruleTriggered = 'has_ordering === true';
        }

        // Intent-based tiebreaker (Step 8): if no ratio-based rule triggered,
        // but intent detection found a clear pattern, use it
        if (!suggestion && intentSignal && intentSignal.intent !== 'none' && intentSignal.suggestedDS) {
            if (intentSignal.suggestedDS !== currentStructure && intentSignal.strength >= 0.5) {
                suggestion = intentSignal.suggestedDS;
                reason = intentSignal.description;
                ruleTriggered = `intent_detection: ${intentSignal.intent}`;
                domOp = 'search'; // Intent patterns are generally access-oriented
            }
        }

        if (suggestion && suggestion !== currentStructure) {
            const currentCost = calculateCost(currentStructure, monitor);
            const suggestedCost = calculateCost(suggestion, monitor);

            // Allow override if suggested is mathematically strictly faster based on weights
            if (currentCost > suggestedCost) {
                const speedupRatio = currentCost / Math.max(suggestedCost, 1);
                const dominantRatio = Math.max(searchRatio, insertRatio, deleteRatio);
                let { confidence, confidenceLabel } = calculateConfidence(
                    monitor, hasOrdering, dominantRatio, intentSignal
                );

                // Step 13: Learning Layer confidence boost
                if (this.learningLayer && suggestion) {
                    const boost = this.learningLayer.getConfidenceBoost(currentStructure, suggestion);
                    if (boost > 0) {
                        confidence = clamp(confidence + boost, 0, 1);
                        confidenceLabel = confidence >= 0.8 ? 'Strong' : confidence >= 0.5 ? 'Moderate' : 'Low';
                    }
                }

                // Step 9: Selective deep validation — extra checks when confidence is low
                if (confidence < 0.5) {
                    // Additional heuristic: if total ops is very low, lower confidence further
                    if (totalOperations < 3) {
                        confidence = clamp(confidence - 0.15, 0, 1);
                    }
                    confidenceLabel = confidence >= 0.5 ? 'Moderate' : 'Low';
                }

                // Intent enrichment: append intent description to reason if present
                let enrichedReason = reason;
                if (intentSignal && intentSignal.intent !== 'none') {
                    enrichedReason += ` | Pattern: ${intentSignal.description}`;
                }

                // Step 12: Determine alternative suggestion
                if (suggestion === 'std::unordered_map') {
                    alternativeStructure = 'std::map';
                    alternativeReason = 'If ordering might be needed later (trades O(1) for O(log n) lookups)';
                } else if (suggestion === 'std::unordered_set') {
                    alternativeStructure = 'std::set';
                    alternativeReason = 'If ordering might be needed later (trades O(1) for O(log n) lookups)';
                } else if (suggestion === 'std::vector') {
                    alternativeStructure = 'std::deque';
                    alternativeReason = 'If you anticipate needing efficient push_front() operations later';
                }

                return {
                    suggestedStructure: suggestion,
                    reason: enrichedReason,
                    ruleTriggered,
                    currentComplexity: getComplexityString(currentStructure, domOp),
                    suggestedComplexity: getComplexityString(suggestion, domOp),
                    speedup: speedupRatio > 1.1 ? `${speedupRatio.toFixed(1)}x faster` : 'Marginal gain',
                    expectedImprovement: `${getComplexityString(currentStructure, domOp)} → ${getComplexityString(suggestion, domOp)}`,
                    confidence,
                    confidenceLabel,
                    whyCurrentBad: getWhyCurrentBad(currentStructure, monitor, domOp),
                    whySuggestedBetter: getWhySuggestedBetter(suggestion, domOp),
                    alternativeStructure,
                    alternativeReason
                };
            }
        }

        return emptyResult;
    }
}
