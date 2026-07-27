/**
 * @typedef {object} DbAdapter
 * @property {(sql: string) => Promise<void>} exec  Run DDL or multi-statement SQL.
 * @property {(sql: string, params?: unknown[]) => Promise<object[]>} query  Rows as plain objects.
 * @property {(sql: string, params?: unknown[]) => Promise<{changes: number}>} run  Single write.
 * @property {<T>(fn: () => Promise<T>) => Promise<T>} transaction  Commits, or rolls back on throw.
 * @property {() => Promise<void>} close
 */
export {};
