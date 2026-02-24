import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCached, setCache, makeCacheKey, getCacheStats } from '../../src/services/cache.js';

describe('Response Cache', () => {
    beforeEach(() => {
        // Clear cache between tests by setting expired entries
        // The cache module doesn't expose a clear method, so we work around it
    });

    describe('setCache + getCached', () => {
        it('should store and retrieve a value', () => {
            setCache('test-roundtrip', 'hello world');
            expect(getCached('test-roundtrip')).toBe('hello world');
        });

        it('should return null for missing keys', () => {
            expect(getCached('nonexistent-key-xyz')).toBeNull();
        });

        it('should return null for expired entries', async () => {
            setCache('test-expire', 'temp value', 50); // 50ms TTL
            expect(getCached('test-expire')).toBe('temp value');

            await new Promise(r => setTimeout(r, 60));
            expect(getCached('test-expire')).toBeNull();
        });

        it('should overwrite existing keys', () => {
            setCache('test-overwrite', 'first');
            setCache('test-overwrite', 'second');
            expect(getCached('test-overwrite')).toBe('second');
        });
    });

    describe('makeCacheKey', () => {
        it('should produce a normalized key', () => {
            expect(makeCacheKey('explain', 'What is XSS?', 'beginner'))
                .toBe('explain:beginner:what is xss?');
        });

        it('should trim whitespace', () => {
            expect(makeCacheKey('ask', '  hello  ', 'expert'))
                .toBe('ask:expert:hello');
        });

        it('should lowercase the query', () => {
            expect(makeCacheKey('explain', 'SQL Injection', 'intermediate'))
                .toBe('explain:intermediate:sql injection');
        });
    });

    describe('getCacheStats', () => {
        it('should return size and maxSize', () => {
            const stats = getCacheStats();
            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(typeof stats.size).toBe('number');
            expect(stats.maxSize).toBe(200);
        });
    });
});
