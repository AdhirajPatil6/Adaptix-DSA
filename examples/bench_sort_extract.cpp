// ============================================================
// BENCHMARK: Sort + Extract Pattern (repeated sort + pop)
// Tests: vector (sort) vs priority_queue (heap)
// Expected: priority_queue wins massively (O(log n) vs O(N log N))
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

int solve(int n) {
    vector<int> data;

    // Insert N elements in random-ish order
    for (int i = 0; i < n; i++) {
        data.push_back((i * 37 + 13) % n);
    }

    // Repeatedly: sort the entire array, extract the max, remove it
    int totalExtracted = 0;
    int extractCount = n / 4;

    for (int i = 0; i < extractCount && !data.empty(); i++) {
        sort(data.begin(), data.end());
        totalExtracted += data.back();
        data.pop_back();
    }

    return totalExtracted;
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

    cout << "\nResult: " << result << " total extracted" << endl;
    cout << "Time: " << duration.count() << " microseconds" << endl;
    cout << "Memory: " << (mem_after - mem_before) << " KB" << endl;

    return 0;
}
