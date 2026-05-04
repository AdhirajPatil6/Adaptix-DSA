// ============================================================
// BENCHMARK: Search-Heavy Workload (20% insert, 80% search)
// Tests: vector vs unordered_set vs set
// Expected: unordered_set wins at large N (O(1) vs O(N))
// ============================================================
#include <iostream>
#include <vector>
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

    // 20% inserts
    for (int i = 0; i < n; i++) {
        data.push_back(i * 2 + 1);
    }

    // 80% searches
    int found = 0;
    int searchCount = n * 4;
    for (int i = 0; i < searchCount; i++) {
        int target = (i % n) * 2 + 1;
        for (int j = 0; j < (int)data.size(); j++) {
            if (data[j] == target) {
                found++;
                break;
            }
        }
    }

    return found;
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

    cout << "\nResult: " << result << " found" << endl;
    cout << "Time: " << duration.count() << " microseconds" << endl;
    cout << "Memory: " << (mem_after - mem_before) << " KB" << endl;

    return 0;
}
