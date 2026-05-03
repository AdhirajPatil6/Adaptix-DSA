/**
 * Intent Detection Module (Step 8)
 * 
 * Detects high-level usage patterns that reveal developer intent,
 * beyond simple operation counting. These patterns influence the
 * decision engine as tiebreakers and confidence boosters.
 */

export type IntentType =
    | 'frequency_counting'    // mp[key]++ pattern
    | 'sequential_access'     // dominant range-for/iterator loops
    | 'lookup_heavy'          // repeated find() calls
    | 'sorted_iteration'      // sort() + iteration combo
    | 'accumulator'           // summing/reducing over container
    | 'none';

export interface IntentSignal {
    intent: IntentType;
    strength: number;  // 0.0 – 1.0 (how confident we are in this intent)
    description: string;
    suggestedDS: string | null;  // Hint for the decision engine
}

/**
 * Analyze lines of code for a specific variable to detect intent patterns.
 * All detection is regex-based — no AST parsing, stays under 1ms.
 */
export function detectIntent(
    varName: string,
    lines: string[],
    currentStructure: string
): IntentSignal {
    let frequencyCount = 0;
    let findCount = 0;
    let iterationCount = 0;
    let sortDetected = false;
    let accumulatorCount = 0;

    // Pre-compile regexes for this variable (escape varName for safety)
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const freqCountRegex = new RegExp(`${escaped}\\[.*\\]\\s*(\\+\\+|--|\\+=|\\-=)`, 'g');
    const findRegex = new RegExp(`${escaped}\\.(find|count)\\b`, 'g');
    const algoFindRegex = new RegExp(`(?:std::)?(?:find|count)\\(\\s*${escaped}\\.begin`, 'g');
    const rangeForRegex = new RegExp(`for\\s*\\(.*:\\s*${escaped}\\s*\\)`, 'g');
    const iterForRegex = new RegExp(`for\\s*\\(.*${escaped}\\.begin\\s*\\(`, 'g');
    const sortRegex = new RegExp(`(?:std::)?sort\\(\\s*${escaped}\\.begin`, 'g');
    const accumRegex = new RegExp(`\\+=\\s*${escaped}\\[|\\+=\\s*\\*?\\s*it`, 'g');

    for (const line of lines) {
        // Frequency counting: mp[key]++ / mp[key] += 1
        if (freqCountRegex.test(line)) { frequencyCount++; }
        freqCountRegex.lastIndex = 0;

        // Find/count operations
        let m;
        while ((m = findRegex.exec(line)) !== null) { findCount++; }
        findRegex.lastIndex = 0;
        while ((m = algoFindRegex.exec(line)) !== null) { findCount++; }
        algoFindRegex.lastIndex = 0;

        // Iteration detection
        if (rangeForRegex.test(line)) { iterationCount++; }
        rangeForRegex.lastIndex = 0;
        if (iterForRegex.test(line)) { iterationCount++; }
        iterForRegex.lastIndex = 0;

        // Sort detection
        if (sortRegex.test(line)) { sortDetected = true; }
        sortRegex.lastIndex = 0;

        // Accumulator pattern
        if (accumRegex.test(line)) { accumulatorCount++; }
        accumRegex.lastIndex = 0;
    }

    // Determine dominant intent
    if (frequencyCount >= 2) {
        return {
            intent: 'frequency_counting',
            strength: Math.min(frequencyCount / 5, 1.0),
            description: `Frequency counting pattern detected (${frequencyCount} occurrences of ${varName}[key]++ style)`,
            suggestedDS: 'std::unordered_map'
        };
    }

    if (sortDetected && iterationCount > 0) {
        return {
            intent: 'sorted_iteration',
            strength: 0.8,
            description: `Sort + iteration pattern: data is sorted then iterated sequentially`,
            suggestedDS: currentStructure.includes('map') ? 'std::map' : 'std::set'
        };
    }

    if (findCount >= 3) {
        return {
            intent: 'lookup_heavy',
            strength: Math.min(findCount / 6, 1.0),
            description: `Lookup-heavy pattern detected (${findCount} find/count calls on ${varName})`,
            suggestedDS: currentStructure.includes('map') ? 'std::unordered_map' : 'std::unordered_set'
        };
    }

    if (iterationCount >= 2) {
        return {
            intent: 'sequential_access',
            strength: Math.min(iterationCount / 4, 1.0),
            description: `Sequential access pattern: container is iterated ${iterationCount} times`,
            suggestedDS: 'std::vector'
        };
    }

    if (accumulatorCount >= 1) {
        return {
            intent: 'accumulator',
            strength: 0.5,
            description: `Accumulator/reduction pattern detected over ${varName}`,
            suggestedDS: 'std::vector'
        };
    }

    return {
        intent: 'none',
        strength: 0,
        description: 'No clear usage pattern detected',
        suggestedDS: null
    };
}
