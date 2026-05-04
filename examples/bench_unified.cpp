// ============================================================
// ADAPTIX Interactive Demo
// Creates a random array, then lets you insert/search/delete
// with live timing, memory, and result output
// ============================================================
#include <iostream>
#include <vector>
#include <chrono>
#include <algorithm>
#include <cstdlib>
#include <ctime>
#include <sys/resource.h>

using namespace std;
using namespace std::chrono;

long getMemoryKB() {
    struct rusage usage;
    getrusage(RUSAGE_SELF, &usage);
    return usage.ru_maxrss / 1024;  // Convert to KB
}

void printArray(const vector<int>& data, int maxShow = 15) {
    int sz = (int)data.size();
    int show = min(sz, maxShow);
    cout << "  Array: [";
    for (int i = 0; i < show; i++) {
        if (i > 0) cout << ", ";
        cout << data[i];
    }
    if (sz > maxShow) cout << ", ... +" << (sz - maxShow) << " more";
    cout << "]" << endl;
    cout << "  Size:  " << sz << " elements" << endl;
}

int main() {
    srand(time(0));

    int n;
    cout << "╔═══════════════════════════════════════════╗" << endl;
    cout << "║       ADAPTIX — Interactive Demo          ║" << endl;
    cout << "╚═══════════════════════════════════════════╝" << endl;

    cout << "\n  Enter array size: ";
    cin >> n;

    // Create array with random values (1 to n*10)
    vector<int> data;
    long memBefore = getMemoryKB();
    auto buildStart = high_resolution_clock::now();

    for (int i = 0; i < n; i++) {
        data.push_back(rand() % (n * 10) + 1);
    }

    auto buildEnd = high_resolution_clock::now();
    long memAfter = getMemoryKB();
    auto buildTime = duration_cast<microseconds>(buildEnd - buildStart);

    cout << "\n  ✓ Created array of " << n << " random values" << endl;
    cout << "  Build Time:   " << buildTime.count() << " µs" << endl;
    cout << "  Memory Used:  " << (memAfter - memBefore) << " KB" << endl;
    printArray(data);

    // Interactive menu
    int choice, value;
    while (true) {
        cout << "\n═══════════════════════════════════════════" << endl;
        cout << "  1. Insert a value" << endl;
        cout << "  2. Search for a value" << endl;
        cout << "  3. Delete a value" << endl;
        cout << "  4. Show array" << endl;
        cout << "  5. Exit" << endl;
        cout << "═══════════════════════════════════════════" << endl;
        cout << "  Enter choice: ";
        cin >> choice;

        if (choice == 5) {
            cout << "\n  Goodbye!\n" << endl;
            break;
        }

        if (choice == 4) {
            printArray(data);
            continue;
        }

        if (choice < 1 || choice > 5) {
            cout << "  ⚠ Invalid choice. Try 1-5." << endl;
            continue;
        }

        cout << "  Enter value: ";
        cin >> value;

        long mem1 = getMemoryKB();

        if (choice == 1) {
            // INSERT
            auto start = high_resolution_clock::now();

            data.push_back(value);

            auto end = high_resolution_clock::now();
            long mem2 = getMemoryKB();
            auto dur = duration_cast<nanoseconds>(end - start);

            cout << "\n  ┌─── INSERT RESULT ───────────────────┐" << endl;
            cout << "  │  Value:     " << value << endl;
            cout << "  │  Position:  index " << data.size() - 1 << " (end)" << endl;
            cout << "  │  New Size:  " << data.size() << endl;
            cout << "  │  Time:      " << dur.count() << " ns" << endl;
            cout << "  │  Memory:    " << (mem2 - mem1) << " KB" << endl;
            cout << "  │  Answer:    ✓ Inserted successfully" << endl;
            cout << "  └───────────────────────────────────────┘" << endl;
        }
        else if (choice == 2) {
            // SEARCH
            auto start = high_resolution_clock::now();

            auto it = find(data.begin(), data.end(), value);

            auto end = high_resolution_clock::now();
            long mem2 = getMemoryKB();
            auto dur = duration_cast<nanoseconds>(end - start);

            cout << "\n  ┌─── SEARCH RESULT ───────────────────┐" << endl;
            cout << "  │  Target:    " << value << endl;
            if (it != data.end()) {
                int idx = (int)(it - data.begin());
                cout << "  │  Answer:    ✓ FOUND at index " << idx << endl;
                cout << "  │  Value:     data[" << idx << "] = " << *it << endl;
            } else {
                cout << "  │  Answer:    ✗ NOT FOUND" << endl;
            }
            cout << "  │  Scanned:   " << data.size() << " elements" << endl;
            cout << "  │  Time:      " << dur.count() << " ns" << endl;
            cout << "  │  Memory:    " << (mem2 - mem1) << " KB" << endl;
            cout << "  └───────────────────────────────────────┘" << endl;
        }
        else if (choice == 3) {
            // DELETE
            auto start = high_resolution_clock::now();

            auto it = find(data.begin(), data.end(), value);
            bool found = (it != data.end());
            int idx = -1;
            if (found) {
                idx = (int)(it - data.begin());
                data.erase(it);
            }

            auto end = high_resolution_clock::now();
            long mem2 = getMemoryKB();
            auto dur = duration_cast<nanoseconds>(end - start);

            cout << "\n  ┌─── DELETE RESULT ───────────────────┐" << endl;
            cout << "  │  Target:    " << value << endl;
            if (found) {
                cout << "  │  Answer:    ✓ DELETED from index " << idx << endl;
                cout << "  │  New Size:  " << data.size() << endl;
            } else {
                cout << "  │  Answer:    ✗ NOT FOUND, nothing deleted" << endl;
            }
            cout << "  │  Time:      " << dur.count() << " ns" << endl;
            cout << "  │  Memory:    " << (mem2 - mem1) << " KB" << endl;
            cout << "  └───────────────────────────────────────┘" << endl;
        }
    }

    return 0;
}
