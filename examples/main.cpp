#include <iostream>
#include <vector>
#include <algorithm>
#include <string>

int main() {
    // Current usage: std::vector for lookups
    std::vector<int> myData;
    
    // Population
    for (int i = 0; i < 100; ++i) {
        myData.push_back(i);
    }

    // Frequent searches
    // Adaptix should detect these 'find' operations and suggest std::unordered_set or std::unordered_map
    for (int i = 0; i < 200; ++i) {
        auto it = std::find(myData.begin(), myData.end(), i);
        if (it != myData.end()) {
            std::cout << "Found: " << *it << std::endl;
        }
    }

    return 0;
}
