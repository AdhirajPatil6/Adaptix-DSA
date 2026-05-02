import * as vscode from 'vscode';
import { AnalysisContext } from './analyzer';

export interface AdaptationRecord {
    from: string;
    to: string;
    reason: string;
    time: string;
}

function getHumanReadableDS(ds: string): string {
    const map = {
        'std::vector': 'Vector (Array-based)',
        'std::list': 'Doubly Linked List',
        'std::map': 'Map (Red-Black Tree)',
        'std::set': 'Set (Red-Black Tree)',
        'std::unordered_map': 'Hash Map',
        'std::unordered_set': 'Hash Set'
    };
    return (map as any)[ds] || ds.replace('std::', '');
}

export class AdaptixViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'adaptix.insightsView';
    private _view?: vscode.WebviewView;
    private _latestData: Map<string, AnalysisContext> = new Map();
    private _history: AdaptationRecord[] = [];

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Pass messages from UI back to the extension
        webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'applyRefactor') {
                vscode.commands.executeCommand('adaptix.applyRefactor', message.varName, message.targetStructure);
            }
        });

        this.update(this._latestData, this._history);
    }

    public update(analysisData: Map<string, AnalysisContext>, history: AdaptationRecord[] = this._history) {
        this._latestData = analysisData;
        this._history = history;
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(analysisData, history);
        }
    }

    private _getHtmlForWebview(data: Map<string, AnalysisContext>, history: AdaptationRecord[]) {
        let statsHtml = '';
        let totalDetected = data.size;
        let optimizations = 0;
        let optimal = 0;

        if (totalDetected === 0) {
            statsHtml = `
            <div class="empty-state">
                <h2 style="font-size: 1.2rem;">Waiting for Patterns...</h2>
                <p>Start coding in C++ to see real-time performance insights.</p>
            </div>`;
        } else {
            let logHtml = '';

            data.forEach((ctx, varName) => {
                if (ctx.decision.suggestedStructure) {
                    optimizations++;
                } else {
                    optimal++;
                }

                // Calculate Dominant Operation
                const maxRatio = Math.max(ctx.monitor.insertRatio, ctx.monitor.searchRatio, ctx.monitor.deleteRatio);
                const isDomInsert = ctx.monitor.insertRatio === maxRatio;
                const isDomSearch = ctx.monitor.searchRatio === maxRatio;
                const isDomDelete = ctx.monitor.deleteRatio === maxRatio;

                const confColorClass = 
                    ctx.decision.confidenceLabel === 'Strong' ? 'conf-strong' :
                    ctx.decision.confidenceLabel === 'Moderate' ? 'conf-moderate' : 'conf-low';
                
                const btnClass = ctx.decision.confidenceLabel === 'Low' ? 'refactor-btn refactor-btn-low' : 'refactor-btn';

                const suggestionCard = ctx.decision.suggestedStructure
                    ? `<div class="suggestion-box animate-pulse">
                        <div class="suggestion-header" style="justify-content: space-between;">
                            <strong style="color: var(--accent-orange);">High Impact Optimization</strong>
                            <span class="badge ${confColorClass}">${ctx.decision.confidenceLabel} Confidence</span>
                        </div>
                        <div class="suggestion-body">
                            <p style="margin-bottom: 8px;">Refactor to <span class="badge recommendation">${getHumanReadableDS(ctx.decision.suggestedStructure)}</span></p>
                            
                            <div class="improvement-path">
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <span style="font-size:0.7rem; color:var(--text-secondary);">Current</span>
                                    <span class="badge current">${ctx.monitor.currentStructure.replace('std::', '')}</span>
                                </div>
                                <span class="arrow">→</span>
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <span style="font-size:0.7rem; color:var(--text-secondary);">Suggested</span>
                                    <span class="badge recommendation">${ctx.decision.suggestedStructure.replace('std::', '')}</span>
                                </div>
                                
                                <div class="speedup-highlight">
                                    <span class="speedup-val">${ctx.decision.speedup || 'Faster'}</span>
                                </div>
                            </div>
                            
                            <details class="explain-details">
                                <summary>Explain Decision</summary>
                                <div class="explain-content">
                                    <div style="margin-bottom: 4px;">
                                        <strong style="color: var(--text-primary);">Why current is suboptimal:</strong>
                                        <p style="margin-top: 2px;">→ ${ctx.decision.whyCurrentBad}</p>
                                    </div>
                                    <div style="margin-bottom: 4px;">
                                        <strong style="color: var(--text-primary);">Why suggested is better:</strong>
                                        <p style="margin-top: 2px;">→ ${ctx.decision.whySuggestedBetter}</p>
                                    </div>
                                    
                                    <div style="margin-top: 8px; border-top: 1px dashed var(--glass-border); padding-top: 8px;">
                                        <strong style="color: var(--text-primary); font-size: 0.7rem;">Operations Breakdown:</strong>
                                        <div style="display: flex; gap: 8px; margin-top: 4px; font-size: 0.65rem;">
                                            <span>Insert: ${ctx.monitor.insertCount} (${(ctx.monitor.insertRatio * 100).toFixed(0)}%)</span>
                                            <span>Search: ${ctx.monitor.searchCount} (${(ctx.monitor.searchRatio * 100).toFixed(0)}%)</span>
                                            <span>Delete: ${ctx.monitor.deleteCount} (${(ctx.monitor.deleteRatio * 100).toFixed(0)}%)</span>
                                        </div>
                                    </div>
                                    
                                    <div style="margin-top: 8px; border-top: 1px dashed var(--glass-border); padding-top: 8px;">
                                        <strong style="color: var(--text-primary); font-size: 0.7rem;">Context Flags:</strong>
                                        <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 4px; font-size: 0.65rem;">
                                            <span>${ctx.hasOrdering ? '✓ Ordering required' : '✗ No ordering needed'}</span>
                                            <span>${ctx.usesIndexAccess ? '✓ Index access detected' : '✗ No index access'}</span>
                                            <span>${ctx.sequentialIteration ? '✓ Sequential iteration' : '✗ No sequential iteration'}</span>
                                        </div>
                                    </div>
                                    
                                    <p style="margin-top: 8px; color: var(--accent-orange);">${ctx.decision.reason}</p>
                                </div>
                            </details>

                            <button class="${btnClass}" onclick="applyRefactor('${varName}', '${ctx.decision.suggestedStructure}')">Apply Refactor</button>
                            
                            ${ctx.decision.alternativeStructure ? `
                            <div class="alternative-box" style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.15); border-radius: 6px; border: 1px dashed var(--glass-border);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-size: 0.7rem; color: var(--text-secondary);">Alternative</span>
                                    <span class="badge recommendation" style="background: rgba(255,255,255,0.1); color: var(--text-primary);">${getHumanReadableDS(ctx.decision.alternativeStructure)}</span>
                                </div>
                                <p style="font-size: 0.65rem; color: var(--text-secondary); margin-bottom: 6px; font-style: italic;">${ctx.decision.alternativeReason}</p>
                                <button class="refactor-btn refactor-btn-alt" style="padding: 4px; font-size: 0.7rem; margin-top: 0;" onclick="applyRefactor('${varName}', '${ctx.decision.alternativeStructure}')">Apply Alternative</button>
                            </div>
                            ` : ''}
                        </div>
                       </div>`
                    : `<div class="optimal-box">
                        <div class="optimal-header">
                            <strong>Peak Performance</strong>
                        </div>
                        <p style="font-size: 0.8rem; margin:0;">Current structure is optimal for this workload.</p>
                       </div>`;

                statsHtml += `
                    <div class="glass-card animate-in">
                        <div class="card-header">
                            <div class="var-info">
                                <span class="var-name">${varName}</span>
                                <span class="badge current" style="margin-top: 4px;">${getHumanReadableDS(ctx.monitor.currentStructure)}</span>
                            </div>
                        </div>
                        
                        <div class="metrics-grid">
                            <div class="metric-item ${isDomInsert && maxRatio > 0 ? 'dominant' : ''}">
                                <span class="label">Insert ${(ctx.monitor.insertRatio * 100).toFixed(0)}%</span>
                                <div class="progress-bar">
                                    <div class="progress fill-insert" style="width: ${ctx.monitor.insertRatio * 100}%"></div>
                                </div>
                            </div>
                            <div class="metric-item ${isDomSearch && maxRatio > 0 ? 'dominant' : ''}">
                                <span class="label">Search ${(ctx.monitor.searchRatio * 100).toFixed(0)}%</span>
                                <div class="progress-bar">
                                    <div class="progress fill-search" style="width: ${ctx.monitor.searchRatio * 100}%"></div>
                                </div>
                            </div>
                            <div class="metric-item ${isDomDelete && maxRatio > 0 ? 'dominant' : ''}">
                                <span class="label">Delete ${(ctx.monitor.deleteRatio * 100).toFixed(0)}%</span>
                                <div class="progress-bar">
                                    <div class="progress fill-delete" style="width: ${ctx.monitor.deleteRatio * 100}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        ${suggestionCard}
                    </div>
                `;
            });

            history.forEach(rec => {
                logHtml += `
                <div class="log-entry">
                    <span class="log-time" style="font-size:10px;">${rec.time}</span>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <span class="log-msg">Refactored <code>${rec.from}</code> → <code>${rec.to}</code></span>
                        <span style="font-size: 0.7rem; color: var(--text-secondary);">${rec.reason}</span>
                    </div>
                </div>`;
            });

            statsHtml = `
            <div class="dashboard">
                <div class="global-summary">
                    <div class="stat-box">
                        <span class="stat-num">${totalDetected}</span>
                        <span class="stat-lbl">Tracked</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-num" style="color:var(--accent-orange);">${optimizations}</span>
                        <span class="stat-lbl">Warnings</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-num" style="color:var(--accent-green);">${optimal}</span>
                        <span class="stat-lbl">Optimal</span>
                    </div>
                </div>

                <div class="main-content">
                    <div class="section-header">
                        <h2>Live Intelligence</h2>
                    </div>
                    <div class="cards-container">
                        ${statsHtml}
                    </div>
                </div>
                
                ${logHtml ? `
                <div class="sidebar">
                    <div class="section-header">
                        <h2 style="font-size: 1rem;">Adaptation History</h2>
                    </div>
                    <div class="log-container">
                        ${logHtml}
                    </div>
                </div>` : ''}
            </div>`;
        }

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    :root {
                        --glass-bg: rgba(255, 255, 255, 0.03);
                        --glass-border: rgba(255, 255, 255, 0.08);
                        --accent-blue: #38bdf8;
                        --accent-purple: #818cf8;
                        --accent-green: #4ade80;
                        --accent-orange: #fb923c;
                        --text-primary: #f1f5f9;
                        --text-secondary: #94a3b8;
                    }

                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        background: transparent;
                        color: var(--text-primary);
                        margin: 0;
                        padding: 16px 12px;
                        overflow-x: hidden;
                    }

                    h1, h2, h3, h4 { margin: 0; font-weight: 600; }

                    .dashboard { display: flex; flex-direction: column; gap: 24px; }

                    .global-summary {
                        display: flex;
                        gap: 12px;
                        background: rgba(0,0,0,0.15);
                        padding: 12px;
                        border-radius: 8px;
                        border: 1px solid var(--glass-border);
                    }
                    .stat-box { flex: 1; display: flex; flex-direction: column; align-items: center; }
                    .stat-num { font-size: 1.2rem; font-weight: bold; }
                    .stat-lbl { font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; margin-top:2px; }

                    .section-header {
                        display: flex; align-items: center; justify-content: space-between;
                        margin-bottom: 12px; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px;
                    }

                    .glass-card {
                        background: var(--glass-bg); border: 1px solid var(--glass-border);
                        border-radius: 8px; padding: 12px; margin-bottom: 16px;
                    }

                    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }

                    .var-info { display: flex; flex-direction: column; gap: 2px; }
                    .var-name { font-family: 'Consolas', monospace; font-size: 1rem; color: var(--accent-blue); word-break: break-all; }

                    .badge {
                        display: inline-block; padding: 2px 6px; border-radius: 4px;
                        font-size: 0.65rem; font-weight: 600;
                    }
                    .badge.current { background: rgba(56, 189, 248, 0.1); color: var(--accent-blue); }
                    .badge.recommendation { background: rgba(251, 146, 60, 0.2); color: var(--accent-orange); }

                    .metrics-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
                    .metric-item { display: flex; align-items: center; gap: 8px; }
                    .metric-item.dominant .label { color: white; font-weight: bold; }
                    .label { font-size: 0.7rem; color: var(--text-secondary); width: 60px; }
                    .progress-bar { flex: 1; height: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 3px; overflow: hidden; }
                    .progress { height: 100%; border-radius: 3px; }
                    .fill-insert { background: var(--accent-green); }
                    .fill-search { background: var(--accent-blue); }
                    .fill-delete { background: var(--accent-orange); }

                    .suggestion-box { background: rgba(251, 146, 60, 0.05); border-radius: 6px; padding: 10px; border-left: 3px solid var(--accent-orange); }
                    .optimal-box { background: rgba(74, 222, 128, 0.05); border-radius: 6px; padding: 10px; border-left: 3px solid var(--accent-green); }

                    .suggestion-header, .optimal-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 0.9rem; }

                    .improvement-path {
                        display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;
                        background: rgba(0, 0, 0, 0.2); padding: 8px; border-radius: 6px; margin-top: 10px; margin-bottom: 10px;
                    }
                    
                    .speedup-highlight {
                        background: rgba(74, 222, 128, 0.15); border: 1px solid rgba(74, 222, 128, 0.4);
                        padding: 4px 8px; border-radius: 12px;
                    }
                    .speedup-val { color: var(--accent-green); font-weight: bold; font-size: 0.75rem; }

                    .arrow { color: var(--text-secondary); font-size:1.2rem; }

                    .explain-details { background: rgba(0,0,0,0.1); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; margin-bottom: 12px; border: 1px solid var(--glass-border); }
                    .explain-details summary { cursor: pointer; color: var(--text-secondary); margin-bottom: 4px; }
                    .explain-content { padding-top: 8px; border-top: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 6px; }
                    .explain-row { display: flex; justify-content: space-between; }
                    .explain-content code { background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
                    .explain-content p { color: var(--text-secondary); margin-top: 4px; font-style: italic;}

                    .refactor-btn {
                        width: 100%; background: linear-gradient(135deg, var(--accent-orange), #ea580c);
                        color: white; border: none; padding: 8px; border-radius: 6px;
                        font-weight: bold; cursor: pointer; transition: opacity 0.2s, filter 0.2s; margin-top: 4px;
                    }
                    .refactor-btn:hover { opacity: 0.8; }
                    .refactor-btn-low { background: linear-gradient(135deg, #64748b, #475569); filter: grayscale(0.5); }
                    .refactor-btn-low:hover { filter: grayscale(0); }
                    .refactor-btn-alt { background: rgba(255,255,255,0.1); border: 1px solid var(--glass-border); color: var(--text-primary); }
                    .refactor-btn-alt:hover { background: rgba(255,255,255,0.2); opacity: 1; }

                    .conf-strong { background: rgba(74, 222, 128, 0.2); color: var(--accent-green); }
                    .conf-moderate { background: rgba(250, 204, 21, 0.2); color: #facc15; }
                    .conf-low { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

                    .log-container { background: var(--glass-bg); border-radius: 6px; padding: 8px; overflow-y: auto; }
                    .log-entry { padding: 8px 0; border-bottom: 1px solid var(--glass-border); display: flex; gap: 8px; align-items:flex-start; }
                    .log-entry:last-child { border-bottom: none; }

                </style>
            </head>
            <body>
                <header style="margin-bottom: 16px;">
                    <h1 style="font-size: 1.6rem; letter-spacing: -0.5px; background: linear-gradient(to right, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Adaptix</h1>
                    <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 4px;">Dynamic DSA Intelligence</p>
                </header>
                ${statsHtml}
                
                <script>
                    const vscode = acquireVsCodeApi();
                    function applyRefactor(varName, targetStructure) {
                        vscode.postMessage({
                            command: 'applyRefactor',
                            varName: varName,
                            targetStructure: targetStructure
                        });
                    }
                </script>
            </body>
            </html>`;
    }
}
