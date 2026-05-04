// ============================================================
// BENCHMARK: Ordered Iteration Workload (insert + sort + iterate)
// Tests: vector+sort vs set (auto-sorted)
// Expected: set wins (no explicit sort needed)
// ============================================================
#include <iostream>
#include <vector>
#include <algorithm>
#include <chrono>
#include <sys/resource.h>

using namespace std;
using namespace std::chrono;

long getMemoryUsage() {
    struct rusage usage;
    getrusage(RUSAGE_SELF, &usage);
    return usage.ru_maxrss;
}

long long solve(int n) {
    vector<int> data;

    // Insert in scrambled order
    for (int i = 0; i < n; i++) {
        data.push_back((i * 71 + 29) % n);
    }

    // Sort then iterate (common pattern)
    sort(data.begin(), data.end());

    long long sum = 0;
    for (auto it = data.begin(); it != data.end(); ++it) {
        sum += *it;
    }

    // Insert more, re-sort, iterate again
    for (int i = 0; i < n / 2; i++) {
        data.push_back(n + i);
    }
    sort(data.begin(), data.end());

    for (auto it = data.begin(); it != data.end(); ++it) {
        sum += *it;
    }

    return sum;
}

int main() {
    int n;
    cout << "Enter size: ";
    cin >> n;

    auto start = high_resolution_clock::now();
    long mem_before = getMemoryUsage();

    long long result = solve(n);

    long mem_after = getMemoryUsage();
    auto end = high_resolution_clock::now();

    auto duration = duration_cast<microseconds>(end - start);

    cout << "\nResult: " << result << endl;
    cout << "Time: " << duration.count() << " microseconds" << endl;
    cout << "Memory: " << (mem_after - mem_before) << " KB" << endl;

    return 0;
}
