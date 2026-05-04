export interface DSCapability {
    supportsIndex: boolean;
    supportsOrdering: boolean;
    fastSequential: boolean;
    fastSearch: boolean;
    fastInsertDelete: boolean;
    isSequence: boolean;
    isStringOnly: boolean;
}

export const DS_CAPABILITIES: Record<string, DSCapability> = {
    'std::vector': {
        supportsIndex: true,
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: false,
        fastInsertDelete: false,
        isSequence: true,
        isStringOnly: false
    },
    'std::list': {
        supportsIndex: false,
        supportsOrdering: true,
        fastSequential: false,
        fastSearch: false,
        fastInsertDelete: true,
        isSequence: true,
        isStringOnly: false
    },
    'std::map': {
        supportsIndex: false,
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: true,
        fastInsertDelete: false,
        isSequence: false,
        isStringOnly: false
    },
    'std::unordered_map': {
        supportsIndex: false,
        supportsOrdering: false,
        fastSequential: false,
        fastSearch: true,
        fastInsertDelete: false,
        isSequence: false,
        isStringOnly: false
    },
    'std::set': {
        supportsIndex: false,
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: true,
        fastInsertDelete: false,
        isSequence: false,
        isStringOnly: false
    },
    'std::unordered_set': {
        supportsIndex: false,
        supportsOrdering: false,
        fastSequential: false,
        fastSearch: true,
        fastInsertDelete: false,
        isSequence: false,
        isStringOnly: false
    },
    'std::deque': {
        supportsIndex: true,
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: false,
        fastInsertDelete: true,
        isSequence: true,
        isStringOnly: false
    },
    'std::priority_queue': {
        supportsIndex: false,
        supportsOrdering: true,
        fastSequential: false,
        fastSearch: false,
        fastInsertDelete: true,
        isSequence: true,
        isStringOnly: false
    },
    'Trie': {
        supportsIndex: false,
        supportsOrdering: false,
        fastSequential: false,
        fastSearch: true,
        fastInsertDelete: true,
        isSequence: true,
        isStringOnly: true
    },
    'Segment Tree': {
        supportsIndex: true,
        supportsOrdering: false,
        fastSequential: false,
        fastSearch: true,
        fastInsertDelete: true,
        isSequence: true,
        isStringOnly: false
    },
    'Skip List': {
        supportsIndex: false,
        supportsOrdering: true,
        fastSequential: true,
        fastSearch: true,
        fastInsertDelete: true,
        isSequence: true,
        isStringOnly: false
    }
};
