import * as vscode from 'vscode';

/**
 * Learning Layer Module (Step 13)
 * Tracks accepted suggestions to build user-specific confidence levels.
 */

interface LearningData {
    acceptedRefactors: Record<string, number>; // "fromStructure|toStructure" -> count
}

export class LearningLayer {
    private readonly STORAGE_KEY = 'adaptix.learningData';
    private data: LearningData;

    constructor(private context: vscode.ExtensionContext) {
        this.data = this.context.globalState.get<LearningData>(this.STORAGE_KEY, {
            acceptedRefactors: {}
        });
    }

    public recordAcceptance(fromStructure: string, toStructure: string) {
        // Normalize names
        const from = fromStructure.replace('std::', '');
        const to = toStructure.replace('std::', '');
        const key = `${from}|${to}`;

        this.data.acceptedRefactors[key] = (this.data.acceptedRefactors[key] || 0) + 1;
        this.context.globalState.update(this.STORAGE_KEY, this.data);
    }

    /**
     * Get a confidence boost (0.0 to 0.15) based on past acceptance of this exact refactor path.
     */
    public getConfidenceBoost(fromStructure: string, toStructure: string): number {
        const from = fromStructure.replace('std::', '');
        const to = toStructure.replace('std::', '');
        const key = `${from}|${to}`;

        const count = this.data.acceptedRefactors[key] || 0;
        
        // Cap the boost at 0.15 for 3 or more acceptances
        return Math.min(count * 0.05, 0.15);
    }
}
