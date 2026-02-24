// Unit tests for RateLimiter class
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing RateLimiter
vi.mock('../../src/config/index.js', () => ({
    config: {
        rateLimit: { perUser: 3, windowMs: 1000 }, // 3 requests per 1 second for fast tests
        ai: {},
        discord: { token: 'test', clientId: 'test' },
        database: { sqlitePath: './test.db', chromaHost: 'localhost', chromaPort: 8000 },
        rag: { topK: 10, rerankTop: 5, confidenceThreshold: 0.6, chunkSize: 512, chunkOverlap: 50 },
        features: { webDashboard: false, analytics: false, communitySubmissions: false },
        monitoring: { healthPort: 3001 },
    },
}));

import { RateLimiter } from '../../src/utils/rateLimit.js';

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        limiter = new RateLimiter(3, 1000); // 3 requests per 1 second
    });

    afterEach(() => {
        limiter.resetAll();
    });

    it('allows the first request', () => {
        expect(limiter.check('user1')).toBe(false);
    });

    it('allows up to maxRequests', () => {
        expect(limiter.check('user1')).toBe(false); // 1st
        expect(limiter.check('user1')).toBe(false); // 2nd
        expect(limiter.check('user1')).toBe(false); // 3rd - at limit
    });

    it('blocks requests exceeding the limit', () => {
        limiter.check('user1'); // 1
        limiter.check('user1'); // 2
        limiter.check('user1'); // 3
        expect(limiter.check('user1')).toBe(true); // 4th = blocked
    });

    it('keeps different users independent', () => {
        limiter.check('user1'); // user1: 1
        limiter.check('user1'); // user1: 2
        limiter.check('user1'); // user1: 3
        expect(limiter.check('user1')).toBe(true); // user1: blocked

        // user2 is fresh
        expect(limiter.check('user2')).toBe(false);
    });

    it('resets window after expiry', async () => {
        limiter = new RateLimiter(2, 50); // 2 per 50ms

        limiter.check('user1'); // 1
        limiter.check('user1'); // 2
        expect(limiter.check('user1')).toBe(true); // blocked

        // Wait for window to expire
        await new Promise(r => setTimeout(r, 60));

        expect(limiter.check('user1')).toBe(false); // window reset
    });

    it('reset() clears a specific user', () => {
        limiter.check('user1'); // 1
        limiter.check('user1'); // 2
        limiter.check('user1'); // 3
        expect(limiter.check('user1')).toBe(true); // blocked

        limiter.reset('user1');
        expect(limiter.check('user1')).toBe(false); // fresh
    });

    it('remaining() returns correct count', () => {
        expect(limiter.remaining('user1')).toBe(3);
        limiter.check('user1');
        expect(limiter.remaining('user1')).toBe(2);
        limiter.check('user1');
        expect(limiter.remaining('user1')).toBe(1);
        limiter.check('user1');
        expect(limiter.remaining('user1')).toBe(0);
    });

    it('resetAll() clears all users', () => {
        limiter.check('user1');
        limiter.check('user1');
        limiter.check('user1');
        limiter.check('user2');
        limiter.check('user2');

        limiter.resetAll();

        expect(limiter.remaining('user1')).toBe(3);
        expect(limiter.remaining('user2')).toBe(3);
    });
});
