// AI Service — 6-tier Gemini fallback chain with automatic failover
// Priority: Gemini 3 Flash → 2.5 Flash → 2.5 Flash Lite (×4 keys)
// Features:
//  - 30s request timeout to prevent hanging connections
//  - Smart rate-limit cooldown (30s)
//  - Response time logging for every LLM call
//  - Connection error recovery (ECONNRESET, ETIMEDOUT, etc.)

import OpenAI from 'openai';
import { config } from '../config/index.js';
import { incrementErrorCount } from './health.js';
import { logger } from '../utils/logger.js';
import { LLMError, getErrorMessage } from '../utils/errors.js';
import { llmQueue } from './queue.js';

/** Shape of errors from OpenAI/Gemini SDKs */
interface ApiError {
    status?: number;
    code?: number | string;
    message?: string;
    error?: { code?: number | string; message?: string };
}

function asApiError(err: unknown): ApiError {
    if (typeof err === 'object' && err !== null) return err as ApiError;
    return {};
}

// ─── 6-Tier Gemini Provider System ──────────────────────────────────

type ProviderSlot = 'gemini1' | 'gemini2' | 'gemini3' | 'gemini4' | 'gemini5' | 'gemini6';

interface ProviderState {
    client: OpenAI;
    model: string;
    name: string;
    rateLimitedUntil: number;  // timestamp when rate limit expires (0 = not limited)
    isActive: boolean;         // false if credentials missing
}

// Request timeout: 30 seconds (prevents 5+ minute hangs on ECONNRESET)
const REQUEST_TIMEOUT_MS = 30_000;

// Rate limit cooldown: 30 seconds (recovers faster)
const RATE_LIMIT_COOLDOWN_MS = 30_000;

// Gemini API base URL (shared — each provider uses its own API key)
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

// Build a Gemini provider from a config slot
function buildProvider(slot: { apiKey: string; model: string }, name: string): ProviderState {
    return {
        client: new OpenAI({
            apiKey: slot.apiKey,
            baseURL: GEMINI_BASE_URL,
            timeout: REQUEST_TIMEOUT_MS,
            maxRetries: 1,
        }),
        model: slot.model,
        name,
        rateLimitedUntil: 0,
        isActive: !!(slot.apiKey && slot.model),
    };
}

// Initialize all 6 providers
const providers: Record<ProviderSlot, ProviderState> = {
    gemini1: buildProvider(config.ai.gemini1, 'Gemini 3 Flash'),
    gemini2: buildProvider(config.ai.gemini2, 'Gemini 2.5 Flash'),
    gemini3: buildProvider(config.ai.gemini3, 'Gemini 2.5 Flash Lite A'),
    gemini4: buildProvider(config.ai.gemini4, 'Gemini 2.5 Flash Lite B'),
    gemini5: buildProvider(config.ai.gemini5, 'Gemini 2.5 Flash Lite C'),
    gemini6: buildProvider(config.ai.gemini6, 'Gemini 2.5 Flash Lite D'),
};

// Priority order: only include active providers
const PROVIDER_PRIORITY: ProviderSlot[] = (
    ['gemini1', 'gemini2', 'gemini3', 'gemini4', 'gemini5', 'gemini6'] as ProviderSlot[]
).filter(key => providers[key].isActive);

/**
 * Pick the best available provider (skips rate-limited ones).
 */
function getActiveProvider(): ProviderState & { key: ProviderSlot } {
    const now = Date.now();

    for (const key of PROVIDER_PRIORITY) {
        const p = providers[key];

        if (p.rateLimitedUntil > 0) {
            if (now >= p.rateLimitedUntil) {
                p.rateLimitedUntil = 0;
                logger.info({ provider: p.name }, '🔄 Rate limit expired — provider re-enabled');
            } else {
                const remainingSec = Math.ceil((p.rateLimitedUntil - now) / 1000);
                logger.debug({ provider: p.name, remainingSec }, 'Provider rate-limited, skipping');
                continue;
            }
        }

        return { ...p, key };
    }

    // ALL providers rate-limited — use the one that recovers soonest
    const soonest = PROVIDER_PRIORITY.reduce((a, b) =>
        providers[a].rateLimitedUntil <= providers[b].rateLimitedUntil ? a : b
    );
    logger.warn({ provider: providers[soonest].name }, '⚠️ All providers rate-limited — using soonest to recover');
    return { ...providers[soonest], key: soonest };
}

/**
 * Mark a provider as rate-limited for the cooldown period.
 */
function markRateLimited(key: ProviderSlot) {
    providers[key].rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    logger.warn(
        { provider: providers[key].name, cooldownSec: RATE_LIMIT_COOLDOWN_MS / 1000 },
        '🚫 Provider rate-limited — switching to fallback'
    );
}

// Log startup configuration
const activeNames = PROVIDER_PRIORITY.map(k => `${providers[k].name} (${providers[k].model})`);
logger.info({
    chain: activeNames.join(' → '),
    count: PROVIDER_PRIORITY.length,
    timeoutMs: REQUEST_TIMEOUT_MS,
}, '🤖 6-tier Gemini fallback chain initialized');

// ─── Generate Completion with Fallback ───────────────────────────────

/**
 * Generate a text completion.
 * Tries providers in priority order. Falls back on error/rate limit.
 * Logs response time for every attempt.
 */
export async function generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
    await llmQueue.acquire();
    try {
        let lastError: unknown = null;
        const attempted: string[] = [];
        const overallStart = Date.now();

        // Try each provider in priority order, exactly once
        for (const key of PROVIDER_PRIORITY) {
            const provider = providers[key];

            // Skip rate-limited providers (unless they've recovered)
            const now = Date.now();
            if (provider.rateLimitedUntil > 0) {
                if (now >= provider.rateLimitedUntil) {
                    provider.rateLimitedUntil = 0;
                    logger.info({ provider: provider.name }, '🔄 Rate limit expired — provider re-enabled');
                } else {
                    logger.debug({ provider: provider.name }, 'Provider rate-limited, skipping');
                    continue;
                }
            }

            attempted.push(key);
            const attemptStart = Date.now();

            try {
                logger.info({ provider: provider.name, model: provider.model }, '🔄 LLM request starting');

                const effectiveMaxTokens = Math.min(options?.maxTokens ?? config.ai.maxTokens, 65536);

                const response = await provider.client.chat.completions.create({
                    model: provider.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: options?.temperature ?? config.ai.temperature,
                    max_tokens: effectiveMaxTokens,
                    ...(options?.jsonMode
                        ? { response_format: { type: 'json_object' as const } }
                        : {}),
                });

                const text = response.choices[0]?.message?.content;
                const latencyMs = Date.now() - attemptStart;

                if (!text) {
                    logger.warn({ provider: provider.name, latencyMs }, '⚠️ Empty response from LLM — trying next');
                    continue;
                }

                // Log finish reason to detect truncation
                const finishReason = response.choices[0]?.finish_reason;
                const usage = response.usage;

                if (finishReason === 'length') {
                    logger.warn({
                        provider: provider.name,
                        model: provider.model,
                        finishReason,
                        maxTokensRequested: effectiveMaxTokens,
                        promptTokens: usage?.prompt_tokens,
                        completionTokens: usage?.completion_tokens,
                    }, '⚠️ Response TRUNCATED — model hit token limit. Consider increasing MAX_TOKENS.');
                }

                // ✅ Success!
                logger.info({
                    provider: provider.name,
                    model: provider.model,
                    latencyMs,
                    totalMs: Date.now() - overallStart,
                    responseChars: text.length,
                    finishReason,
                    promptTokens: usage?.prompt_tokens,
                    completionTokens: usage?.completion_tokens,
                    maxTokensRequested: effectiveMaxTokens,
                    attempt: attempted.length,
                }, '✅ LLM response received');

                return text;
            } catch (error: unknown) {
                lastError = error;
                const latencyMs = Date.now() - attemptStart;
                const apiErr = asApiError(error);
                const status = apiErr.status ?? apiErr.code ?? apiErr.error?.code;
                const message = apiErr.error?.message ?? apiErr.message ?? 'Unknown error';

                // Classify the error
                const isRateLimit = status === 429;
                const isPaymentRequired = status === 402;
                const isServerError = status === 500 || status === 502 || status === 503;
                const isTimeout = message.includes('timeout') || message.includes('ETIMEDOUT');
                const isConnectionError = message.includes('ECONNRESET') || message.includes('ECONNREFUSED')
                    || message.includes('fetch failed') || message.includes('socket hang up');

                logger.warn({
                    provider: provider.name,
                    status,
                    latencyMs,
                    errorType: isRateLimit ? 'rate_limit' : isPaymentRequired ? 'payment_required'
                        : isServerError ? 'server_error'
                            : isTimeout ? 'timeout' : isConnectionError ? 'connection' : 'other',
                    message,
                }, `⚡ Provider ${provider.name} failed — trying next`);

                // Only cooldown on actual rate limits / payment issues
                if (isRateLimit || isPaymentRequired) {
                    markRateLimited(key);
                } else if (status === 404) {
                    // Model doesn't exist — disable this provider permanently for this session
                    providers[key].isActive = false;
                    logger.error({ provider: provider.name }, '🚫 Provider disabled — model not found (404)');
                }
                // For timeouts, connection errors, 500s — just skip to next provider (no cooldown)
                continue;
            }
        }

        // All providers failed
        const totalMs = Date.now() - overallStart;
        logger.error({ error: getErrorMessage(lastError), attempted, totalMs }, '❌ All LLM providers failed');

        incrementErrorCount(getErrorMessage(lastError));

        throw new LLMError(
            'all',
            lastError instanceof Error ? lastError.message : 'All LLM providers failed'
        );
    } finally {
        llmQueue.release();
    }
}

// ─── Embeddings ─────────────────────────────────────────────────────

/**
 * Generate embeddings for text(s).
 * Uses Gemini's native REST API for embeddings.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
        const apiKey = config.ai.embeddingApiKey || config.ai.gemini1.apiKey;
        if (apiKey) {
            const embeddingModel = config.ai.embeddingModel || 'gemini-embedding-001';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:batchEmbedContents?key=${apiKey}`;

            const requests = texts.map(text => ({
                model: `models/${embeddingModel}`,
                content: { parts: [{ text }] },
            }));

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Gemini embedding API error ${response.status}: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json() as { embeddings: Array<{ values: number[] }> };
            return data.embeddings.map((e) => e.values);
        }

        logger.warn('No embedding support — using hash-based fallback');
        return texts.map((text) => simpleHashEmbedding(text));
    } catch (error: unknown) {
        const errorMsg = getErrorMessage(error);
        logger.error({ error: errorMsg }, 'Embedding generation failed — using hash fallback');
        return texts.map((text) => simpleHashEmbedding(text));
    }
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const [embedding] = await generateEmbeddings([text]);
    return embedding;
}

function simpleHashEmbedding(text: string, dims: number = 384): number[] {
    const embedding = new Array(dims).fill(0);
    const normalized = text.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
        const charCode = normalized.charCodeAt(i);
        embedding[i % dims] += charCode / 255;
    }
    const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
    return magnitude > 0 ? embedding.map((v: number) => v / magnitude) : embedding;
}
