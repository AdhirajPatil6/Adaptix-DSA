import { Monitor } from './monitor';
import { Constraints } from './constraints';

/**
 * Generates a high-level developer insight about their code pattern.
 */
export function generateInsight(monitor: Monitor, constraints: Constraints, currentStructure: string): string | null {
    if (monitor.insertRatio > 0.4 && monitor.deleteRatio > 0.4 && constraints.prefersSequential) {
        return "You are using this structure like a queue or sliding window.";
    }
    
    if (monitor.searchRatio > 0.7 && !constraints.needsOrdering) {
        return "This pattern resembles a lookup table or frequency counter.";
    }

    if (monitor.insertRatio > 0.8 && currentStructure.includes('vector') && !constraints.needsIndexAccess) {
        return "Append-only data store detected. Vector is well-suited for this.";
    }

    if (constraints.needsOrdering && monitor.insertRatio > 0.5) {
        return "Heavy insertions while maintaining sort order. Consider if strict ordering is required during the insertion phase.";
    }

    if (constraints.needsIndexAccess && monitor.deleteRatio > 0.2 && currentStructure.includes('vector')) {
        return "Random access combined with deletions. Deleting from the middle of a vector causes expensive O(N) shifts.";
    }

    return null;
}
