import { describe, it, expect, beforeEach } from 'vitest';

// We test the queue logic by importing and exercising the class directly
// Since the module exports a singleton, we'll test the class pattern

describe('LLM Queue (Concurrency Limiter)', () => {
    // We'll create a fresh queue for each test by importing the module factory
    let acquire: () => Promise<void>;
    let release: () => void;
    let stats: () => { running: number; queued: number; max: number };

    beforeEach(async () => {
        // Dynamic import to get a fresh module is not practical with singletons,
        // so we test the exported singleton's behavior with sequential acquire/release.
        const mod = await import('../../src/services/queue.js');
        const queue = mod.llmQueue;

        // Reset by releasing any held slots
        while (queue.stats.running > 0) {
            queue.release();
        }

        acquire = () => queue.acquire();
        release = () => queue.release();
        stats = () => queue.stats;
    });

    it('should allow up to max concurrent acquisitions', async () => {
        await acquire();
        await acquire();
        expect(stats().running).toBe(2);
        expect(stats().queued).toBe(0);

        release();
        release();
        expect(stats().running).toBe(0);
    });

    it('should queue requests beyond max concurrent', async () => {
        await acquire();
        await acquire();

        // Third acquire should not resolve immediately
        let thirdResolved = false;
        const thirdPromise = acquire().then(() => { thirdResolved = true; });

        // Give microtask queue a tick
        await new Promise(r => setTimeout(r, 10));
        expect(thirdResolved).toBe(false);
        expect(stats().queued).toBe(1);

        // Release one slot — third should now resolve
        release();
        await thirdPromise;
        expect(thirdResolved).toBe(true);
        expect(stats().running).toBe(2);
        expect(stats().queued).toBe(0);

        release();
        release();
    });

    it('should report correct stats', async () => {
        expect(stats().max).toBe(2);
        expect(stats().running).toBe(0);
        expect(stats().queued).toBe(0);

        await acquire();
        expect(stats().running).toBe(1);

        release();
    });

    it('should process queued requests in FIFO order', async () => {
        const order: number[] = [];

        await acquire();
        await acquire();

        const p1 = acquire().then(() => { order.push(1); });
        const p2 = acquire().then(() => { order.push(2); });
        const p3 = acquire().then(() => { order.push(3); });

        release(); // should resolve p1
        await p1;
        release(); // should resolve p2
        await p2;
        release(); // should resolve p3
        await p3;

        expect(order).toEqual([1, 2, 3]);

        release();
        release();
    });
});
