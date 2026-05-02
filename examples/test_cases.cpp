#include <iostream>
#include <vector>
#include <list>
#include <map>
#include <set>
#include <string>
#include <algorithm>

using namespace std;

/**
 * ADAPTIX TEST CASE: Multiple DSA inefficiencies
 */
int main() {
    // Mistake 1: Using list for heavy sequential insertion
    // Adaptix should suggest: std::vector
    list<int> database_id_log;
    for (int i = 0; i < 1000; i++) {
        database_id_log.push_back(i);
    }

    // Mistake 2: Using vector for high-frequency searching
    // Adaptix should suggest: std::unordered_map or std::unordered_set
    vector<int> active_users;
    active_users.push_back(101);
    active_users.push_back(102);
    
    // Frequent lookups in a vector are O(n)
    if (active_users.at(0) == 101) {
        cout << "User 101 is active" << endl;
    }
    // Record more searches to trigger the analyzer
    active_users.find(105); 
    active_users.at(1);

    // Mistake 3: Using map when no ordering is actually needed
    // Adaptix should suggest: std::unordered_map
    map<string, string> config_settings;
    config_settings["theme"] = "dark";
    config_settings["font"] = "Inter";
    config_settings["debug"] = "true";

    // Accessing settings frequently
    string t = config_settings["theme"];
    string f = config_settings["font"];
    string d = config_settings["debug"];

    cout << "Adaptix Analysis complete!" << endl;
    return 0;
}
