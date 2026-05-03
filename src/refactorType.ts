/**
 * Refactor Classification System
 * 
 * Determines whether a refactor is safe, adaptive, or requires semantic AI assistance.
 */

import { Context } from './context';

export type RefactorClass = 'safe' | 'adaptive' | 'semantic';

/**
 * Classifies the refactor based on predefined rules and semantic distance.
 * 
 * @param context - The usage context of the data structure
 * @param fromDS - The current data structure
 * @param toDS - The suggested data structure
 * @returns The classification of the refactor
 */
export function classifyRefactor(context: Context, fromDS: string, toDS: string): RefactorClass {
    const fromClean = fromDS.replace('std::', '');
    const toClean = toDS.replace('std::', '');

    // Rule: Semantic
    // vector -> map requires significant API and logic rewrite (e.g., adding keys)
    // any change requiring logic rewrite
    if (
        (fromClean === 'vector' && toClean === 'unordered_map') ||
        (fromClean === 'list' && toClean === 'unordered_map') ||
        (fromClean === 'unordered_set' && toClean === 'vector')
    ) {
        return 'semantic';
    }

    // Rule: Adaptive
    // Similar interfaces but underlying performance characteristics change
    // User needs to be aware, but basic API rewriting works
    if (
        (fromClean === 'list' && toClean === 'vector') ||
        (fromClean === 'vector' && toClean === 'list') ||
        (fromClean === 'vector' && toClean === 'unordered_set') ||
        (fromClean === 'vector' && toClean === 'set') ||
        (fromClean === 'set' && toClean === 'unordered_set')
    ) {
        return 'adaptive';
    }

    // Rule: Safe
    // Drop-in replacements with nearly identical APIs
    if (
        (fromClean === 'vector' && toClean === 'deque') ||
        (fromClean === 'map' && toClean === 'unordered_map')
    ) {
        return 'safe';
    }

    // Default to semantic if we don't have a specific rule, to be safe.
    return 'semantic';
}

/**
 * Determines if the AI engine should be triggered.
 * AI MUST ONLY be triggered for semantic refactoring.
 */
export function shouldUseAI(refactorType: RefactorClass): boolean {
    return refactorType === 'semantic';
}
