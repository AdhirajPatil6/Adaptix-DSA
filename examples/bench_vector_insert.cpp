// ADAPTIX Test: Vector with heavy insert + delete → should suggest deque or list
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

int solve(int n, int insertCount) {
    vector<int> data;

    // Heavy front insert + erase workload
    for (int i = 0; i < n; i++) {
        data.insert(data.begin(), i);  // O(N) shift every time
    }

    int erased = 0;
    for (int i = 0; i < insertCount && !data.empty(); i++) {
        data.erase(data.begin());  // O(N) shift every time
        erased++;
    }

    return erased;
}

int main() {
    int n, eraseCount;
    cout << "Enter size: ";
    cin >> n;
    cout << "Enter erase count: ";
    cin >> eraseCount;

    long mem_before = getMemoryUsage();
    auto start = high_resolution_clock::now();

    int result = solve(n, eraseCount);

    auto end = high_resolution_clock::now();
    long mem_after = getMemoryUsage();

    cout << "\nResult: " << result << endl;
    cout << "Time: " << duration_cast<microseconds>(end - start).count() << " microseconds" << endl;
    cout << "Memory: " << (mem_after - mem_before) << " KB" << endl;
    return 0;
}
