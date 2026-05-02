import { Monitor } from './monitor';
import { getComplexityWeight } from './decision'; // We will export this from decision.ts

export interface SimulationResult {
    speedGain: number; // multiplier (e.g., 2.5x)
    memoryImpact: 'Lower' | 'Similar' | 'Higher';
    featureLoss: string[];
}

function getMemoryFootprint(ds: string): number {
    if (ds.includes('vector')) return 1.0;
    if (ds.includes('deque')) return 1.2;
    if (ds.includes('list')) return 3.0; // pointers overhead
    if (ds.includes('set') || ds.includes('map')) return 4.0; // tree node overhead
    if (ds.includes('unordered')) return 5.0; // hash table overhead
    return 1.0;
}

export function simulateChange(current: string, candidate: string, monitor: Monitor): SimulationResult {
    const currentCost = 
        (monitor.insertCount * getComplexityWeight(current, 'insert')) +
        (monitor.searchCount * getComplexityWeight(current, 'search')) +
        (monitor.deleteCount * getComplexityWeight(current, 'delete'));

    const candidateCost = 
        (monitor.insertCount * getComplexityWeight(candidate, 'insert')) +
        (monitor.searchCount * getComplexityWeight(candidate, 'search')) +
        (monitor.deleteCount * getComplexityWeight(candidate, 'delete'));

    const speedGain = currentCost / Math.max(candidateCost, 1);

    const curMem = getMemoryFootprint(current);
    const canMem = getMemoryFootprint(candidate);
    
    let memoryImpact: 'Lower' | 'Similar' | 'Higher' = 'Similar';
    if (canMem > curMem * 1.5) memoryImpact = 'Higher';
    else if (canMem < curMem * 0.7) memoryImpact = 'Lower';

    const featureLoss: string[] = [];
    if (current.includes('vector') && !candidate.includes('vector')) {
        featureLoss.push('Contiguous memory layout');
    }
    if ((current.includes('map') || current.includes('set')) && !current.includes('unordered') && candidate.includes('unordered')) {
        featureLoss.push('Sorted element traversal');
    }

    return {
        speedGain,
        memoryImpact,
        featureLoss
    };
}
