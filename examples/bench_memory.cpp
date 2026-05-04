// ============================================================
// ADAPTIX Memory Optimization Demo
// Compares memory usage across data structures for same data
// Uses calculated memory (per-element sizes) for accurate output
// ============================================================
#include <iostream>
#include <vector>
#include <list>
#include <set>
#include <unordered_set>
#include <deque>
#include <chrono>
#include <algorithm>
#include <cstdlib>
#include <ctime>
#include <string>

using namespace std;
using namespace std::chrono;

// Known per-element memory costs (bytes) on 64-bit systems
// These are the real costs including node overhead, pointers, alignment
struct DSInfo {
    string name;
    string complexity_insert;
    string complexity_search;
    string complexity_delete;
    long bytesPerElem;    // actual bytes consumed per element
};

DSInfo dsInfo[] = {
    {"vector<int>",        "O(1)*",    "O(n)",      "O(n)",     4  },   // 4 bytes per int, contiguous
    {"list<int>",          "O(1)",     "O(n)",      "O(1)",     24 },   // int + prev/next ptrs + alloc overhead
    {"set<int>",           "O(log n)", "O(log n)",  "O(log n)", 40 },   // RB-tree node: val + 3 ptrs + color + padding
    {"unordered_set<int>", "O(1)*",    "O(1)*",     "O(1)*",    36 },   // hash node + bucket ptr + value
    {"deque<int>",         "O(1)",     "O(n)",      "O(n)",     4  },   // 4 bytes per int in chunks
};
const int NUM_DS = 5;

long calcMemoryKB(int n, int dsIndex) {
    return (dsInfo[dsIndex].bytesPerElem * (long)n) / 1024;
}

long calcMemoryBytes(int n, int dsIndex) {
    return dsInfo[dsIndex].bytesPerElem * (long)n;
}

void printMemoryTable(int sizes[]) {
    cout << "\n  ╔═══════════════════════════════════════════════════════════════════════╗" << endl;
    cout << "  ║                     MEMORY USAGE COMPARISON                          ║" << endl;
    cout << "  ╠═══════════════════════════════════════════════════════════════════════╣" << endl;
    cout << "  ║  Structure           Elements   Per-Elem   Total Memory   vs Vector  ║" << endl;
    cout << "  ║  ───────────────────  ────────   ────────   ────────────   ─────────  ║" << endl;

    long baseBytes = calcMemoryBytes(sizes[0], 0);  // vector as baseline

    for (int i = 0; i < NUM_DS; i++) {
        long totalBytes = calcMemoryBytes(sizes[i], i);
        long totalKB = totalBytes / 1024;
        double ratio = (baseBytes > 0) ? (double)totalBytes / baseBytes : 0;

        string ratioStr;
        if (ratio <= 1.01 && ratio >= 0.99) ratioStr = "  baseline";
        else {
            char buf[32];
            snprintf(buf, sizeof(buf), "  %.1fx", ratio);
            ratioStr = buf;
            if (ratio > 1.01) ratioStr += " MORE";
            else ratioStr += " LESS";
        }

        printf("  ║  %-20s %7d    %4ld B     %7ld KB    %-12s ║\n",
               dsInfo[i].name.c_str(), sizes[i], dsInfo[i].bytesPerElem, totalKB, ratioStr.c_str());
    }

    cout << "  ║                                                                       ║" << endl;

    // Show savings
    long vectorKB = calcMemoryBytes(sizes[0], 0) / 1024;
    long setKB = calcMemoryBytes(sizes[2], 2) / 1024;
    long usetKB = calcMemoryBytes(sizes[3], 3) / 1024;

    if (vectorKB > 0) {
        printf("  ║  💡 Switching set → vector saves:            %7ld KB (%ld%% less)    ║\n",
               setKB - vectorKB, (setKB - vectorKB) * 100 / setKB);
        printf("  ║  💡 Switching unordered_set → vector saves:  %7ld KB (%ld%% less)    ║\n",
               usetKB - vectorKB, (usetKB - vectorKB) * 100 / usetKB);
    }

    cout << "  ╚═══════════════════════════════════════════════════════════════════════╝" << endl;
}

int main() {
    srand(time(0));

    int n;
    cout << "╔═══════════════════════════════════════════╗" << endl;
    cout << "║    ADAPTIX — Memory Optimization Demo     ║" << endl;
    cout << "╚═══════════════════════════════════════════╝" << endl;

    cout << "\n  Enter array size: ";
    cin >> n;

    // Create same random data in all structures
    vector<int> randomValues;
    for (int i = 0; i < n; i++) {
        randomValues.push_back(rand() % (n * 10) + 1);
    }

    auto buildStart = high_resolution_clock::now();

    vector<int> vec(randomValues.begin(), randomValues.end());
    list<int> lst(randomValues.begin(), randomValues.end());
    set<int> st(randomValues.begin(), randomValues.end());
    unordered_set<int> ust(randomValues.begin(), randomValues.end());
    deque<int> dq(randomValues.begin(), randomValues.end());

    auto buildEnd = high_resolution_clock::now();
    auto buildTime = duration_cast<microseconds>(buildEnd - buildStart);

    cout << "\n  ✓ Created " << n << " random elements in all 5 structures" << endl;
    cout << "  Build Time: " << buildTime.count() << " µs" << endl;
    cout << "  Sample values: ";
    for (int i = 0; i < min(5, n); i++) cout << randomValues[i] << " ";
    cout << endl;

    // Track sizes for memory calculation
    int sizes[NUM_DS];
    auto updateSizes = [&]() {
        sizes[0] = (int)vec.size();
        sizes[1] = (int)lst.size();
        sizes[2] = (int)st.size();
        sizes[3] = (int)ust.size();
        sizes[4] = (int)dq.size();
    };
    updateSizes();

    // Show initial memory
    printMemoryTable(sizes);

    // Interactive menu
    int choice, value;
    while (true) {
        cout << "\n  ═══════════════════════════════════════" << endl;
        cout << "  1. Insert a value   (compare all)" << endl;
        cout << "  2. Search a value   (compare all)" << endl;
        cout << "  3. Delete a value   (compare all)" << endl;
        cout << "  4. Memory snapshot  (full report)" << endl;
        cout << "  5. Exit" << endl;
        cout << "  ═══════════════════════════════════════" << endl;
        cout << "  Choice: ";
        cin >> choice;

        if (choice == 5) {
            cout << "\n  Final Memory Report:" << endl;
            updateSizes();
            printMemoryTable(sizes);
            cout << "  Goodbye!\n" << endl;
            break;
        }

        if (choice == 4) {
            updateSizes();
            printMemoryTable(sizes);
            continue;
        }

        if (choice < 1 || choice > 5) {
            cout << "  ⚠ Invalid. Enter 1-5." << endl;
            continue;
        }

        cout << "  Enter value: ";
        cin >> value;

        if (choice == 1) {
            // ─── INSERT ───
            cout << "\n  ┌─── INSERT " << value << " ──────────────────────────────────────────────┐" << endl;
            cout << "  │  Structure              Time        Mem Before → After    Change    │" << endl;
            cout << "  │  ─────────────────────  ──────────  ─────────────────────  ────────  │" << endl;

            // vector
            {
                long memBefore = calcMemoryKB((int)vec.size(), 0);
                auto s = high_resolution_clock::now();
                vec.push_back(value);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)vec.size(), 0);
                printf("  │  vector (push_back)     %8ld ns  %6ld KB → %6ld KB   +%ld B     │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter, dsInfo[0].bytesPerElem);
            }
            // list
            {
                long memBefore = calcMemoryKB((int)lst.size(), 1);
                auto s = high_resolution_clock::now();
                lst.push_back(value);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)lst.size(), 1);
                printf("  │  list (push_back)       %8ld ns  %6ld KB → %6ld KB   +%ld B     │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter, dsInfo[1].bytesPerElem);
            }
            // set
            {
                long memBefore = calcMemoryKB((int)st.size(), 2);
                auto s = high_resolution_clock::now();
                st.insert(value);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)st.size(), 2);
                printf("  │  set (insert)           %8ld ns  %6ld KB → %6ld KB   +%ld B     │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter, dsInfo[2].bytesPerElem);
            }
            // unordered_set
            {
                long memBefore = calcMemoryKB((int)ust.size(), 3);
                auto s = high_resolution_clock::now();
                ust.insert(value);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)ust.size(), 3);
                printf("  │  unordered_set (insert) %8ld ns  %6ld KB → %6ld KB   +%ld B     │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter, dsInfo[3].bytesPerElem);
            }
            // deque
            {
                long memBefore = calcMemoryKB((int)dq.size(), 4);
                auto s = high_resolution_clock::now();
                dq.push_back(value);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)dq.size(), 4);
                printf("  │  deque (push_back)      %8ld ns  %6ld KB → %6ld KB   +%ld B     │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter, dsInfo[4].bytesPerElem);
            }
            cout << "  └─────────────────────────────────────────────────────────────────────┘" << endl;

            updateSizes();
            cout << "\n  📊 Memory per insert: vector +4B vs list +24B vs set +40B vs uset +36B" << endl;
        }
        else if (choice == 2) {
            // ─── SEARCH ───
            cout << "\n  ┌─── SEARCH " << value << " ──────────────────────────────────────────────┐" << endl;
            cout << "  │  Structure              Time        Complexity    Memory     Result │" << endl;
            cout << "  │  ─────────────────────  ──────────  ──────────    ─────────  ────── │" << endl;

            // vector
            {
                auto s = high_resolution_clock::now();
                auto it = find(vec.begin(), vec.end(), value);
                auto e = high_resolution_clock::now();
                long mem = calcMemoryKB((int)vec.size(), 0);
                string res = (it != vec.end()) ? "FOUND" : "  N/A";
                printf("  │  vector                 %8ld ns  O(n)          %5ld KB   %s  │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), mem, res.c_str());
            }
            // list
            {
                auto s = high_resolution_clock::now();
                auto it = find(lst.begin(), lst.end(), value);
                auto e = high_resolution_clock::now();
                long mem = calcMemoryKB((int)lst.size(), 1);
                string res = (it != lst.end()) ? "FOUND" : "  N/A";
                printf("  │  list                   %8ld ns  O(n)          %5ld KB   %s  │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), mem, res.c_str());
            }
            // set
            {
                auto s = high_resolution_clock::now();
                auto it = st.find(value);
                auto e = high_resolution_clock::now();
                long mem = calcMemoryKB((int)st.size(), 2);
                string res = (it != st.end()) ? "FOUND" : "  N/A";
                printf("  │  set                    %8ld ns  O(log n)      %5ld KB   %s  │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), mem, res.c_str());
            }
            // unordered_set
            {
                auto s = high_resolution_clock::now();
                auto it = ust.find(value);
                auto e = high_resolution_clock::now();
                long mem = calcMemoryKB((int)ust.size(), 3);
                string res = (it != ust.end()) ? "FOUND" : "  N/A";
                printf("  │  unordered_set          %8ld ns  O(1)          %5ld KB   %s  │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), mem, res.c_str());
            }
            // deque
            {
                auto s = high_resolution_clock::now();
                auto it = find(dq.begin(), dq.end(), value);
                auto e = high_resolution_clock::now();
                long mem = calcMemoryKB((int)dq.size(), 4);
                string res = (it != dq.end()) ? "FOUND" : "  N/A";
                printf("  │  deque                  %8ld ns  O(n)          %5ld KB   %s  │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), mem, res.c_str());
            }
            cout << "  └─────────────────────────────────────────────────────────────────────┘" << endl;

            // Show insight
            long vecMem = calcMemoryKB((int)vec.size(), 0);
            long usetMem = calcMemoryKB((int)ust.size(), 3);
            cout << "\n  💡 unordered_set: fastest search (O(1)) but uses " << usetMem << " KB vs vector's " << vecMem << " KB" << endl;
            cout << "     Trade-off: " << (usetMem - vecMem) << " KB extra memory for instant lookups" << endl;
        }
        else if (choice == 3) {
            // ─── DELETE ───
            cout << "\n  ┌─── DELETE " << value << " ──────────────────────────────────────────────┐" << endl;
            cout << "  │  Structure              Time        Mem Before → After    Freed     │" << endl;
            cout << "  │  ─────────────────────  ──────────  ─────────────────────  ────────  │" << endl;

            // vector
            {
                long memBefore = calcMemoryKB((int)vec.size(), 0);
                auto s = high_resolution_clock::now();
                auto it = find(vec.begin(), vec.end(), value);
                bool ok = (it != vec.end());
                if (ok) vec.erase(it);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)vec.size(), 0);
                string res = ok ? "yes" : " no";
                printf("  │  vector (find+erase)    %8ld ns  %6ld KB → %6ld KB   -%ld B %s  │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter,
                    ok ? dsInfo[0].bytesPerElem : 0L, res.c_str());
            }
            // list
            {
                long memBefore = calcMemoryKB((int)lst.size(), 1);
                auto s = high_resolution_clock::now();
                auto it = find(lst.begin(), lst.end(), value);
                bool ok = (it != lst.end());
                if (ok) lst.erase(it);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)lst.size(), 1);
                string res = ok ? "yes" : " no";
                printf("  │  list (find+unlink)     %8ld ns  %6ld KB → %6ld KB   -%ld B %s │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter,
                    ok ? dsInfo[1].bytesPerElem : 0L, res.c_str());
            }
            // set
            {
                long memBefore = calcMemoryKB((int)st.size(), 2);
                auto s = high_resolution_clock::now();
                int erased = (int)st.erase(value);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)st.size(), 2);
                string res = erased ? "yes" : " no";
                printf("  │  set (erase O(log n))   %8ld ns  %6ld KB → %6ld KB   -%ld B %s │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter,
                    erased ? dsInfo[2].bytesPerElem : 0L, res.c_str());
            }
            // unordered_set
            {
                long memBefore = calcMemoryKB((int)ust.size(), 3);
                auto s = high_resolution_clock::now();
                int erased = (int)ust.erase(value);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)ust.size(), 3);
                string res = erased ? "yes" : " no";
                printf("  │  unordered_set (O(1))   %8ld ns  %6ld KB → %6ld KB   -%ld B %s │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter,
                    erased ? dsInfo[3].bytesPerElem : 0L, res.c_str());
            }
            // deque
            {
                long memBefore = calcMemoryKB((int)dq.size(), 4);
                auto s = high_resolution_clock::now();
                auto it = find(dq.begin(), dq.end(), value);
                bool ok = (it != dq.end());
                if (ok) dq.erase(it);
                auto e = high_resolution_clock::now();
                long memAfter = calcMemoryKB((int)dq.size(), 4);
                string res = ok ? "yes" : " no";
                printf("  │  deque (find+erase)     %8ld ns  %6ld KB → %6ld KB   -%ld B %s  │\n",
                    (long)duration_cast<nanoseconds>(e-s).count(), memBefore, memAfter,
                    ok ? dsInfo[4].bytesPerElem : 0L, res.c_str());
            }
            cout << "  └─────────────────────────────────────────────────────────────────────┘" << endl;

            updateSizes();
            cout << "\n  📊 Memory freed per delete: vector -4B vs list -24B vs set -40B vs uset -36B" << endl;
            cout << "     After " << (n - (int)vec.size()) << " deletes from vector: saved " 
                 << (n - (int)vec.size()) * 4 << " bytes" << endl;
        }
    }

    return 0;
}
