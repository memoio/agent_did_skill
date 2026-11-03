import { DatabaseSync } from "node:sqlite";
export declare class Store {
    readonly db: DatabaseSync;
    constructor(path: string);
    private createTables;
    private migrateInstallations;
    transaction<T>(work: () => T): T;
    close(): void;
}
