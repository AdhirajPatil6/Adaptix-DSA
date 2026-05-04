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
    private globalProfile: 'speed' | 'memory' | 'balanced' = 'speed';

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

    public setGlobalProfile(profile: 'speed' | 'memory' | 'balanced') {
        this.globalProfile = profile;
        // Invalidate cache so changes take effect immediately
        this.lastTextHash = 0;
        this.cachedResults.clear();
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
        const indexRegex = /\b(\w+)\[.*\]\s*=(?!=)/g;
        const readIndexRegex = /(?<!=)=\s*(\w+)\[.*\]/g;
        const algoRegex = /(?:std::)?(find|sort|binary_search|lower_bound|upper_bound|reverse)\(\s*(\w+)\.begin\(\)/g;

        // Context flag regexes
        const anyIndexRegex = /\b(\w+)\[.*\]/g;
        const rangeForRegex = /for\s*\(.*:\s*(\w+)\s*\)/g;
        const iterForRegex = /for\s*\(.*\b(\w+)\.begin\s*\(/g;

        // ────────────────────────────────────────────────────────────────
        // Loop bound extraction — proportional weight system
        // Instead of a flat constant, we parse actual loop bounds from
        // the source code (e.g., `n*4` → 4.0, `n/10` → 0.1) to produce
        // accurate operation ratios for different workload patterns.
        // All bounds are normalized relative to 'n' (treated as 1.0).
        // ────────────────────────────────────────────────────────────────
        const BASE_WEIGHT = 100; // base weight for a standard loop (bound = n)
        const loopStartRegex = /^\s*(for|while)\s*\(/;
        const openBraceRegex = /\{/g;
        const closeBraceRegex = /\}/g;

        // Context flag maps
        const hasOrderingMap = new Map<string, boolean>();
        const usesIndexAccessMap = new Map<string, boolean>();
        const sequentialIterationMap = new Map<string, boolean>();
        const needsSequenceEfficiencyMap = new Map<string, boolean>();

        // Pre-pass 0: Scan for variable assignments to resolve indirect bounds
        // e.g., `int searchCount = n / 5;` → boundVars['searchCount'] = 0.2
        //        `int deleteCount = n / 2;` → boundVars['deleteCount'] = 0.5
        const boundVars = new Map<string, number>();
        const varAssignRegex = /(?:int|long|size_t|auto)\s+(\w+)\s*=\s*([^;]+);/g;
        for (const line of lines) {
            let assignMatch;
            while ((assignMatch = varAssignRegex.exec(line)) !== null) {
                const varName = assignMatch[1];
                const expr = assignMatch[2].trim();
                const multiplier = this._parseExpression(expr);
                if (multiplier !== null) {
                    boundVars.set(varName, multiplier);
                }
            }
        }

        /**
         * Extract relative multiplier from a for-loop header.
         * Returns a multiplier relative to 'n' (the primary size variable).
         * Examples:
         *   for(int i = 0; i < n; i++)        → 1.0
         *   for(int i = 0; i < n * 4; i++)    → 4.0
         *   for(int i = 0; i < searchCount; ) → lookup searchCount in boundVars
         *   for(int i = 0; i < (int)data.size(); i++) → 1.0 (container size ≈ n)
         *   while(...) or unknown              → 1.0 (safe fallback)
         */
        const parseLoopBound = (line: string): number => {
            // Match for-loop condition: `i < EXPR` or `i <= EXPR`
            const forCondMatch = line.match(/for\s*\([^;]*;\s*\w+\s*<=?\s*([^;]+?)\s*;/);
            if (!forCondMatch) {
                return 1.0; // while loop or unrecognized → default
            }
            const boundExpr = forCondMatch[1].trim();
            
            // Strip casts like (int) or (size_t)
            const cleaned = boundExpr.replace(/\(\s*(?:int|size_t|long|unsigned)\s*\)/g, '').trim();
            
            // Container .size() → treat as ≈ n
            if (cleaned.match(/\w+\.size\(\)/)) {
                return 1.0;
            }

            // Try to parse the expression as a multiplier of n
            const multiplier = this._parseExpression(cleaned);
            if (multiplier !== null) {
                return multiplier;
            }

            // Check if it's a known variable
            if (boundVars.has(cleaned)) {
                return boundVars.get(cleaned)!;
            }

            // Unknown variable that's not 'n' → heuristic: treat as 1.0
            return 1.0;
        };

        // Pre-pass 1: compute per-line cumulative loop multiplier AND depth
        // Instead of flat depth, we track the PRODUCT of all enclosing loop bounds
        // AND the loop depth (to know if we're inside any loop at all)
        const lineLoopMultipliers: number[] = new Array(lines.length).fill(0);
        const lineLoopDepths: number[] = new Array(lines.length).fill(0);
        let currentMultiplier = 1.0;
        let currentLoopDepth = 0;
        // Stack of (isLoop, loopMultiplier) for each brace level
        const loopBraceStack: { isLoop: boolean; multiplier: number }[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            
            // Check if this line starts a loop
            const isLoopStart = loopStartRegex.test(trimmed);
            
            // Count braces on this line
            const opens = (trimmed.match(openBraceRegex) || []).length;
            const closes = (trimmed.match(closeBraceRegex) || []).length;
            
            // Process opening braces
            for (let b = 0; b < opens; b++) {
                if (isLoopStart && b === 0) {
                    const loopMult = parseLoopBound(trimmed);
                    loopBraceStack.push({ isLoop: true, multiplier: loopMult });
                    currentMultiplier *= loopMult;
                    currentLoopDepth++;
                } else {
                    loopBraceStack.push({ isLoop: false, multiplier: 1.0 });
                }
            }
            
            // Set multiplier and depth for this line (after opens, before closes)
            lineLoopMultipliers[i] = currentMultiplier;
            lineLoopDepths[i] = currentLoopDepth;
            
            // Process closing braces
            for (let b = 0; b < closes; b++) {
                if (loopBraceStack.length > 0) {
                    const entry = loopBraceStack.pop()!;
                    if (entry.isLoop) {
                        // Safely restore multiplier (avoid division by zero)
                        if (entry.multiplier > 0) {
                            currentMultiplier /= entry.multiplier;
                        }
                        currentLoopDepth = Math.max(0, currentLoopDepth - 1);
                    }
                }
            }
        }

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            // Calculate operation weight based on proportional loop bounds
            // If inside any loop, apply BASE_WEIGHT scaled by the cumulative multiplier
            // If outside all loops, weight = 1 (single execution)
            const loopDepth = lineLoopDepths[lineIdx];
            const multiplier = lineLoopMultipliers[lineIdx];
            const weight = loopDepth > 0 ? Math.max(1, Math.round(BASE_WEIGHT * multiplier)) : 1;

            // Track which vars had index ops counted on this line (dedup for anyIndexRegex)
            const countedVarsOnLine = new Set<string>();

            // Member operations
            let opMatch;
            while ((opMatch = memberOpRegex.exec(line)) !== null) {
                const varName = opMatch[1];
                const op = opMatch[2];
                const monitor = this.variables.get(varName);

                if (monitor) {
                    if (['push_back', 'push_front', 'insert', 'emplace', 'emplace_back'].includes(op)) {
                        monitor.recordInsertBulk(weight);
                    } else if (['find', 'at', 'operator[]'].includes(op)) {
                        monitor.recordSearchBulk(weight);
                    } else if (['erase', 'pop_back', 'pop_front'].includes(op)) {
                        monitor.recordDeleteBulk(weight);
                    } else if (['sort', 'lower_bound', 'upper_bound'].includes(op)) {
                        hasOrderingMap.set(varName, true);
                    }

                    // Sequence efficiency detection
                    if (['push_front', 'pop_front'].includes(op)) {
                        needsSequenceEfficiencyMap.set(varName, true);
                    }
                    if (['erase', 'insert'].includes(op) && line.includes('.begin()')) {
                        needsSequenceEfficiencyMap.set(varName, true);
                    }
                }
            }

            // Index based insert/update/access — TRUE random access requirement
            let idxMatch;
            while ((idxMatch = indexRegex.exec(line)) !== null) {
                const varName = idxMatch[1];
                const monitor = this.variables.get(varName);
                if (monitor) {
                    countedVarsOnLine.add(varName);
                    usesIndexAccessMap.set(varName, true); // write-index is a hard requirement
                    if (monitor.currentStructure.includes('map')) {
                        monitor.recordInsertBulk(weight);
                    } else {
                        monitor.recordSearchBulk(weight);
                    }
                }
            }

            let readIdxMatch;
            while ((readIdxMatch = readIndexRegex.exec(line)) !== null) {
                const varName = readIdxMatch[1];
                const monitor = this.variables.get(varName);
                if (monitor) {
                    countedVarsOnLine.add(varName);
                    usesIndexAccessMap.set(varName, true); // read-index is a hard requirement
                    monitor.recordSearchBulk(weight);
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
                        monitor.recordSearchBulk(weight);
                    } else if (['sort', 'lower_bound', 'upper_bound'].includes(op)) {
                        hasOrderingMap.set(varName, true);
                        if (op !== 'sort') {
                            monitor.recordSearchBulk(weight);
                        }
                    } else if (op === 'reverse') {
                        needsSequenceEfficiencyMap.set(varName, true);
                    }
                }
            }

            // General index access search counting
            // This catches data[j] in comparison/scan context (e.g., if(data[j] == target))
            // that wasn't already counted by write-index or read-index regex.
            // NOTE: This does NOT set usesIndexAccessMap because linear scan
            // patterns (data[j] in a loop comparison) don't require true random access —
            // the scan could be replaced with find() or a hash lookup.
            let anyIdxMatch;
            while ((anyIdxMatch = anyIndexRegex.exec(line)) !== null) {
                const varName = anyIdxMatch[1];
                if (this.variables.has(varName)) {
                    // Count as search if not already counted by write-index regex on this line
                    if (!countedVarsOnLine.has(varName)) {
                        const monitor = this.variables.get(varName);
                        if (monitor) {
                            monitor.recordSearchBulk(weight);
                        }
                    }
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
            const needsSequenceEfficiency = needsSequenceEfficiencyMap.get(varName) || false;
            
            // Build a safe, typed context object
            const context = createDefaultContext({ hasOrdering, usesIndexAccess, sequentialIteration, needsSequenceEfficiency });

            // Intent detection (Step 8)
            const intentSignal = detectIntent(varName, lines, monitor.currentStructure);

            // Step 1: Constraint System replaces old safety filter
            const constraints = buildConstraints(context, monitor);

            // Step 1.5: Pattern Detection (Advanced DS Heuristics)
            const patternMatch = detectPatterns(varName, lines, context);

            // Check for explicit comment overrides first, otherwise fallback to UI global setting
            let effectiveProfile = this.globalProfile;
            if (intentSignal.optimizationProfile !== 'speed') {
                // This means the user typed a specific comment like `// adaptix: optimize memory` for this var
                // It overrides the global UI setting.
                effectiveProfile = intentSignal.optimizationProfile;
            }
            intentSignal.optimizationProfile = effectiveProfile;

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

    /**
     * Parse a numeric expression that may involve 'n' (the primary size variable).
     * Returns a relative multiplier where n = 1.0.
     * 
     * Supported patterns:
     *   'n'           → 1.0
     *   'n * 4'       → 4.0
     *   '4 * n'       → 4.0
     *   'n / 10'      → 0.1
     *   'n / 5'       → 0.2
     *   'n - 1'       → 1.0 (close enough)
     *   '100'         → null (pure constant, not relative to n)
     *   'someVar'     → null (unknown)
     */
    private _parseExpression(expr: string): number | null {
        const cleaned = expr.trim();

        // Exact 'n'
        if (cleaned === 'n') {
            return 1.0;
        }

        // n * K or K * n
        const mulMatch = cleaned.match(/^n\s*\*\s*(\d+(?:\.\d+)?)$/) ||
                          cleaned.match(/^(\d+(?:\.\d+)?)\s*\*\s*n$/);
        if (mulMatch) {
            return parseFloat(mulMatch[1]);
        }

        // n / K
        const divMatch = cleaned.match(/^n\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (divMatch) {
            const divisor = parseFloat(divMatch[1]);
            return divisor > 0 ? 1.0 / divisor : 1.0;
        }

        // n + K or n - K → treat as ≈ n (close enough for large n)
        const addSubMatch = cleaned.match(/^n\s*[+\-]\s*\d+$/);
        if (addSubMatch) {
            return 1.0;
        }

        return null;
    }
}
