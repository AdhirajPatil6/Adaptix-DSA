#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

// ADAPTIX ADVANCED DS HEURISTIC TEST SUITE

void testPriorityQueue() {
    vector<int> numbers;
    for (int i = 0; i < 100; i++) {
        numbers.push_back(rand() % 1000);
        // Repeated sorting and max extraction
        sort(numbers.begin(), numbers.end());
        int max_val = numbers.back();
        numbers.pop_back();
        cout << max_val << "\n";
    }
}

void testTrie() {
    vector<string> dictionary = {"apple", "app", "application", "banana"};
    string prefix = "app";
    
    // Prefix string searching
    for (int i = 0; i < dictionary.size(); i++) {
        if (dictionary[i].find(prefix) == 0) {
            cout << "Found prefix in: " << dictionary[i] << "\n";
        }
    }
}

void testSegmentTree() {
    vector<int> array_data = {1, 3, 5, 7, 9, 11};
    
    // Range queries and updates
    for (int i = 0; i < 3; i++) {
        int sum = 0;
        for (int j = 1; j < 5; j++) {
            sum += array_data[j]; // Access and aggregate
        }
        array_data[2] = 10; // Update
    }
}

void testBalancedTree() {
    vector<int> ordered_data;
    ordered_data.push_back(10);
    ordered_data.push_back(5);
    
    // Ordered insert and search
    auto it = std::lower_bound(ordered_data.begin(), ordered_data.end(), 7);
    ordered_data.insert(it, 7);
}

int main() {
    testPriorityQueue();
    testTrie();
    testSegmentTree();
    testBalancedTree();
    return 0;
}
