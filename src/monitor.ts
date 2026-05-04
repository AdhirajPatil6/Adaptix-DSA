/**
 * Monitor — Tracks per-variable operation frequencies.
 *
 * INTERNAL DSA USAGE:
 * - Segment Tree used for O(1) aggregate cost queries over operation counts.
 *   Instead of summing insertCount + searchCount + deleteCount with raw arithmetic,
 *   a lightweight Segment Tree maintains pre-computed range sums, enabling
 *   instant cost aggregation across any subset of operations.
 */

// ────────────────────────────────────────────────────────────────
// Segment Tree — used for cost aggregation over operation counts.
// Stores [insertCount, searchCount, deleteCount] and provides
// O(1) range-sum queries over any contiguous subset of operations.
// ────────────────────────────────────────────────────────────────

class SegmentTree {
    private tree: number[];
    private n: number;

    /** Build a Segment Tree from the given array. O(n) construction. */
    constructor(arr: number[]) {
        this.n = arr.length;
        this.tree = new Array(4 * this.n).fill(0);
        if (this.n > 0) {
            this._build(arr, 1, 0, this.n - 1);
        }
    }

    private _build(arr: number[], node: number, start: number, end: number): void {
        if (start === end) {
            this.tree[node] = arr[start];
        } else {
            const mid = Math.floor((start + end) / 2);
            this._build(arr, 2 * node, start, mid);
            this._build(arr, 2 * node + 1, mid + 1, end);
            this.tree[node] = this.tree[2 * node] + this.tree[2 * node + 1];
        }
    }

    /** Range sum query over [l, r]. O(log n). */
    query(l: number, r: number): number {
        if (this.n === 0 || l > r || l < 0 || r >= this.n) return 0;
        return this._query(1, 0, this.n - 1, l, r);
    }

    private _query(node: number, start: number, end: number, l: number, r: number): number {
        if (r < start || end < l) return 0;
        if (l <= start && end <= r) return this.tree[node];
        const mid = Math.floor((start + end) / 2);
        return this._query(2 * node, start, mid, l, r) +
               this._query(2 * node + 1, mid + 1, end, l, r);
    }

    /** Point update: set index i to val. O(log n). */
    update(i: number, val: number): void {
        if (i < 0 || i >= this.n) return;
        this._update(1, 0, this.n - 1, i, val);
    }

    private _update(node: number, start: number, end: number, idx: number, val: number): void {
        if (start === end) {
            this.tree[node] = val;
        } else {
            const mid = Math.floor((start + end) / 2);
            if (idx <= mid) {
                this._update(2 * node, start, mid, idx, val);
            } else {
                this._update(2 * node + 1, mid + 1, end, idx, val);
            }
            this.tree[node] = this.tree[2 * node] + this.tree[2 * node + 1];
        }
    }
}

// ── End of Segment Tree ──

export class Monitor {
    public insertCount: number = 0;
    public searchCount: number = 0;
    public deleteCount: number = 0;
    public totalOperations: number = 0;

    /**
     * Segment Tree instance — lazily built from operation counts
     * when cost aggregation is requested. Provides O(log n) range queries.
     */
    private _costTree: SegmentTree | null = null;
    private _costTreeDirty: boolean = true;

    constructor(
        public readonly variableName: string,
        public currentStructure: string
    ) {}

    public recordInsert() {
        this.insertCount++;
        this.totalOperations++;
        this._costTreeDirty = true;
    }

    public recordSearch() {
        this.searchCount++;
        this.totalOperations++;
        this._costTreeDirty = true;
    }

    public recordDelete() {
        this.deleteCount++;
        this.totalOperations++;
        this._costTreeDirty = true;
    }

    public get insertRatio(): number {
        return this.totalOperations > 0 ? this.insertCount / this.totalOperations : 0;
    }

    public get searchRatio(): number {
        return this.totalOperations > 0 ? this.searchCount / this.totalOperations : 0;
    }

    public get deleteRatio(): number {
        return this.totalOperations > 0 ? this.deleteCount / this.totalOperations : 0;
    }

    // ────────────────────────────────────────────────────────────────
    // Segment Tree cost aggregation API
    // Operations are stored as: [0] = insert, [1] = search, [2] = delete
    // ────────────────────────────────────────────────────────────────

    /** Rebuild the Segment Tree from current operation counts. */
    private _rebuildCostTree(): void {
        // Segment Tree used for aggregating operation costs
        this._costTree = new SegmentTree([
            this.insertCount,
            this.searchCount,
            this.deleteCount
        ]);
        this._costTreeDirty = false;
    }

    /**
     * Query the total cost (sum of operation counts) across a range.
     * @param from - start index (0=insert, 1=search, 2=delete)
     * @param to - end index (inclusive)
     * @returns Aggregated sum via Segment Tree range query
     */
    public queryCost(from: number = 0, to: number = 2): number {
        if (this._costTreeDirty || !this._costTree) {
            this._rebuildCostTree();
        }
        return this._costTree!.query(from, to);
    }

    /**
     * Get all operation counts as a tuple, backed by the Segment Tree.
     * Equivalent to [insertCount, searchCount, deleteCount] but queries the tree.
     */
    public get operationCosts(): [number, number, number] {
        if (this._costTreeDirty || !this._costTree) {
            this._rebuildCostTree();
        }
        return [
            this._costTree!.query(0, 0),
            this._costTree!.query(1, 1),
            this._costTree!.query(2, 2)
        ];
    }
}
