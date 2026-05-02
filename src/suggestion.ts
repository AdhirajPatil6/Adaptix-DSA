import * as vscode from 'vscode';
import { AnalysisContext } from './analyzer';

export class SuggestionEngine {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('adaptix');
    }

    public clearDiagnostics(document: vscode.TextDocument) {
        this.diagnosticCollection.delete(document.uri);
    }

    public updateDiagnostics(document: vscode.TextDocument, analysisResults: Map<string, AnalysisContext>) {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // Very simplistic way to locate the declaration again to attach the diagnostic
        // Real implementation would map to specific AST nodes
        for (const [varName, context] of analysisResults.entries()) {
            if (context.decision.suggestedStructure !== null && context.decision.suggestedStructure !== context.monitor.currentStructure) {

                // Try to find the line of the variable declaration
                // e.g., std::vector<int> varName;
                const declRegex = new RegExp(`(?:std::)?(?:vector|list|map|unordered_map|set|unordered_set)\\s*<[^>]+>\\s+${varName}\\s*;`, 'g');
                let match;
                while ((match = declRegex.exec(text)) !== null) {
                    const startPos = document.positionAt(match.index);
                    const endPos = document.positionAt(match.index + match[0].length);
                    const range = new vscode.Range(startPos, endPos);

                    const message = `[Adaptix] Suboptimal usage of ${context.monitor.currentStructure} detected for '${varName}'.\n\nSuggestion: Change to ${context.decision.suggestedStructure} (${context.decision.confidenceLabel} Confidence).\nReason: ${context.decision.reason}\nExpected Improvement: ${context.decision.expectedImprovement}`;

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'Adaptix';
                    // We can attach custom data for the CodeAction via a custom property or matching by message later
                    diagnostic.code = `RefactorTo|${context.decision.suggestedStructure}`; // Custom hack for MVP to pass the structure type easily
                    diagnostics.push(diagnostic);
                }
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
    }
}
