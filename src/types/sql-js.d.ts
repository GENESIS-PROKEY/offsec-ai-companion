declare module 'sql.js' {
    type SqlValue = string | number | null | Uint8Array;

    interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
    }

    interface Database {
        run(sql: string, params?: SqlValue[]): Database;
        exec(sql: string, params?: SqlValue[]): QueryExecResult[];
        prepare(sql: string): Statement;
        export(): Uint8Array;
        close(): void;
    }

    interface Statement {
        bind(params?: SqlValue[]): boolean;
        step(): boolean;
        getAsObject(params?: Record<string, SqlValue>): Record<string, SqlValue>;
        free(): boolean;
        reset(): void;
    }

    interface QueryExecResult {
        columns: string[];
        values: SqlValue[][];
    }

    export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
    export type { Database, Statement, SqlJsStatic, QueryExecResult, SqlValue };
}
