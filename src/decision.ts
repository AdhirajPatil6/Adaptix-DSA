import { Monitor } from './monitor';
import { IntentSignal } from './intent';
import { LearningLayer } from './learning';
import { Constraints } from './constraints';
import { evaluateStructures } from './selector';
import { simulateChange, SimulationResult } from './simulation';
import { generateExplanation, ExplanationResult } from './explanation';
import { validateExplanation } from './validation';
import { checkConsistency } from './consistency';
import { generateInsight } from './insight';
import { logDebug } from './logger';
import { PatternMatch } from './patternDetector';

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
    
    // New Advanced Features
    explanation?: ExplanationResult;
    simulation?: SimulationResult;
    conflictWarning?: string | null;
    impactLevel: 'high' | 'medium' | 'low';
    insight: string | null;
    alternativeDetails?: { name: string; traits: string[] };
}

export function getComplexityWeight(ds: string, operation: 'search' | 'insert' | 'delete'): number {
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

export function getComplexityString(ds: string, operation: 'search' | 'insert' | 'delete'): string {
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
    validOptions: string[],
    dominantRatio: number,
    intentSignal?: IntentSignal
): { confidence: number; confidenceLabel: 'Strong' | 'Moderate' | 'Low' } {
    // Base: how clearly one operation type dominates
    let base = dominantRatio;

    // Volume bonus: more operations = more data = more confident (capped at 0.2)
    const volumeBonus = clamp(monitor.totalOperations / 10, 0, 0.2);

    // Conflict penalty (Step 9 handled via constraints/selector)
    const highRatios = [monitor.insertRatio, monitor.searchRatio, monitor.deleteRatio]
        .filter(r => r > 0.25).length;
    let conflictPenalty = highRatios >= 3 ? -0.25 : highRatios >= 2 ? -0.1 : 0;

    // If there are many valid options left, we might be less confident
    if (validOptions.length > 3) {
        conflictPenalty -= 0.1;
    }

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
        constraints: Constraints,
        intentSignal?: IntentSignal | null,
        patternMatch?: PatternMatch | null
    ): DecisionResult {
        const { currentStructure, searchRatio, insertRatio, deleteRatio, totalOperations } = monitor;

        const emptyResult: DecisionResult = {
            suggestedStructure: null, reason: null, expectedImprovement: null,
            ruleTriggered: null, currentComplexity: null, suggestedComplexity: null, speedup: null,
            confidence: 0, confidenceLabel: 'None', whyCurrentBad: null, whySuggestedBetter: null,
            alternativeStructure: null, alternativeReason: null,
            conflictWarning: null, impactLevel: 'low', insight: null
        };

        if (totalOperations < 1) { return emptyResult; }

        // STEP 4: Integrate new constraint-based filtering
        const { valid, rejected, conflictWarning } = evaluateStructures(constraints);
        
        emptyResult.conflictWarning = conflictWarning;

        // If no valid structures remain, return early with conflict warning
        if (valid.length === 0) {
            return emptyResult;
        }

        // Run cost model ONLY on valid structures
        let bestCandidate: string | null = null;
        let lowestCost = Infinity;
        let forcedRule: string | null = null;

        // STEP 2.5: Advanced Pattern Override
        if (patternMatch) {
            if (patternMatch.isSegmentTreeCandidate && valid.includes('Segment Tree')) {
                bestCandidate = 'Segment Tree';
                forcedRule = patternMatch.detectedPatternLabel;
            } else if (patternMatch.isTrieCandidate && valid.includes('Trie')) {
                bestCandidate = 'Trie';
                forcedRule = patternMatch.detectedPatternLabel;
            } else if (patternMatch.isPriorityQueueCandidate && valid.includes('std::priority_queue')) {
                bestCandidate = 'std::priority_queue';
                forcedRule = patternMatch.detectedPatternLabel;
            } else if (patternMatch.isBalancedTreeCandidate && valid.includes('std::map')) {
                bestCandidate = 'std::map';
                forcedRule = patternMatch.detectedPatternLabel;
            }
        }

        // Current cost
        const currentCost = calculateCost(currentStructure, monitor);
        // Determine truly dominant operation by comparing all three ratios
        const ratios: [('search' | 'insert' | 'delete'), number][] = [
            ['search', searchRatio], ['insert', insertRatio], ['delete', deleteRatio]
        ];
        const domOp = ratios.reduce((a, b) => b[1] > a[1] ? b : a)[0];

        // Apply intent tiebreaker to prioritize specific valid options
        let preferredFromIntent: string | null = null;
        if (intentSignal && intentSignal.intent !== 'none' && intentSignal.suggestedDS && valid.includes(intentSignal.suggestedDS)) {
            preferredFromIntent = intentSignal.suggestedDS;
        }

        if (!bestCandidate) {
            for (const ds of valid) {
                let cost = calculateCost(ds, monitor);
                // Give a slight bonus (cost reduction) to the preferred intent structure
                if (ds === preferredFromIntent) {
                    cost *= 0.8; 
                }
                if (cost < lowestCost && ds !== currentStructure) {
                    lowestCost = cost;
                    bestCandidate = ds;
                }
            }
        }

        let suggestion = bestCandidate;
        let rule = forcedRule;

        // Fallback: rule-based legacy override if cost model is ambiguous
        if (!suggestion) {
           if (searchRatio > 0.6 && valid.includes('std::unordered_map') && currentStructure.includes('map')) {
               suggestion = 'std::unordered_map';
           } else if (insertRatio > 0.6 && valid.includes('std::vector') && !currentStructure.includes('vector')) {
               suggestion = 'std::vector';
           } else if (deleteRatio > 0.3 && insertRatio > 0.3 && valid.includes('std::list') && !currentStructure.includes('list')) {
               suggestion = 'std::list';
           }
        }

        if (suggestion && suggestion !== currentStructure) {
            const suggestedCost = calculateCost(suggestion, monitor);

            if (currentCost > suggestedCost || suggestion === preferredFromIntent) {
                const speedupRatio = currentCost / Math.max(suggestedCost, 1);
                const dominantRatio = Math.max(searchRatio, insertRatio, deleteRatio);
                let { confidence, confidenceLabel } = calculateConfidence(
                    monitor, valid, dominantRatio, intentSignal || undefined
                );

                if (this.learningLayer && suggestion) {
                    const boost = this.learningLayer.getConfidenceBoost(currentStructure, suggestion);
                    if (boost > 0) {
                        confidence = clamp(confidence + boost, 0, 1);
                        confidenceLabel = confidence >= 0.8 ? 'Strong' : confidence >= 0.5 ? 'Moderate' : 'Low';
                    }
                }

                if (confidence < 0.5) {
                    if (totalOperations < 3) {
                        confidence = clamp(confidence - 0.15, 0, 1);
                    }
                    confidenceLabel = confidence >= 0.5 ? 'Moderate' : 'Low';
                }

                let explanation = generateExplanation(suggestion, rejected, monitor, constraints);
                const simulation = simulateChange(currentStructure, suggestion, monitor);
                
                // Step 2 & 5: Semantic Accuracy and Consistency Check
                explanation = validateExplanation(suggestion, explanation);
                const consistency = checkConsistency(suggestion, explanation);
                if (!consistency.isValid) {
                    confidence = clamp(confidence - consistency.confidencePenalty, 0, 1);
                    confidenceLabel = confidence >= 0.5 ? 'Moderate' : 'Low';
                }

                // Step 4: Developer Insight Engine
                const insight = generateInsight(monitor, constraints, currentStructure);

                // Step 3: Impact Level
                let impactLevel: 'high' | 'medium' | 'low' = 'low';
                if (simulation.speedGain > 3.0 || dominantRatio > 0.8) {
                    impactLevel = 'high';
                } else if (simulation.speedGain > 1.5 || dominantRatio > 0.5) {
                    impactLevel = 'medium';
                }

                let alternativeStructure: string | null = null;
                let alternativeReason: string | null = null;
                let alternativeDetails: { name: string; traits: string[] } | undefined = undefined;
                
                // Get the second best valid structure
                const remainingValid = valid.filter(v => v !== suggestion && v !== currentStructure);
                if (remainingValid.length > 0) {
                    let secondBest = remainingValid[0];
                    let secondLowestCost = Infinity;
                    for(const v of remainingValid) {
                        const cost = calculateCost(v, monitor);
                        if (cost < secondLowestCost) {
                            secondLowestCost = cost;
                            secondBest = v;
                        }
                    }
                    if (secondBest) {
                        alternativeStructure = secondBest;
                        alternativeReason = 'Second best option based on capability constraints.';
                        
                        // Step 7: Alternative Comparison Upgrade
                        const altSim = simulateChange(currentStructure, secondBest, monitor);
                        const traits: string[] = [];
                        if (altSim.speedGain < simulation.speedGain) traits.push('Slightly slower');
                        if (altSim.memoryImpact === 'Lower' || (altSim.memoryImpact === 'Similar' && simulation.memoryImpact === 'Higher')) traits.push('Better memory footprint');
                        if (secondBest.includes('map') || secondBest.includes('set') && !secondBest.includes('unordered')) traits.push('Maintains native ordering');
                        if (traits.length === 0) traits.push('Alternative fallback option');

                        alternativeDetails = {
                            name: secondBest,
                            traits
                        };
                    }
                }

                logDebug('Decision', `${currentStructure} → ${suggestion}`, {
                    domOp,
                    confidence: confidence.toFixed(2),
                    confidenceLabel,
                    impactLevel,
                    speedup: simulation.speedGain.toFixed(1)
                });

                return {
                    suggestedStructure: suggestion,
                    reason: explanation.primaryReason,
                    ruleTriggered: 'constraint_based_model',
                    currentComplexity: getComplexityString(currentStructure, domOp),
                    suggestedComplexity: getComplexityString(suggestion, domOp),
                    speedup: simulation.speedGain > 1.1 ? `${simulation.speedGain.toFixed(1)}x faster` : 'Marginal gain',
                    expectedImprovement: `${getComplexityString(currentStructure, domOp)} → ${getComplexityString(suggestion, domOp)}`,
                    confidence,
                    confidenceLabel,
                    whyCurrentBad: getWhyCurrentBad(currentStructure, monitor, domOp),
                    whySuggestedBetter: getWhySuggestedBetter(suggestion, domOp),
                    alternativeStructure,
                    alternativeReason,
                    explanation,
                    simulation,
                    conflictWarning,
                    impactLevel,
                    insight,
                    alternativeDetails
                };
            }
        }

        return emptyResult;
    }
}
