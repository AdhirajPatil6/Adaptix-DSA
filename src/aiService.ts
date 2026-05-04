/**
 * AI Service for Semantic Refactoring
 * 
 * Interfaces with Qwen3 Coder to generate semantic code transformations.
 * STRICT RULE: AI only generates code; it NEVER decides data structures or validates safety.
 */

import { Context } from './context';
import { logDebug, logWarn } from './logger';

export interface SemanticRefactorInput {
    code: string;
    context: Context;
    currentDS: string;
    targetDS: string;
}

export interface SemanticRefactorResult {
    new_code: string;
    changes: string[];
    warnings: string[];
}

/**
 * Triggers the AI to generate a semantic refactoring.
 * Designed to connect to a local Qwen3 Coder instance via Ollama.
 */
export async function generateSemanticRefactor(input: SemanticRefactorInput): Promise<SemanticRefactorResult | null> {
    // Build target-specific guidance to prevent AI hallucination
    let dsGuidance = '';
    const target = input.targetDS;
    if (target === 'std::unordered_set' || target === 'std::unordered_map') {
        dsGuidance = `Use std::${target.replace('std::', '')} from <${target.replace('std::', '')}>.
Replace linear search (std::find, for-loop search) with .find() method.
Replace push_back/insert with .insert(). This is a SIMPLE container swap — do NOT create custom structs.`;
    } else if (target === 'std::set' || target === 'std::map') {
        dsGuidance = `Use std::${target.replace('std::', '')} from <${target.replace('std::', '')}>.
Replace linear search with .find()/.count(). Replace push_back with .insert(). SIMPLE container swap.`;
    } else if (target === 'std::deque') {
        dsGuidance = `Use std::deque from <deque>. This is a near drop-in replacement for std::vector.
Replace <vector> with <deque>. Keep all method calls identical (push_back, [], .begin(), .end() all work).`;
    } else if (target === 'std::priority_queue') {
        dsGuidance = `Use std::priority_queue from <queue>.
Replace sort+back/front access patterns with .push() and .top()/.pop().`;
    } else if (target === 'Trie') {
        dsGuidance = `Implement a lightweight TrieNode struct with children[26] and bool isEnd.
Only create the Trie if the original code does repeated string prefix matching.`;
    } else if (target === 'Segment Tree') {
        dsGuidance = `Only use a Segment Tree if the original code does RANGE SUM/MIN/MAX QUERIES with point updates.
Do NOT use a Segment Tree for simple value lookups — that is slower than linear search.
If the code only does find/search, use std::unordered_set instead.`;
    } else if (target === 'Skip List') {
        dsGuidance = `Implement a lightweight skip list with probabilistic levels for O(log n) search on linked data.`;
    }

    const prompt = `You are a C++ performance engineer. Refactor the code to use ${input.targetDS}.

CRITICAL PERFORMANCE RULES:
1. The refactored code MUST be FASTER than the original. If it would be slower, keep the original.
2. Use STL containers (e.g., std::unordered_set) whenever possible. Do NOT over-engineer custom structs.
3. Do NOT build heavy data structures (trees, graphs) for simple lookups — use hash-based O(1) containers.
4. Preserve the EXACT same function signatures, input/output behavior, and logic flow.
5. Only add new #include headers as needed. Keep the code minimal and clean.

TARGET DATA STRUCTURE GUIDANCE:
${dsGuidance}

Original Data Structure: ${input.currentDS}

Code:
\`\`\`cpp
${input.code}
\`\`\`

Output STRICT JSON matching this schema:
{
  "new_code": "string (the complete refactored file)",
  "changes": ["string (list each specific change made)"],
  "warnings": ["string (any performance caveats)"]
}
`;

    logDebug('AIService', 'Requesting semantic refactor from Qwen3 Coder', { targetDS: input.targetDS });

    try {
        // Assume Ollama local endpoint for Qwen3 Coder
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-oss:120b-cloud', // Standard ollama qwen coder model name
                prompt: prompt,
                stream: false,
                format: 'json'
            })
        });

        if (!response.ok) {
            throw new Error(`AI API returned status ${response.status}`);
        }

        const data = await response.json() as { response: string };

        // Strip markdown backticks if the AI wrapped the response
        let cleanJson = data.response.trim();
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.substring(7);
        } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.substring(3);
        }
        if (cleanJson.endsWith('```')) {
            cleanJson = cleanJson.substring(0, cleanJson.length - 3);
        }
        cleanJson = cleanJson.trim();

        const parsed = JSON.parse(cleanJson) as SemanticRefactorResult;

        logDebug('AIService', 'Received semantic refactor from AI', { changes: parsed.changes.length });

        return {
            new_code: parsed.new_code || input.code,
            changes: parsed.changes || [],
            warnings: parsed.warnings || []
        };
    } catch (error) {
        logWarn('AIService', `Failed to generate semantic refactor: ${error}`);
        // Step 8: Error Handling - Return null to trigger fallback
        return null;
    }
}
