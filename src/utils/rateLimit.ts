// Configurable rate limiter — extracted for testability and reuse

import { config } from '../config/index.js';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

export class RateLimiter {
    private limits = new Map<string, RateLimitEntry>();
    private maxRequests: number;
    private windowMs: number;

    constructor(maxRequests?: number, windowMs?: number) {
        this.maxRequests = maxRequests ?? config.rateLimit.perUser;
        this.windowMs = windowMs ?? config.rateLimit.windowMs;
    }

    /**
     * Check if a user is rate-limited. Increments the counter.
     * Returns true if the user should be blocked.
     */
    check(userId: string): boolean {
        const now = Date.now();
        const entry = this.limits.get(userId);

        if (!entry || now > entry.resetAt) {
            this.limits.set(userId, { count: 1, resetAt: now + this.windowMs });
            return false;
        }

        entry.count++;
        return entry.count > this.maxRequests;
    }

    /** Reset a specific user's rate limit. */
    reset(userId: string): void {
        this.limits.delete(userId);
    }

    /** Clear all rate limit data. */
    resetAll(): void {
        this.limits.clear();
    }

    /** Get remaining requests for a user (0 = blocked). */
    remaining(userId: string): number {
        const now = Date.now();
        const entry = this.limits.get(userId);
        if (!entry || now > entry.resetAt) return this.maxRequests;
        return Math.max(0, this.maxRequests - entry.count);
    }
}
