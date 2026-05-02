export class Monitor {
    public insertCount: number = 0;
    public searchCount: number = 0;
    public deleteCount: number = 0;
    public totalOperations: number = 0;

    constructor(
        public readonly variableName: string,
        public currentStructure: string
    ) {}

    public recordInsert() {
        this.insertCount++;
        this.totalOperations++;
    }

    public recordSearch() {
        this.searchCount++;
        this.totalOperations++;
    }

    public recordDelete() {
        this.deleteCount++;
        this.totalOperations++;
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
}
