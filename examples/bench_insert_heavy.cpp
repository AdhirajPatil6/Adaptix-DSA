// ============================================================
// BENCHMARK: Insert-Heavy Workload (90% insert, 10% search)
// Tests: vector vs deque vs list vs unordered_set
// Expected: vector/deque win (amortized O(1) push_back)
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

    // 90% inserts
    for (int i = 0; i < n; i++) {
        data.push_back(i * 3 + 7);
    }

    // 10% searches (at end)
    int found = 0;
    int searchCount = n / 10;
    for (int i = 0; i < searchCount; i++) {
        int target = i * 3 + 7;
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
