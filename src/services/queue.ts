// LLM Request Queue — semaphore-based concurrency limiter
// Prevents rate limit storms by capping parallel LLM calls
// Default: max 2 concurrent requests, rest queued FIFO

import { logger } from '../utils/logger.js';

interface QueueWaiter {
    resolve: () => void;
}

class LLMQueue {
    private running = 0;
    private waiting: QueueWaiter[] = [];

    constructor(private readonly maxConcurrent: number = 2) { }

    /**
     * Acquire a slot. Resolves immediately if under limit,
     * otherwise waits until a slot is released.
     */
    async acquire(): Promise<void> {
        if (this.running < this.maxConcurrent) {
            this.running++;
            return;
        }

        // Queue this request
        return new Promise<void>(resolve => {
            this.waiting.push({ resolve });
        });
    }

    /**
     * Release a slot. If anyone is waiting, wake the next in FIFO order.
     */
    release(): void {
        const next = this.waiting.shift();
        if (next) {
            // Hand the slot directly to the next waiter (running count stays the same)
            next.resolve();
        } else {
            this.running--;
        }
    }

    /** Current queue statistics for health monitoring. */
    get stats(): { running: number; queued: number; max: number } {
        return {
            running: this.running,
            queued: this.waiting.length,
            max: this.maxConcurrent,
        };
    }
}

export const llmQueue = new LLMQueue(2);

logger.info({ maxConcurrent: 2 }, 'LLM request queue initialized');
