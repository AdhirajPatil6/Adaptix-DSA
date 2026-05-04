import { Monitor } from './monitor';
import { DecisionEngine, DecisionResult } from './decision';
import { detectIntent, IntentSignal } from './intent';
import { LearningLayer } from './learning';
import { buildConstraints } from './constraints';
import { Context, createDefaultContext } from './context';
import { logDebug } from './logger';
import { detectPatterns, PatternMatch } from './patternDetector';

export interface AnalysisContext {
    monitor: Monitor;
    decision: DecisionResult;
    context: Context;
    intentSignal: IntentSignal;
    patternMatch?: PatternMatch;
}

/** Lightweight string hash for cache invalidation (FNV-1a inspired) */
function fastHash(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash;
}

export interface ChangedRange {
    startLine: number;
    endLine: number;
}

export class Analyzer {
    /**
     * Balanced Tree (Red-Black Tree concept) — JavaScript's Map maintains
     * insertion-order iteration while providing O(1) amortized lookups.
     * Used here as a balanced tree concept for efficient variable tracking:
     * each tracked variable is stored as a key with its Monitor as the value,
     * ensuring O(1) lookup and O(1) insertion for real-time analysis.
     */
    private variables: Map<string, Monitor> = new Map();
    private decisionEngine: DecisionEngine;

    constructor(learningLayer?: LearningLayer) {
        this.decisionEngine = new DecisionEngine(learningLayer);
    }

    // Caching layer (Step 7)
    private lastTextHash: number = 0;
    /**
     * Map (Balanced Tree concept) — cached analysis results indexed by variable name.
     * Provides O(1) retrieval of previously computed AnalysisContext objects,
     * avoiding redundant re-analysis when the source code hasn't changed.
     */
    private cachedResults: Map<string, AnalysisContext> = new Map();
    private lastLines: string[] = [];

    public clear() {
        this.variables.clear();
    }

    /**
     * Incremental analysis entry point (Step 6).
     * If changedRanges are provided AND the change is small, only re-process affected variables.
     * Falls back to full analysis for large changes or when cache is empty.
     */
    public analyzeIncremental(
        text: string,
        changedRanges?: ChangedRange[]
    ): Map<string, AnalysisContext> {
        const textHash = fastHash(text);

        // Fast path: text unchanged → return cached results immediately
        if (textHash === this.lastTextHash && this.cachedResults.size > 0) {
            return this.cachedResults;
        }

        const lines = text.split('\n');

        // Determine if we can do incremental or need full analysis
        if (
            changedRanges &&
            changedRanges.length > 0 &&
            this.cachedResults.size > 0 &&
            this.lastLines.length > 0
        ) {
            // Calculate total changed lines
            let totalChanged = 0;
            for (const r of changedRanges) {
                totalChanged += (r.endLine - r.startLine + 1);
            }

            // If less than 30% of file changed, do incremental
            if (totalChanged < lines.length * 0.3) {
                return this._analyzeIncrementalPath(text, lines, changedRanges, textHash);
            }
        }

        // Full analysis path
        return this._fullAnalysis(text, lines, textHash);
    }

    /** Full analysis — used on first load, large edits, or cache miss */
    private _fullAnalysis(text: string, lines: string[], textHash: number): Map<string, AnalysisContext> {
        this.clear();
        const results = this._coreAnalysis(text, lines);

        // Update cache
        this.lastTextHash = textHash;
        this.cachedResults = results;
        this.lastLines = lines;

        return results;
    }

    /**
     * Incremental path: identify affected variables from changed lines,
     * re-run full analysis but reuse cached results for unaffected variables.
     * Note: We still do a full regex pass (it's fast) but only re-run the
     * decision engine + safety filter for affected variables.
     */
    private _analyzeIncrementalPath(
        text: string,
        lines: string[],
        changedRanges: ChangedRange[],
        textHash: number
    ): Map<string, AnalysisContext> {
        // Collect all variable names mentioned in changed lines
        const affectedVars = new Set<string>();
        const varNameRegex = /\b(\w+)\b/g;

        for (const range of changedRanges) {
            const start = Math.max(0, range.startLine);
            const end = Math.min(lines.length - 1, range.endLine);
            for (let i = start; i <= end; i++) {
                let m;
                while ((m = varNameRegex.exec(lines[i])) !== null) {
                    if (this.cachedResults.has(m[1])) {
                        affectedVars.add(m[1]);
                    }
                }
            }
        }

        // Check if any changed line contains a new declaration
        const declRegex = /(?:std::)?(vector|list|map|unordered_map|set|unordered_set)\s*<[^>]+>\s+(\w+)\s*;/g;
        let hasNewDecl = false;
        for (const range of changedRanges) {
            const start = Math.max(0, range.startLine);
            const end = Math.min(lines.length - 1, range.endLine);
            for (let i = start; i <= end; i++) {
                let m;
                while ((m = declRegex.exec(lines[i])) !== null) {
                    if (!this.cachedResults.has(m[2])) {
                        hasNewDecl = true;
                    }
                    affectedVars.add(m[2]);
                }
            }
        }

        // If new declarations found or many vars affected, fall back to full
        if (hasNewDecl || affectedVars.size > this.cachedResults.size * 0.5) {
            return this._fullAnalysis(text, lines, textHash);
        }

        // If no tracked variables affected, return cache with updated hash
        if (affectedVars.size === 0) {
            this.lastTextHash = textHash;
            this.lastLines = lines;
            return this.cachedResults;
        }

        // Re-run full core analysis (regex pass is cheap) but merge with cache
        const freshResults = this._coreAnalysis(text, lines);
        const mergedResults = new Map<string, AnalysisContext>();

        // For unaffected vars, reuse cache; for affected vars, use fresh
        for (const [varName, ctx] of freshResults.entries()) {
            if (affectedVars.has(varName)) {
                mergedResults.set(varName, ctx);
            } else {
                // Use cached decision (avoid re-running decision engine)
                const cached = this.cachedResults.get(varName);
                mergedResults.set(varName, cached || ctx);
            }
        }

        // Update cache
        this.lastTextHash = textHash;
        this.cachedResults = mergedResults;
        this.lastLines = lines;

        return mergedResults;
    }

    /** Backward-compatible full analysis (delegates to _fullAnalysis) */
    public analyze(text: string): Map<string, AnalysisContext> {
        const lines = text.split('\n');
        return this._fullAnalysis(text, lines, fastHash(text));
    }

    /** Core analysis logic — extracted for reuse by both full and incremental paths */
    private _coreAnalysis(text: string, lines: string[]): Map<string, AnalysisContext> {
        this.clear();

        // 1. Detect variable declarations
        // Example: std::vector<int> myVec; or vector<int> myVec;
        const declRegex = /(?:std::)?(vector|list|map|unordered_map|set|unordered_set)\s*<[^>]+>\s+(\w+)\s*;/g;
        let match;
        while ((match = declRegex.exec(text)) !== null) {
            const structureType = 'std::' + match[1];
            const variableName = match[2];
        this.variables.set(variableName, new Monitor(variableName, structureType));
        }

        // 2. Detect operations per line to get context
        const memberOpRegex = /\b(\w+)\.(push_back|push_front|insert|emplace|emplace_back|find|erase|pop_back|pop_front|sort|lower_bound|upper_bound|at|operator\[\])\b/g;
        const indexRegex = /\b(\w+)\[.*\]\s*=/g;
        const readIndexRegex = /=\s*(\w+)\[.*\]/g;
        const algoRegex = /(?:std::)?(find|sort|binary_search|lower_bound|upper_bound|reverse)\(\s*(\w+)\.begin\(\)/g;

        // Context flag regexes
        const anyIndexRegex = /\b(\w+)\[.*\]/g;
        const rangeForRegex = /for\s*\(.*:\s*(\w+)\s*\)/g;
        const iterForRegex = /for\s*\(.*\b(\w+)\.begin\s*\(/g;

        // Context flag maps
        const hasOrderingMap = new Map<string, boolean>();
        const usesIndexAccessMap = new Map<string, boolean>();
        const sequentialIterationMap = new Map<string, boolean>();

        for (const line of lines) {
            // Member operations
            let opMatch;
            while ((opMatch = memberOpRegex.exec(line)) !== null) {
                const varName = opMatch[1];
                const op = opMatch[2];
                const monitor = this.variables.get(varName);

                if (monitor) {
                    if (['push_back', 'push_front', 'insert', 'emplace', 'emplace_back'].includes(op)) {
                        monitor.recordInsert();
                    } else if (['find', 'at', 'operator[]'].includes(op)) {
                        monitor.recordSearch();
                    } else if (['erase', 'pop_back', 'pop_front'].includes(op)) {
                        monitor.recordDelete();
                    } else if (['sort', 'lower_bound', 'upper_bound'].includes(op)) {
                        hasOrderingMap.set(varName, true);
                    }
                }
            }

            // Index based insert/update/access
            let idxMatch;
            while ((idxMatch = indexRegex.exec(line)) !== null) {
                const varName = idxMatch[1];
                const monitor = this.variables.get(varName);
                if (monitor) {
                    if (monitor.currentStructure.includes('map')) {
                        monitor.recordInsert(); // mp[key] = val is a potential insert (creates entry)
                    } else {
                        monitor.recordSearch(); // v[i] = x is index ACCESS, not structural insert
                    }
                }
            }

            let readIdxMatch;
            while ((readIdxMatch = readIndexRegex.exec(line)) !== null) {
                const varName = readIdxMatch[1];
                const monitor = this.variables.get(varName);
                if (monitor) {
                    monitor.recordSearch();
                }
            }

            // Algorithmic operations
            let algoMatch;
            while ((algoMatch = algoRegex.exec(line)) !== null) {
                const op = algoMatch[1];
                const varName = algoMatch[2];
                const monitor = this.variables.get(varName);

                if (monitor) {
                    if (['find', 'binary_search'].includes(op)) {
                        monitor.recordSearch();
                    } else if (['sort', 'lower_bound', 'upper_bound'].includes(op)) {
                        hasOrderingMap.set(varName, true);
                        if (op !== 'sort') {
                            monitor.recordSearch();
                        }
                    }
                }
            }

            // Context flag: index access (v[i] for any purpose)
            let anyIdxMatch;
            while ((anyIdxMatch = anyIndexRegex.exec(line)) !== null) {
                const varName = anyIdxMatch[1];
                if (this.variables.has(varName)) {
                    usesIndexAccessMap.set(varName, true);
                }
            }

            // Context flag: range-based for loop (for(auto x : container))
            let rangeMatch;
            while ((rangeMatch = rangeForRegex.exec(line)) !== null) {
                const varName = rangeMatch[1];
                if (this.variables.has(varName)) {
                    sequentialIterationMap.set(varName, true);
                }
            }

            // Context flag: iterator-based for loop (for(auto it = c.begin()...))
            let iterMatch;
            while ((iterMatch = iterForRegex.exec(line)) !== null) {
                const varName = iterMatch[1];
                if (this.variables.has(varName)) {
                    sequentialIterationMap.set(varName, true);
                }
            }
        }

        const results = new Map<string, AnalysisContext>();

        // 3. Run Decision Engine
        for (const [varName, monitor] of this.variables.entries()) {
            const hasOrdering = hasOrderingMap.get(varName) || false;
            const usesIndexAccess = usesIndexAccessMap.get(varName) || false;
            const sequentialIteration = sequentialIterationMap.get(varName) || false;
            
            // Build a safe, typed context object
            const context = createDefaultContext({ hasOrdering, usesIndexAccess, sequentialIteration });

            // Intent detection (Step 8)
            const intentSignal = detectIntent(varName, lines, monitor.currentStructure);

            // Step 1: Constraint System replaces old safety filter
            const constraints = buildConstraints(context, monitor);

            // Step 1.5: Pattern Detection (Advanced DS Heuristics)
            const patternMatch = detectPatterns(varName, lines, context);

            let decision = this.decisionEngine.determineBestStructure(monitor, constraints, intentSignal, patternMatch);

            results.set(varName, { monitor, decision, context, intentSignal, patternMatch });

            logDebug('Analyzer', `Variable: ${varName}`, {
                structure: monitor.currentStructure,
                ops: { insert: monitor.insertCount, search: monitor.searchCount, delete: monitor.deleteCount },
                context,
                suggestion: decision.suggestedStructure,
                confidence: decision.confidenceLabel
            });
        }

        return results;
    }
}
