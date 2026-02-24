// Response cache — LRU eviction + periodic cleanup to reduce LLM API calls
// Prevents redundant calls for identical queries within the TTL window

interface CacheEntry {
    value: string;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 200;
const CLEANUP_INTERVAL_MS = 60_000; // purge expired entries every 60s

/**
 * Get a cached response, or null if expired/missing.
 * Moves the key to the end of the Map (LRU refresh).
 */
export function getCached(key: string): string | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    // LRU refresh: delete + re-insert moves key to Map end
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
}

/**
 * Store a response in the cache with a TTL.
 * Evicts the least-recently-used entry if cache is full.
 */
export function setCache(key: string, value: string, ttlMs = DEFAULT_TTL_MS): void {
    // Evict LRU entry (first key in Map = least recently used)
    if (cache.size >= MAX_ENTRIES) {
        const lruKey = cache.keys().next().value;
        if (lruKey) cache.delete(lruKey);
    }
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Build a normalized cache key from command + query + level.
 */
export function makeCacheKey(command: string, query: string, level: string): string {
    return `${command}:${level}:${query.toLowerCase().trim()}`;
}

/**
 * Get cache stats for health monitoring.
 */
export function getCacheStats(): { size: number; maxSize: number } {
    return { size: cache.size, maxSize: MAX_ENTRIES };
}

/**
 * Clear all cache entries (used in tests).
 */
export function clearCache(): void {
    cache.clear();
}

// ─── Periodic Cleanup ───────────────────────────────────────────────
// Purge expired entries every 60s to prevent memory leaks
// from unique queries that are never re-requested.

const cleanupTimer = setInterval(() => {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of cache) {
        if (now > entry.expiresAt) {
            cache.delete(key);
            purged++;
        }
    }
    // Only log if we actually purged something (avoid noise)
    if (purged > 0) {
        // Dynamic import to avoid circular deps at module load
        import('../utils/logger.js').then(({ logger }) => {
            logger.debug({ purged, remaining: cache.size }, 'Cache cleanup: purged expired entries');
        }).catch(() => { /* logger not available yet */ });
    }
}, CLEANUP_INTERVAL_MS);

// Don't block process exit
cleanupTimer.unref();
