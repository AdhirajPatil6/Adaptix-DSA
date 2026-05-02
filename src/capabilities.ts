export interface DSCapability {
    supportsIndex: boolean;
    supportsOrdering: boolean;
    fastSequential: boolean;
    fastSearch: boolean;
    fastInsertDelete: boolean;
}

export const DS_CAPABILITIES: Record<string, DSCapability> = {
    'std::vector': {
        supportsIndex: true,
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: false,
        fastInsertDelete: false // except at the back
    },
    'std::list': {
        supportsIndex: false,
        supportsOrdering: true,
        fastSequential: false, // terrible cache locality
        fastSearch: false,
        fastInsertDelete: true
    },
    'std::map': {
        supportsIndex: false, // it has operator[] but it's not a sequential index
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: true, // O(log n) is fast enough
        fastInsertDelete: false
    },
    'std::unordered_map': {
        supportsIndex: false,
        supportsOrdering: false,
        fastSequential: false,
        fastSearch: true, // O(1)
        fastInsertDelete: false
    },
    'std::set': {
        supportsIndex: false,
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: true,
        fastInsertDelete: false
    },
    'std::unordered_set': {
        supportsIndex: false,
        supportsOrdering: false,
        fastSequential: false,
        fastSearch: true,
        fastInsertDelete: false
    },
    'std::deque': {
        supportsIndex: true,
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: false,
        fastInsertDelete: true // at both ends
    }
};
