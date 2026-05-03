/**
 * Heuristic Pattern Detector
 * 
 * Analyzes code for algorithmic patterns that suggest the use of
 * advanced data structures like Priority Queues, Tries, and Segment Trees.
 */

import { Context } from './context';

export interface PatternMatch {
    isPriorityQueueCandidate: boolean;
    isTrieCandidate: boolean;
    isSegmentTreeCandidate: boolean;
    isBalancedTreeCandidate: boolean;
    isSkipListCandidate: boolean;
    detectedPatternLabel: string | null;
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

    return {
        isPriorityQueueCandidate,
        isTrieCandidate,
        isSegmentTreeCandidate,
        isBalancedTreeCandidate,
        isSkipListCandidate,
        detectedPatternLabel
    };
}
