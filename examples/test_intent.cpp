#include <iostream>
#include <vector>
#include <list>
#include <map>
#include <set>
#include <algorithm>
#include <string>

using namespace std;

// 1. Frequency Counting Intent
// Current structure: std::map (Suboptimal for pure counting without ordering)
// Expected Suggestion: std::unordered_map
// Intent Triggered: frequency_counting
void testFrequencyCounting(const vector<string>& words) {
    map<string, int> wordCounts;
    
    // The "frequency counting" intent regex looks for varName[...]++
    for (const string& word : words) {
        wordCounts[word]++;
        wordCounts[word] += 1;
    }
}

// 2. Lookup Heavy Intent
// Current structure: std::vector (O(N) search)
// Expected Suggestion: std::unordered_set
// Intent Triggered: lookup_heavy
void testLookupHeavy(int target1, int target2, int target3) {
    vector<int> numbers;
    numbers.push_back(10);
    numbers.push_back(20);
    numbers.push_back(30);

    // The "lookup heavy" intent looks for multiple find/count calls
    auto it1 = std::find(numbers.begin(), numbers.end(), target1);
    auto it2 = std::find(numbers.begin(), numbers.end(), target2);
    auto it3 = std::find(numbers.begin(), numbers.end(), target3);
    auto it4 = std::find(numbers.begin(), numbers.end(), 50);
}

// 3. Sorted Iteration Intent
// Current structure: std::unordered_set (Cannot maintain sorted order naturally)
// Expected Suggestion: std::set
// Intent Triggered: sorted_iteration
void testSortedIteration() {
    // Unordered sets don't guarantee order, sorting them is generally a code smell
    // or requires copying. Let's pretend it's a vector acting as a set.
    vector<int> dataStore;
    dataStore.push_back(5);
    dataStore.push_back(1);
    dataStore.push_back(10);
    dataStore.push_back(2);

    // Sort + Iterate pattern
    std::sort(dataStore.begin(), dataStore.end());
    
    for (int val : dataStore) {
        cout << val << " ";
    }
}

// 4. Sequential Access / Accumulator Intent
// Current structure: std::list (O(N) search, bad cache locality)
// Expected Suggestion: std::vector
// Intent Triggered: accumulator / sequential_access
void testAccumulator() {
    list<int> sequence;
    sequence.push_back(1);
    sequence.push_back(2);
    sequence.push_back(3);
    sequence.push_back(4);

    int sum = 0;
    // Sequential iteration
    for(auto x : sequence) {
        // We aren't doing any mid-list inserts/deletes, just sequential access
        sum += x;
    }
    
    // Another iteration
    for(auto it = sequence.begin(); it != sequence.end(); ++it) {
        sum += *it;
    }
}

// 5. Mixed Workload / List Suggestion
// Current structure: std::vector
// Expected Suggestion: std::list (Mixed inserts and deletes)
void testMixedWorkload() {
    vector<int> buffer;
    
    // Front/middle insertions and deletions trigger list recommendation
    buffer.insert(buffer.begin(), 10);
    buffer.push_front(20); // Note: vector doesn't strictly have push_front, but our regex catches the semantic intent
    buffer.erase(buffer.begin());
    buffer.insert(buffer.begin(), 30);
    buffer.pop_front();
}

int main() {
    return 0;
}
