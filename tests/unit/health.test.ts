// Unit tests for health server
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing
vi.mock('../../src/config/index.js', () => ({
    config: {
        monitoring: { healthPort: 0 }, // port 0 = OS picks random port
        ai: {},
        discord: { token: 'test', clientId: 'test' },
        database: { sqlitePath: './test.db', chromaHost: 'localhost', chromaPort: 8000 },
        rag: { topK: 10, rerankTop: 5, confidenceThreshold: 0.6, chunkSize: 512, chunkOverlap: 50 },
        features: { webDashboard: false, analytics: false, communitySubmissions: false },
        rateLimit: { perUser: 10, windowMs: 60000 },
    },
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

import { getStats, incrementErrorCount, startHealthServer } from '../../src/services/health.js';
import http from 'node:http';

describe('Health Module', () => {
    describe('getStats()', () => {
        it('returns correct shape', () => {
            const stats = getStats();
            expect(stats).toHaveProperty('status');
            expect(stats).toHaveProperty('uptime');
            expect(stats).toHaveProperty('memory');
            expect(stats).toHaveProperty('errors');
            expect(stats).toHaveProperty('node');
            expect(stats).toHaveProperty('timestamp');
        });

        it('status is healthy initially', () => {
            expect(getStats().status).toBe('healthy');
        });

        it('uptime.ms is a positive number', () => {
            expect(getStats().uptime.ms).toBeGreaterThan(0);
        });

        it('memory has heap and rss values', () => {
            const { memory } = getStats();
            expect(memory.heapUsedMB).toBeGreaterThan(0);
            expect(memory.heapTotalMB).toBeGreaterThan(0);
            expect(memory.rssMB).toBeGreaterThan(0);
        });

        it('node version matches process.version', () => {
            expect(getStats().node).toBe(process.version);
        });
    });

    describe('incrementErrorCount()', () => {
        it('increments the error counter', () => {
            const before = getStats().errors.total;
            incrementErrorCount('test error');
            const after = getStats().errors.total;
            expect(after).toBe(before + 1);
        });

        it('stores the last error message', () => {
            incrementErrorCount('specific error msg');
            expect(getStats().errors.lastMessage).toBe('specific error msg');
        });

        it('updates lastAt timestamp', () => {
            incrementErrorCount('another error');
            expect(getStats().errors.lastAt).not.toBeNull();
        });
    });

    describe('HTTP Server', () => {
        let server: http.Server;
        let port: number;

        // Start on random port
        beforeEach(async () => {
            server = startHealthServer(0);
            await new Promise<void>(resolve => {
                server.on('listening', () => {
                    const addr = server.address();
                    port = typeof addr === 'object' && addr ? addr.port : 0;
                    resolve();
                });
            });
        });

        afterEach(async () => {
            await new Promise<void>(resolve => server.close(() => resolve()));
        });

        it('GET /health returns 200 with JSON', async () => {
            const res = await fetch(`http://localhost:${port}/health`);
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('application/json');

            const body = await res.json();
            expect(body.status).toBe('healthy');
            expect(body.uptime).toBeDefined();
        });

        it('GET /unknown returns 404', async () => {
            const res = await fetch(`http://localhost:${port}/unknown`);
            expect(res.status).toBe(404);
        });

        it('POST /health returns 404 (wrong method)', async () => {
            const res = await fetch(`http://localhost:${port}/health`, { method: 'POST' });
            expect(res.status).toBe(404);
        });
    });
});
