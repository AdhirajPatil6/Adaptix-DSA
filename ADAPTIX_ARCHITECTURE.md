# ADAPTIX: Adaptive Data Structure Intelligence Engine
**Comprehensive Architecture & Logic Reference Guide**

---

## 1. Introduction & Core Philosophy
Adaptix is an advanced, real-time developer assistant functioning as a VS Code Extension. It is specifically designed to solve a ubiquitous problem in C++ algorithmic development: developers frequently instantiate suboptimal data structures (e.g., defaulting to `std::vector` or `std::list`) without properly measuring the computational complexity of the operations they later execute on those structures. 

Adaptix continuously statically analyzes the code buffer, evaluates the ratio of operations (Insertion, Searching, Deletion), calculates mathematical `O(N)` algorithmic costs, and proposes—or automatically executes—optimal structural refactors with measurable speedups.

---

## 2. Comprehensive Technology Stack
The entire extension operates locally, executing lightning-fast synchronous queries utilizing the VS Code API.

- **Language Engine**: TypeScript (Targeting `ES2022`, strict typing).
- **Runtime Environment**: Visual Studio Code Extension Host API (Compatibility: `^1.90.0`+).
- **Diagnostic Engine**: `vscode.languages.registerCodeActionsProvider` & `vscode.DiagnosticCollection`.
- **UI Rendering Context**: Native VS Code Webview (`WebviewViewProvider`).
- **Styling**: Vanilla HTML5, CSS3 Variables (matching VS Code's native Theme Engine via `vscode-style`), and custom keyframe animations.
- **Code Mutation Engine**: VS Code `WorkspaceEdit` API (for Abstract Syntax Tree-like precision).

---

## 3. Deep-Dive Subsystem Architecture

Adaptix's internal architecture is designed around a strictly decoupled pipeline: 
**Code Stream → Static Regex Analyzer → Decision Heuristics Matrix → UI Rendering → Global State Lifecycle.**

### A. The Static Analyzer (`src/analyzer.ts`)
The Analysis engine leverages high-speed Regex lookarounds rather than heavy AST (Abstract Syntax Tree) parsing, ensuring microsecond execution speeds suitable for real-time keystroke listeners.

- **Declaration Capture**: 
  The engine first scans the text buffer for standard template library declarations.
  *Regex Target*: `/(?:std::)?(vector|list|set|map|unordered_map|unordered_set)<[^>]+>\s+([a-zA-Z_]\w*)/g`
  *Capture*: Acquires the `currentStructure` (e.g., `vector`) and the `variableName` (e.g., `database_log`).

- **Operation Mapping Matrix**:
  Once a variable name is identified, it maps subsequent invocations of that variable to specific behavioral buckets:
  1. **Insert Operations**: `push_back`, `insert`, `emplace_back`, `emplace_front`
  2. **Search Operations**: `find`, `at`, `[]`, `count`
  3. **Delete Operations**: `erase`, `pop_back`, `clear`
  4. **Ordering Operations**: `sort`, `upper_bound`, `lower_bound`

- **Context Instantiation**:
  It aggregates these mapped operations into an `AnalysisContext` which contains a `Monitor` object exposing: `totalOperations`, `insertRatio`, `searchRatio`, and `deleteRatio`.

### B. The Decision Engine & Heuristics Matrix (`src/decision.ts`)
This is the mathematical core of the engine. It relies on a two-pass algorithm.

#### Phase 1: Boolean Rule Evaluation
The engine processes the aggregated ratios against pre-defined optimization gates:
- **Hash Evaluation**: If `searchRatio > 0.6` and `hasOrdering == false`, it immediately flags the necessity for `std::unordered_map` / `std::unordered_set`.
- **Contiguous Memory Evaluation**: If `insertRatio > 0.6` and `hasOrdering == false`, it routes to `std::vector` to leverage CPU Cache locality and amortized `O(1)` back-insertions.
- **Node Detachment Evaluation**: If `deleteRatio > 0.3` and `insertRatio > 0.3`, it routes to a `std::list` (doubly-linked) to eliminate contiguous array shifting payloads `O(N)`.

#### Phase 2: Mathematical Speedup Calculation
If a suggestion triggers, Adaptix mathematically validates it.
- **Cost Weights**: The engine maps structural limits: `O(1) = 1`, `O(log N) = 5`, `O(N) = 100`.
- **Formulas**: 
  `CurrentCost = (InsertCount * CurrentVectorInsertCost) + (SearchCount * CurrentVectorSearchCost)`
  `ProposedCost = (InsertCount * ProposedMapInsertCost) + (SearchCount * ProposedMapSearchCost)`
- **Validation**: If `CurrentCost > ProposedCost`, the recommendation is validated. The system then outputs the exact calculated performance Delta: `Speedup = CurrentCost / ProposedCost` (e.g. `"Speedup: 12.0x faster"`).

### C. Live Diagnostics UI Sidebar (`src/ui.ts`)
Adaptix translates backend complexities into a seamless React-like component generated securely within the Activity Bar Webview.

- **Dynamic Data Binding**: Maintains a `_latestData` cache that seamlessly pipelines data whenever the C++ source file `onDidChangeTextDocument` triggers.
- **Feature Set**:
  - **Dominance Highlighting**: Computes `Math.max()` horizontally across the Insert/Search/Delete ratios. The winning CSS flexbar automatically scales and pulses brighter.
  - **Complexity Expandables**: Uses raw `<details>` and `<summary>` HTML wrappers to showcase granular "Explain Decision" elements without cluttering the screen real-estate.
  - **Refactor Messaging Pipeline**: Houses the `vscode.postMessage` wrapper inside the "Apply Refactor" button `onclick` trigger.

### D. Central Lifecycle Controller (`src/extension.ts`)
The `activate` function acts as the root orchestrator executing the data pipeline perfectly across the VS Code ecosystem.

- **State Management**:
  Retains the `currentAnalysis: Map<string, AnalysisContext>` and `globalHistory: AdaptationRecord[]`.
- **Event Hooking**:
  Binds `triggerUpdate()` to:
  1. `vscode.window.activeTextEditor` (Initially on file open)
  2. `vscode.workspace.onDidChangeTextDocument` (Fires continuously to provide the illusion of real-time insights).
- **Workspace Edit Mutation**:
  Listens for the `adaptix.applyRefactor` command (sent by the Webview payload). 
  It calculates the exact `startPos` and `endPos` lengths inside the C++ file buffer relative to the parsed Regex matches, constructs a `vscode.WorkspaceEdit()`, calls `.replace()`, and executes `vscode.workspace.applyEdit()`. It finally mutates the `globalHistory` array by pushing a timestamped success log for the dashboard.

---

## 4. End-to-End Workflow Example (The Data Pipeline)

1. **User action**: Types `active_users.at(0)` in their C++ document.
2. **Event Trigger**: `extension.ts` detects the keystroke via `onDidChangeTextDocument`.
3. **Analyzer**: `analyzer.ts` identifies `active_users` was declared as a `vector<int>`. It spots `.at()` and iterates `searchCount` from 0 to 1.
4. **Decision Generation**: `decision.ts` realizes `searchRatio` is now 100%. It calculates that vector search (`O(N) = 100`) is more expensive than an unordered_map search (`O(1) = 1`). It validates the rule `search_ratio > 0.6`.
5. **View Update**: `extension.ts` pipes the `DecisionResult` to `ui.ts`.
6. **UI Rendering**: The sidebar re-renders the Webview HTML. `Vector (Array-based)` shows an Orange Warning, highlighting a `100.0x faster` speedup to `Hash Map`.
7. **Refactoring**: The user hits `Apply Refactor`.
8. **Transformation**: `ui.ts` blasts a message payload to `extension.ts`. `WorkspaceEdit` isolates the word `vector` and statically swaps it for `unordered_map` live inside the file without corrupting surrounding brackets. The change is instantly logged to the History panel.
