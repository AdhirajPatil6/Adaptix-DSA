/**
 * Advanced Data Structure Templates
 * 
 * Provides predefined fallback implementations for advanced algorithmic structures
 * in case the AI semantic engine is unavailable or fails validation.
 */

export const DS_TEMPLATES: Record<string, string> = {
    'priority_queue': `std::priority_queue<int> pq;`,
    'Trie': `struct TrieNode {
    std::unordered_map<char, TrieNode*> children;
    bool isEnd = false;
};`,
    'Segment Tree': `std::vector<int> segTree;`
};
