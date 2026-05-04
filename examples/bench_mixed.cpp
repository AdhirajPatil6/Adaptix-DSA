// ============================================================
// BENCHMARK: Mixed Balanced Workload (33% insert, 33% search, 33% delete)
// Tests: vector vs set vs unordered_set
// Expected: unordered_set/set wins for balanced workloads
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
    int ops = 0;

    // Phase 1: Insert N elements
    for (int i = 0; i < n; i++) {
        data.push_back(i * 2);
        ops++;
    }

    // Phase 2: Search N/3 elements
    int searchCount = n / 3;
    for (int i = 0; i < searchCount; i++) {
        int target = (i * 3) * 2;
        auto it = find(data.begin(), data.end(), target);
        if (it != data.end()) ops++;
    }

    // Phase 3: Delete N/3 elements from middle
    int deleteCount = n / 3;
    for (int i = 0; i < deleteCount && !data.empty(); i++) {
        int mid = data.size() / 2;
        data.erase(data.begin() + mid);
        ops++;
    }

    return ops;
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

    cout << "\nResult: " << result << " operations" << endl;
    cout << "Time: " << duration.count() << " microseconds" << endl;
    cout << "Memory: " << (mem_after - mem_before) << " KB" << endl;

    return 0;
}
