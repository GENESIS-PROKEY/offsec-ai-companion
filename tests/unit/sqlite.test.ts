import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase, dbRun, dbGet, dbAll, closeDatabase } from '../../src/db/sqlite.js';

describe('SQLite Database Helpers', () => {
    beforeAll(async () => {
        // Force environment to use in-memory database
        process.env.SQLITE_PATH = ':memory:';
        await getDatabase();
    });

    afterAll(() => {
        closeDatabase();
    });

    it('should initialize schema with users table', () => {
        const result = dbGet("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        expect(result).toBeDefined();
        expect(result?.name).toBe('users');
    });

    it('should initialize schema with interactions table', () => {
        const result = dbGet("SELECT name FROM sqlite_master WHERE type='table' AND name='interactions'");
        expect(result).toBeDefined();
        expect(result?.name).toBe('interactions');
    });

    it('should insert and retrieve a user', () => {
        dbRun("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)", ['test-user-1', 'tester']);
        const user = dbGet("SELECT * FROM users WHERE user_id = ?", ['test-user-1']);
        expect(user).toBeDefined();
        expect(user?.username).toBe('tester');
        expect(user?.preferred_level).toBe('beginner');
    });

    it('should return undefined for missing rows', () => {
        const result = dbGet("SELECT * FROM users WHERE user_id = ?", ['nonexistent']);
        expect(result).toBeUndefined();
    });

    it('should return multiple rows with dbAll', () => {
        dbRun("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)", ['test-user-2', 'alice']);
        dbRun("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)", ['test-user-3', 'bob']);
        const rows = dbAll("SELECT * FROM users WHERE user_id IN (?, ?)", ['test-user-2', 'test-user-3']);
        expect(rows.length).toBe(2);
    });

    it('should handle schema idempotency', async () => {
        // Reinitializing should not throw
        await getDatabase();
        const tables = dbAll("SELECT name FROM sqlite_master WHERE type='table'");
        expect(tables.length).toBeGreaterThanOrEqual(3); // users, interactions, history_summaries
    });
});
