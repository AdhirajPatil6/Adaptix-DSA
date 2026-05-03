/**
 * Refactor Planner
 * 
 * Generates a complete, previewable edit plan for refactoring a data structure.
 * Instead of applying changes immediately, this produces a plan that can be
 * reviewed, validated, and then applied atomically.
 * 
 * The planner handles:
 * 1. Declaration type replacement
 * 2. API call compatibility warnings (e.g., push_back on a set)
 * 3. Safety validation via refactorSafety
 */

import * as vscode from 'vscode';
import { Context } from './context';
import { validateRefactorSafety, SafetyResult } from './refactorSafety';

export interface RefactorEdit {
    range: vscode.Range;
    newText: string;
    description: string;
}

export interface RefactorPlan {
    safety: SafetyResult;
    edits: RefactorEdit[];
    warnings: string[];
    summary: string;
}

/** API methods that are specific to certain data structures */
const DS_SPECIFIC_APIS: Record<string, string[]> = {
    'std::vector': ['push_back', 'pop_back', 'emplace_back', 'at', 'operator[]', 'reserve', 'capacity', 'shrink_to_fit'],
    'std::list': ['push_back', 'push_front', 'pop_back', 'pop_front', 'emplace_back', 'emplace_front', 'splice', 'merge', 'unique'],
    'std::map': ['operator[]', 'at', 'lower_bound', 'upper_bound', 'equal_range'],
    'std::unordered_map': ['operator[]', 'at', 'bucket_count', 'load_factor', 'rehash', 'reserve'],
    'std::set': ['lower_bound', 'upper_bound', 'equal_range'],
    'std::unordered_set': ['bucket_count', 'load_factor', 'rehash', 'reserve'],
    'std::deque': ['push_back', 'push_front', 'pop_back', 'pop_front', 'emplace_back', 'emplace_front', 'at', 'operator[]'],
};

/** Safe 1-to-1 API method rewrites based on target structure */
const API_REWRITES: Record<string, Record<string, string>> = {
    'std::set': { 'push_back': 'insert', 'push_front': 'insert', 'emplace_back': 'emplace' },
    'std::unordered_set': { 'push_back': 'insert', 'push_front': 'insert', 'emplace_back': 'emplace' },
    // map rewrites are unsafe due to missing key/value pairs
};

/**
 * Generates a complete refactor plan without applying any changes.
 * 
 * @param document - The text document being refactored
 * @param varName - The variable name being refactored
 * @param fromStructure - Current data structure (e.g., "std::vector")
 * @param toStructure - Target data structure (e.g., "std::unordered_map")
 * @param context - The analysis context with usage flags
 * @returns A RefactorPlan with all edits, safety result, and warnings
 */
export function planRefactor(
    document: vscode.TextDocument,
    varName: string,
    fromStructure: string,
    toStructure: string,
    context: Context
): RefactorPlan {
    const edits: RefactorEdit[] = [];
    const warnings: string[] = [];
    const text = document.getText();

    // Step 1: Safety validation
    const safety = validateRefactorSafety(context, fromStructure, toStructure);
    warnings.push(...safety.warnings);

    // Step 2: Find and create declaration edit
    const fromClean = fromStructure.replace('std::', '');
    const toClean = toStructure.replace('std::', '');
    
    // Match the declaration: std::vector<int> varName; or vector<int> varName;
    const declRegex = new RegExp(
        `((?:std::)?(?:${escapeRegex(fromClean)}))\\s*(<[^>]+>)\\s+(${escapeRegex(varName)})\\s*([;=(])`,
        'g'
    );

    let match;
    while ((match = declRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const currentTypeStr = match[1];
        const templateArgs = match[2];
        const name = match[3];
        const terminator = match[4];

        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + fullMatch.length);
        const range = new vscode.Range(startPos, endPos);

        // Replace only the type, preserve template args, variable name, and terminator
        const newText = `${toClean}${templateArgs} ${name}${terminator}`;

        edits.push({
            range,
            newText,
            description: `Replace declaration type: ${currentTypeStr} → ${toClean}`
        });
    }

    if (edits.length === 0) {
        warnings.push(`Could not find declaration of '${varName}' with type '${fromClean}' in the document.`);
    }

    // Step 3: Detect incompatible API calls (warn but don't auto-rewrite)
    const fromKey = fromStructure.startsWith('std::') ? fromStructure : `std::${fromStructure}`;
    const toKey = toStructure.startsWith('std::') ? toStructure : `std::${toStructure}`;
    
    const fromAPIs = DS_SPECIFIC_APIS[fromKey] ?? [];
    const toAPIs = DS_SPECIFIC_APIS[toKey] ?? [];
    
    // Find APIs used by the variable that the target structure doesn't support
    const incompatibleAPIs: string[] = [];
    const rewritesForTarget = API_REWRITES[toKey] ?? {};

    for (const api of fromAPIs) {
        if (!toAPIs.includes(api)) {
            // Check if this API is actually used in the code
            const apiRegex = new RegExp(`\\b${escapeRegex(varName)}\\.${escapeRegex(api)}\\b`, 'g');
            let apiMatch;
            let used = false;
            
            while ((apiMatch = apiRegex.exec(text)) !== null) {
                used = true;
                const rewriteTo = rewritesForTarget[api];
                
                if (rewriteTo) {
                    // Safe to auto-rewrite!
                    const startPos = document.positionAt(apiMatch.index);
                    const endPos = document.positionAt(apiMatch.index + apiMatch[0].length);
                    
                    edits.push({
                        range: new vscode.Range(startPos, endPos),
                        newText: `${varName}.${rewriteTo}`,
                        description: `Rewrite API call: ${api}() → ${rewriteTo}()`
                    });
                }
            }

            if (used && !rewritesForTarget[api]) {
                incompatibleAPIs.push(api);
            }
        }
    }

    if (incompatibleAPIs.length > 0) {
        warnings.push(
            `The following API calls on '${varName}' could not be safely rewritten for ${toClean}: ${incompatibleAPIs.join(', ')}. You will need to update these manually.`
        );
    }

    // Build summary
    const summary = edits.length > 0
        ? `Refactor ${varName}: ${fromClean} → ${toClean} (${edits.length} edit${edits.length > 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''})`
        : `No edits generated for ${varName}`;

    return {
        safety,
        edits,
        warnings,
        summary
    };
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
