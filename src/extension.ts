import * as vscode from 'vscode';
import { Analyzer, AnalysisContext, ChangedRange } from './analyzer';
import { SuggestionEngine } from './suggestion';
import { AdaptixViewProvider, AdaptationRecord } from './ui';
import { LearningLayer } from './learning';
import { planRefactor, RefactorPlan } from './refactorPlanner';
import { logDebug, logWarn } from './logger';
import { classifyRefactor, shouldUseAI, RefactorClass } from './refactorType';
import { generateSemanticRefactor } from './aiService';
import { validateRefactor } from './validator';

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

	// Register Apply Refactor Command — uses plan-based system
	const applyRefactorCommand = vscode.commands.registerCommand('adaptix.applyRefactor', async (varName: string, targetStructure: string) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !varName || !targetStructure) { return; }

		// Verify analysis context exists for this variable
		const analysisCtxForRefactor = currentAnalysis.get(varName);
		if (!analysisCtxForRefactor) {
			vscode.window.showWarningMessage(`Adaptix: No analysis data found for '${varName}'. Try saving the file first.`);
			return;
		}

		const currentStructure = analysisCtxForRefactor.monitor.currentStructure;

		// Classify refactoring type
		const refactorType = classifyRefactor(analysisCtxForRefactor.context, currentStructure, targetStructure);
		const useAI = shouldUseAI(refactorType);
		
		logDebug('Refactor', `Starting Refactor Flow`, {
			varName, 
			from: currentStructure, 
			to: targetStructure, 
			refactorType, 
			useAI 
		});

		let editsToApply: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();

		if (!useAI) {
			// SAFE or ADAPTIVE Flow
			const plan = planRefactor(
				editor.document,
				varName,
				currentStructure,
				targetStructure,
				analysisCtxForRefactor.context
			);

			if (plan.edits.length === 0) {
				vscode.window.showWarningMessage(`Adaptix: ${plan.summary}`);
				return;
			}

			if (!plan.safety.isSafe) {
				const warningMsg = plan.warnings.join('\n• ');
				const choice = await vscode.window.showWarningMessage(
					`⚠️ Refactor has safety warnings:\n• ${warningMsg}`,
					{ modal: true },
					'Apply Anyway',
					'Cancel'
				);
				if (choice !== 'Apply Anyway') {
					logDebug('Refactor', 'User cancelled unsafe refactor');
					return;
				}
			} else if (plan.warnings.length > 0) {
				const warningMsg = plan.warnings.join('\n• ');
				const choice = await vscode.window.showInformationMessage(
					`Adaptix: ${plan.summary}\n\nNotes:\n• ${warningMsg}`,
					'Apply',
					'Cancel'
				);
				if (choice !== 'Apply') {
					logDebug('Refactor', 'User cancelled refactor with warnings');
					return;
				}
			}

			for (const edit of plan.edits) {
				editsToApply.replace(editor.document.uri, edit.range, edit.newText);
			}

		} else {
			// SEMANTIC Flow (AI Assisted)
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Adaptix: Generating Semantic Refactor...",
				cancellable: false
			}, async (progress) => {
				
				const aiResult = await generateSemanticRefactor({
					code: editor.document.getText(),
					context: analysisCtxForRefactor.context,
					currentDS: currentStructure,
					targetDS: targetStructure
				});

				if (!aiResult) {
					vscode.window.showErrorMessage("Adaptix: AI failed to generate semantic refactor. Falling back to manual rewriting.");
					return;
				}

				// STRICT Validation Layer
				const validation = validateRefactor(analysisCtxForRefactor.context, targetStructure, aiResult);
				if (!validation.isValid) {
					const errorMsg = validation.errors.join('\n• ');
					vscode.window.showWarningMessage(`Adaptix blocked unsafe AI generation:\n• ${errorMsg}`);
					logWarn('Refactor', 'AI Validation Failed', validation.errors);
					return;
				}

				// Preview AI Changes
				const documentRange = new vscode.Range(
					editor.document.positionAt(0), 
					editor.document.positionAt(editor.document.getText().length)
				);
				
				// Since we aren't using a full diff viewer for MVP, we just replace the whole text
				editsToApply.replace(editor.document.uri, documentRange, aiResult.new_code);

				// Wait for user confirmation
				const warningList = aiResult.warnings.length > 0 ? `\n\nAI Warnings:\n• ${aiResult.warnings.join('\n• ')}` : '';
				const changeList = aiResult.changes.length > 0 ? `\n\nChanges Made:\n• ${aiResult.changes.join('\n• ')}` : '';
				
				const choice = await vscode.window.showInformationMessage(
					`Semantic Refactor Ready!${changeList}${warningList}`,
					{ modal: true },
					'Apply Semantic Refactor',
					'Cancel'
				);

				if (choice !== 'Apply Semantic Refactor') {
					editsToApply = new vscode.WorkspaceEdit(); // Clear edits
					return;
				}
			});
			
			// If edits were cleared due to cancellation or failure
			if (editsToApply.size === 0) return;
		}

		// Apply final edits
		const success = await vscode.workspace.applyEdit(editsToApply);

		if (success) {
			const cleanTarget = targetStructure.replace('std::', '');
			vscode.window.showInformationMessage(`Adaptix Refactored: ${varName} to ${cleanTarget}`);
			globalHistory.unshift({
				from: currentStructure.replace('std::', ''),
				to: cleanTarget,
				reason: `Applied optimization for ${varName}`,
				time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			});

			// Record acceptance for personalized confidence boost
			learningLayer.recordAcceptance(currentStructure, cleanTarget);
			logDebug('Refactor', `Successfully refactored ${varName} to ${cleanTarget}`);

			triggerUpdate(editor.document);
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

				const analysisCtx = currentAnalysis.get(word);
				if (analysisCtx) {
					const md = new vscode.MarkdownString();
					md.isTrusted = true;
					md.appendMarkdown(`**Adaptix Analysis** for \`${word}\`\n\n`);
					md.appendMarkdown(`- Current: \`${analysisCtx.monitor.currentStructure}\`\n`);
					md.appendMarkdown(`- Operations: Inside(${analysisCtx.monitor.totalOperations}), Insert(${analysisCtx.monitor.insertCount}), Search(${analysisCtx.monitor.searchCount}), Delete(${analysisCtx.monitor.deleteCount})\n`);

					if (analysisCtx.decision.suggestedStructure) {
						md.appendMarkdown(`- **Suggested**: \`${analysisCtx.decision.suggestedStructure}\`\n`);
						md.appendMarkdown(`- Expected Improvement: *${analysisCtx.decision.expectedImprovement}*\n`);
						md.appendMarkdown(`- Confidence: **${analysisCtx.decision.confidenceLabel}**\n`);
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
			provideCodeActions(document, range, codeActionContext, token) {
				const actions: vscode.CodeAction[] = [];

				for (const diagnostic of codeActionContext.diagnostics) {
					if (diagnostic.source === 'Adaptix' && typeof diagnostic.code === 'string' && diagnostic.code.startsWith('RefactorTo|')) {
						const parts = diagnostic.code.split('|');
						const targetStructure = parts[1];
						const varNameFromCode = parts[2]; // We'll encode this in suggestion.ts

						const action = new vscode.CodeAction(
							`Adaptix: Refactor to ${targetStructure}`,
							vscode.CodeActionKind.QuickFix
						);
						action.diagnostics = [diagnostic];
						action.isPreferred = true;

						// Delegate to the plan-based refactor command
						action.command = {
							command: 'adaptix.applyRefactor',
							title: `Refactor to ${targetStructure}`,
							arguments: [varNameFromCode ?? '', targetStructure]
						};

						actions.push(action);
					}
				}
				return actions;
			}
		})
	);
}

export function deactivate() { }
