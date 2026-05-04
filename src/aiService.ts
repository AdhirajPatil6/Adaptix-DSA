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
    const prompt = `Transform the given C++ code into using ${input.targetDS}.

Rules:
- Preserve original logic
- Replace all operations accordingly
- Use correct STL or standard implementation
- If transformation requires redesign (like structs), explain clearly
- Do not break behavior
- Output STRICT JSON matching this schema:
{
  "new_code": "string",
  "changes": ["string"],
  "warnings": ["string"]
}

Original Data Structure: ${input.currentDS}

Code:
\`\`\`cpp
${input.code}
\`\`\`
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
