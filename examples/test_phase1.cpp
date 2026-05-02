#include <iostream>
#include <vector>
#include <list>
#include <map>
#include <set>
#include <unordered_map>
#include <algorithm>
#include <string>

using namespace std;

/**
 * ADAPTIX PHASE 1 TEST CASES
 * Tests context flags, safety filter, and logical gap fixes
 */

// TEST 1: usesIndexAccess flag
// v[i] should be detected as index access, NOT insert
// Safety filter should block suggestions that don't support O(1) index access
void test_index_access() {
    vector<int> scores;
    scores.push_back(90);
    scores.push_back(85);
    scores.push_back(95);

    // These are index accesses, not inserts!
    scores[0] = 100;
    scores[1] = 88;
    int val = scores[2];

    // Adaptix should: usesIndexAccess = true
    // Should NOT suggest list/set (no index access support)
}

// TEST 2: hasOrdering flag blocks unordered suggestions
// Using sort means we need ordering — don't suggest unordered_map
void test_ordering_required() {
    vector<int> rankings;
    rankings.push_back(5);
    rankings.push_back(2);
    rankings.push_back(8);
    
    std::sort(rankings.begin(), rankings.end());
    auto it = std::lower_bound(rankings.begin(), rankings.end(), 3);

    // Adaptix should: hasOrdering = true
    // Safety filter should BLOCK unordered_map/unordered_set
}

// TEST 3: sequentialIteration flag
// Range-based for loop detected → prefer vector over list
void test_sequential_iteration() {
    list<int> data;
    data.push_back(1);
    data.push_back(2);
    data.push_back(3);

    // Range-based for loop
    for (auto x : data) {
        cout << x << endl;
    }

    // Adaptix should: sequentialIteration = true
    // Safety filter should BLOCK list suggestion (poor cache locality)
}

// TEST 4: Iterator-based for loop detection
void test_iterator_loop() {
    vector<int> items;
    items.push_back(10);
    items.push_back(20);

    for (auto it = items.begin(); it != items.end(); ++it) {
        cout << *it << endl;
    }

    // Adaptix should: sequentialIteration = true
}

// TEST 5: v[i] = x is NOT insert (logical gap fix)
// Before fix: v[i] = x counted as insert → inflated insert ratio
// After fix: v[i] = x counted as search/access
void test_index_write_not_insert() {
    vector<int> buffer;
    buffer.push_back(0);
    buffer.push_back(0);
    buffer.push_back(0);

    // These should be ACCESS, not INSERT
    buffer[0] = 42;
    buffer[1] = 43;
    buffer[2] = 44;

    // Expected: 3 inserts (push_back) + 3 searches (index writes)
    // NOT: 6 inserts (old wrong behavior)
}

// TEST 6: mp[key] = val IS insert for maps
void test_map_index_is_insert() {
    map<string, int> wordCount;
    wordCount["hello"] = 1;
    wordCount["world"] = 2;
    wordCount["test"] = 3;

    // These ARE inserts for map (creates new entries)
    // Expected: 3 inserts
    // Search-heavy access to trigger suggestion:
    int a = wordCount["hello"];
    int b = wordCount["world"];
    int c = wordCount["test"];
    int d = wordCount["hello"];
    int e = wordCount["world"];
}

int main() {
    test_index_access();
    test_ordering_required();
    test_sequential_iteration();
    test_iterator_loop();
    test_index_write_not_insert();
    test_map_index_is_insert();

    cout << "Phase 1 tests complete!" << endl;
    return 0;
}
