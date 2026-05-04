// ============================================================
// BENCHMARK: Frequency Counting Workload (map[key]++ pattern)
// Tests: map vs unordered_map
// Expected: unordered_map wins (O(1) vs O(log n))
// ============================================================
#include <iostream>
#include <vector>
#include <map>
#include <chrono>
#include <sys/resource.h>

using namespace std;
using namespace std::chrono;

long getMemoryUsage() {
    struct rusage usage;
    getrusage(RUSAGE_SELF, &usage);
    return usage.ru_maxrss;
}

int solve(int n) {
    map<int, int> freq;

    // Insert + frequency counting
    for (int i = 0; i < n; i++) {
        int key = (i * 37) % (n / 3 + 1);
        freq[key]++;
    }

    // Find the most frequent element
    int maxKey = 0, maxCount = 0;
    for (auto& pair : freq) {
        if (pair.second > maxCount) {
            maxCount = pair.second;
            maxKey = pair.first;
        }
    }

    // Search for specific keys
    int found = 0;
    for (int i = 0; i < n / 2; i++) {
        if (freq.find(i) != freq.end()) {
            found++;
        }
    }

    return maxKey + found;
}

int main() {
    int n;
    cout << "Enter size: ";
    cin >> n;

    auto start = high_resolution_clock::now();
    long mem_before = getMemoryUsage();

    int result = solve(n);

    long mem_after = getMemoryUsage();
    auto end = high_resolution_clock::now();

    auto duration = duration_cast<microseconds>(end - start);

    cout << "\nResult: " << result << endl;
    cout << "Time: " << duration.count() << " microseconds" << endl;
    cout << "Memory: " << (mem_after - mem_before) << " KB" << endl;

    return 0;
}
