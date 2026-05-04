/**
 * Heuristic Pattern Detector
 * 
 * Analyzes code for algorithmic patterns that suggest the use of
 * advanced data structures like Priority Queues, Tries, and Segment Trees.
 * 
 * INTERNAL DSA USAGE:
 * - Trie (Prefix Tree) used internally for O(k) pattern keyword matching,
 *   replacing linear scans over pattern dictionaries.
 */

import { Context } from './context';

// ────────────────────────────────────────────────────────────────
// Trie (Prefix Tree) — used for efficient pattern keyword matching
// Instead of scanning an array of known pattern strings linearly,
// we insert all known heuristic keywords into a Trie and perform
// O(k) lookups (where k = keyword length) during detection.
// ────────────────────────────────────────────────────────────────

class TrieNode {
    /** Map of child character → TrieNode (uses JS Map as an ordered hash) */
    children = new Map<string, TrieNode>();
    isEnd = false;
    /** The full pattern label stored at terminal nodes */
    label: string | null = null;
}

/**
 * Trie (Prefix Tree) data structure.
 * Used internally by ADAPTIX for efficient O(k) pattern keyword lookups.
 */
class Trie {
    root = new TrieNode();

    /** Insert a keyword into the Trie. O(k) where k = word length. */
    insert(word: string, label: string): void {
        let node = this.root;
        for (const ch of word.toLowerCase()) {
            if (!node.children.has(ch)) {
                node.children.set(ch, new TrieNode());
            }
            node = node.children.get(ch)!;
        }
        node.isEnd = true;
        node.label = label;
    }

    /** Search for an exact keyword. O(k) where k = word length. */
    search(word: string): string | null {
        let node = this.root;
        for (const ch of word.toLowerCase()) {
            if (!node.children.has(ch)) return null;
            node = node.children.get(ch)!;
        }
        return node.isEnd ? node.label : null;
    }

    /** Check if any inserted keyword is a prefix of the given text. */
    hasPrefix(text: string): string | null {
        let node = this.root;
        for (const ch of text.toLowerCase()) {
            if (!node.children.has(ch)) return null;
            if (node.children.get(ch)!.isEnd) {
                return node.children.get(ch)!.label;
            }
            node = node.children.get(ch)!;
        }
        return node.isEnd ? node.label : null;
    }
}

// ── Singleton Trie instance loaded with all known algorithmic pattern keywords ──
// Trie used for efficient pattern detection — O(k) lookup per keyword
const patternTrie = new Trie();

// Priority Queue patterns
patternTrie.insert('sort', 'Repeated Extrema Extraction');
patternTrie.insert('max_element', 'Repeated Extrema Extraction');
patternTrie.insert('min_element', 'Repeated Extrema Extraction');
patternTrie.insert('pop_back', 'Repeated Extrema Extraction');
patternTrie.insert('priority', 'Repeated Extrema Extraction');

// Trie / Prefix patterns
patternTrie.insert('substr', 'Prefix String Search');
patternTrie.insert('startswith', 'Prefix String Search');
patternTrie.insert('prefix', 'Prefix String Search');

// Segment Tree / Range patterns
patternTrie.insert('range', 'Range Query Optimization');
patternTrie.insert('segment', 'Range Query Optimization');
patternTrie.insert('interval', 'Range Query Optimization');

// Balanced Tree patterns
patternTrie.insert('lower_bound', 'Ordered Access/Insert');
patternTrie.insert('upper_bound', 'Ordered Access/Insert');
patternTrie.insert('ordered', 'Ordered Access/Insert');

// Skip List patterns
patternTrie.insert('skiplist', 'Linked List Fast Search Optimization');

// ── End of Trie Initialization ──

export interface PatternMatch {
    isPriorityQueueCandidate: boolean;
    isTrieCandidate: boolean;
    isSegmentTreeCandidate: boolean;
    isBalancedTreeCandidate: boolean;
    isSkipListCandidate: boolean;
    detectedPatternLabel: string | null;
    /** The Trie-detected keyword hint (if any) for explainability */
    trieHint: string | null;
}

export function detectPatterns(varName: string, lines: string[], context: Context): PatternMatch {
    let sortCount = 0;
    let maxMinExtractCount = 0;
    
    let prefixSearchCount = 0;
    let stringOpsCount = 0;
    
    let rangeQueryCount = 0;
    let rangeUpdateCount = 0;
    
    let orderedInsertCount = 0;
    let listSearchCount = 0;

    // Trie-based keyword hint — fast O(k) check per line comment/identifier
    let trieHint: string | null = null;

    const escapedVar = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Regex Definitions
    const sortRegex = new RegExp(`std::sort\\(${escapedVar}\\.begin\\(\\),?\\s*${escapedVar}\\.end\\(\\)\\)`, 'g');
    const extractRegex = new RegExp(`${escapedVar}\\.(pop_back|back|front|pop_front)\\(\\)|std::max_element\\(${escapedVar}`, 'g');
    
    const prefixRegex = new RegExp(`${escapedVar}.*substr|${escapedVar}.*find|startsWith|prefix`, 'gi');
    const stringOpRegex = new RegExp(`string\\s+.*${escapedVar}|${escapedVar}.*length`, 'gi');
    
    const rangeLoopRegex = /for\s*\(\s*(?:int|size_t|auto)\s+\w+\s*=\s*\w+;\s*\w+\s*<\s*\w+;\s*(?:\+\+\w+|\w+\+\+)\s*\)/g;
    const arrayAccessRegex = new RegExp(`${escapedVar}\\[\\w+\\]`, 'g');
    
    const lowerBoundRegex = new RegExp(`std::lower_bound\\(${escapedVar}\\.begin\\(\\)|${escapedVar}\\.lower_bound\\(`, 'g');
    const insertRegex = new RegExp(`${escapedVar}\\.(insert|push_back|emplace)\\(`, 'g');
    
    const listSearchRegex = new RegExp(`std::find\\(${escapedVar}\\.begin\\(\\),?\\s*${escapedVar}\\.end\\(\\)`, 'g');

    for (const line of lines) {
        if (line.match(sortRegex)) sortCount++;
        if (line.match(extractRegex)) maxMinExtractCount++;
        
        if (line.match(prefixRegex)) prefixSearchCount++;
        if (line.match(stringOpRegex)) stringOpsCount++;

        // Range query heuristic: loop with array access to this var
        if (line.match(rangeLoopRegex) && line.match(arrayAccessRegex)) {
            if (line.includes('+') || line.includes('-') || line.includes('*')) {
                rangeQueryCount++;
            }
            if (line.includes('=')) {
                rangeUpdateCount++;
            }
        }

        if (line.match(lowerBoundRegex)) orderedInsertCount++;
        if (line.match(insertRegex)) orderedInsertCount++;
        if (line.match(listSearchRegex)) listSearchCount++;

        // ── Trie-based keyword detection on comments and identifiers ──
        // Scan each word token in the line through the Trie for O(k) matching
        if (!trieHint) {
            const tokens = line.replace(/[^a-zA-Z_]/g, ' ').split(/\s+/);
            for (const token of tokens) {
                if (token.length >= 3) {
                    const hit = patternTrie.search(token);
                    if (hit) {
                        trieHint = hit;
                        break;
                    }
                }
            }
        }
    }

    // Evaluation
    const isPriorityQueueCandidate = (sortCount >= 1 && maxMinExtractCount >= 1) || sortCount > 2;
    const isTrieCandidate = prefixSearchCount >= 1 && stringOpsCount >= 1;
    const isSegmentTreeCandidate = rangeQueryCount >= 1 && rangeUpdateCount >= 1;
    const isBalancedTreeCandidate = context.hasOrdering && orderedInsertCount >= 2;
    const isSkipListCandidate = context.hasOrdering && listSearchCount >= 1;

    let detectedPatternLabel = null;
    if (isSegmentTreeCandidate) detectedPatternLabel = 'Range Query Optimization';
    else if (isSkipListCandidate) detectedPatternLabel = 'Linked List Fast Search Optimization';
    else if (isTrieCandidate) detectedPatternLabel = 'Prefix String Search';
    else if (isPriorityQueueCandidate) detectedPatternLabel = 'Repeated Extrema Extraction';
    else if (isBalancedTreeCandidate) detectedPatternLabel = 'Ordered Access/Insert';

    // If no regex pattern matched but the Trie found a keyword hint, use it
    if (!detectedPatternLabel && trieHint) {
        detectedPatternLabel = trieHint;
    }

    return {
        isPriorityQueueCandidate,
        isTrieCandidate,
        isSegmentTreeCandidate,
        isBalancedTreeCandidate,
        isSkipListCandidate,
        detectedPatternLabel,
        trieHint
    };
}
