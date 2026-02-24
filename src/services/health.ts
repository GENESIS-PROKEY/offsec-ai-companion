// Health Check HTTP Server — lightweight monitoring endpoint
// No Express dependency, uses Node built-in http module

import http from 'node:http';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { llmQueue } from './queue.js';

// ─── Error Counter ──────────────────────────────────────────────────

let errorCount = 0;
let lastErrorMessage = '';
let lastErrorAt = 0;
const startedAt = Date.now();

/** Increment the global error counter. Call from catch blocks. */
export function incrementErrorCount(message?: string) {
    errorCount++;
    lastErrorMessage = message ?? 'Unknown';
    lastErrorAt = Date.now();
}

/** Get current health stats. */
export function getStats() {
    const uptimeMs = Date.now() - startedAt;
    const memUsage = process.memoryUsage();

    return {
        status: errorCount > 50 ? 'degraded' : 'healthy',
        uptime: {
            ms: uptimeMs,
            human: formatDuration(uptimeMs),
        },
        memory: {
            heapUsedMB: +(memUsage.heapUsed / 1024 / 1024).toFixed(2),
            heapTotalMB: +(memUsage.heapTotal / 1024 / 1024).toFixed(2),
            rssMB: +(memUsage.rss / 1024 / 1024).toFixed(2),
        },
        errors: {
            total: errorCount,
            lastMessage: lastErrorMessage || null,
            lastAt: lastErrorAt ? new Date(lastErrorAt).toISOString() : null,
        },
        queue: llmQueue.stats,
        node: process.version,
        timestamp: new Date().toISOString(),
    };
}

function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

// ─── HTTP Server ────────────────────────────────────────────────────

export function startHealthServer(port?: number): http.Server {
    const healthPort = port ?? config.monitoring?.healthPort ?? 3001;

    const server = http.createServer((req, res) => {
        if (req.url === '/health' && req.method === 'GET') {
            const stats = getStats();
            res.writeHead(stats.status === 'healthy' ? 200 : 503, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            });
            res.end(JSON.stringify(stats, null, 2));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found. Try GET /health' }));
        }
    });

    server.listen(healthPort, () => {
        logger.info({ port: healthPort, endpoint: '/health' }, '🏥 Health monitor started');
    });

    return server;
}
