// ============================================================
// BENCHMARK: Delete-Heavy Workload (30% insert, 20% search, 50% delete)
// Tests: vector vs list vs set
// Expected: list/set wins (O(1) or O(log n) delete vs O(N) shift)
// ============================================================
#include <iostream>
#include <vector>
#include <chrono>
#include <algorithm>
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

    // Phase 1: Insert elements
    for (int i = 0; i < n; i++) {
        data.push_back(i);
    }

    // Phase 2: Interleave search and delete
    int found = 0;
    int deleted = 0;

    // 20% searches
    int searchCount = n / 5;
    for (int i = 0; i < searchCount; i++) {
        int target = i * 5;
        auto it = find(data.begin(), data.end(), target);
        if (it != data.end()) found++;
    }

    // 50% deletes (remove from front — worst case for vector)
    int deleteCount = n / 2;
    for (int i = 0; i < deleteCount && !data.empty(); i++) {
        data.erase(data.begin());
        deleted++;
    }

    return found + deleted;
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
