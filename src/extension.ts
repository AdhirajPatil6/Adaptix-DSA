import * as vscode from 'vscode';
import { Analyzer, AnalysisContext, ChangedRange } from './analyzer';
import { SuggestionEngine } from './suggestion';
import { AdaptixViewProvider, AdaptationRecord } from './ui';
import { LearningLayer } from './learning';

export function activate(context: vscode.ExtensionContext) {
	console.log('Adaptix is now active!');

	const learningLayer = new LearningLayer(context);
	const analyzer = new Analyzer(learningLayer);
	const suggestionEngine = new SuggestionEngine();

	const provider = new AdaptixViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AdaptixViewProvider.viewType, provider)
	);

	// Store latest analysis for hover
	let currentAnalysis: Map<string, AnalysisContext> = new Map();
	let globalHistory: AdaptationRecord[] = [];

	const triggerUpdate = (document: vscode.TextDocument) => {
		if (document.languageId !== 'cpp' && document.languageId !== 'c') {
			return;
		}
		const text = document.getText();
		currentAnalysis = analyzer.analyze(text);
		suggestionEngine.updateDiagnostics(document, currentAnalysis);

		provider.update(currentAnalysis, globalHistory);
	};

	// Initial trigger
	if (vscode.window.activeTextEditor) {
		triggerUpdate(vscode.window.activeTextEditor.document);
	}

	// Register UI Command to focus sidebar
	const showInsightsCommand = vscode.commands.registerCommand('adaptix.showInsights', () => {
		vscode.commands.executeCommand('adaptix.insightsView.focus');
	});
	context.subscriptions.push(showInsightsCommand);

	// Register Apply Refactor Command
	const applyRefactorCommand = vscode.commands.registerCommand('adaptix.applyRefactor', async (varName: string, targetStructure: string) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !varName || !targetStructure) { return; }

		const text = editor.document.getText();
		// Find exactly where the variable is declared and its datatype
		const regex = new RegExp(`([^\\s\\n]+)\\s*(?:<[^>]+>)?\\s+${varName}\\s*(?:[=;\\(])`);
		const match = regex.exec(text);
		if (match) {
			const startPos = editor.document.positionAt(match.index);
			const currentStructureString = match[1];
			// The original type string might be "std::list" or "list". Replace exact length.
			const endPos = editor.document.positionAt(match.index + currentStructureString.length);

			const cleanTarget = targetStructure.replace('std::', '');

			const workspaceEdit = new vscode.WorkspaceEdit();
			workspaceEdit.replace(editor.document.uri, new vscode.Range(startPos, endPos), cleanTarget);
			const success = await vscode.workspace.applyEdit(workspaceEdit);

			if (success) {
				vscode.window.showInformationMessage(`Adaptix Refactored: ${varName} to ${cleanTarget}`);
				globalHistory.unshift({
					from: currentStructureString,
					to: cleanTarget,
					reason: `Applied optimization for ${varName}`,
					time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
				});

				// Step 13: Record acceptance for personalized confidence boost
				learningLayer.recordAcceptance(currentStructureString, cleanTarget);

				triggerUpdate(editor.document);
			}
		}
	});
	context.subscriptions.push(applyRefactorCommand);

	// React to changes — use incremental analysis for keystroke performance
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			if (event.document.languageId !== 'cpp' && event.document.languageId !== 'c') {
				return;
			}

			// Extract changed line ranges for incremental analysis
			const changedRanges: ChangedRange[] = event.contentChanges.map(change => ({
				startLine: change.range.start.line,
				endLine: change.range.end.line
			}));

			const text = event.document.getText();
			currentAnalysis = analyzer.analyzeIncremental(text, changedRanges);
			suggestionEngine.updateDiagnostics(event.document, currentAnalysis);
			provider.update(currentAnalysis, globalHistory);
		})
	);

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(document => {
			triggerUpdate(document);
		})
	);

	// Register Hover Provider
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(['cpp', 'c'], {
			provideHover(document, position, token) {
				const wordRange = document.getWordRangeAtPosition(position);
				if (!wordRange) { return null; }
				const word = document.getText(wordRange);

				const context = currentAnalysis.get(word);
				if (context) {
					const md = new vscode.MarkdownString();
					md.isTrusted = true;
					md.appendMarkdown(`**Adaptix Analysis** for \`${word}\`\n\n`);
					md.appendMarkdown(`- Current: \`${context.monitor.currentStructure}\`\n`);
					md.appendMarkdown(`- Operations: Inside(${context.monitor.totalOperations}), Insert(${context.monitor.insertCount}), Search(${context.monitor.searchCount}), Delete(${context.monitor.deleteCount})\n`);

					if (context.decision.suggestedStructure) {
						md.appendMarkdown(`- **Suggested**: \`${context.decision.suggestedStructure}\`\n`);
						md.appendMarkdown(`- Expected Improvment: *${context.decision.expectedImprovement}*\n`);
						md.appendMarkdown(`- Confidence: **${context.decision.confidenceLabel}**\n`);
					} else {
						md.appendMarkdown(`- **Status**: Optimal structure usage detected.\n`);
					}
					return new vscode.Hover(md);
				}
				return null;
			}
		})
	);

	// Register Code Action Provider for Quick Fix
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(['cpp', 'c'], {
			provideCodeActions(document, range, context, token) {
				const actions: vscode.CodeAction[] = [];

				for (const diagnostic of context.diagnostics) {
					if (diagnostic.source === 'Adaptix' && typeof diagnostic.code === 'string' && diagnostic.code.startsWith('RefactorTo|')) {
						const targetStructure = diagnostic.code.split('|')[1];

						// Extract namespace/type logic simplifaction for MVP
						const text = document.getText(diagnostic.range);
						// Convert simple variable decl
						const action = new vscode.CodeAction(`Refactor to ${targetStructure}`, vscode.CodeActionKind.QuickFix);
						action.diagnostics = [diagnostic];
						action.isPreferred = true;

						const edit = new vscode.WorkspaceEdit();
						const replacementText = text.replace(/(std::)?(vector|list|map|unordered_map|set|unordered_set)/, targetStructure);
						edit.replace(document.uri, diagnostic.range, replacementText);

						action.edit = edit;
						actions.push(action);
					}
				}
				return actions;
			}
		})
	);
}

export function deactivate() { }
