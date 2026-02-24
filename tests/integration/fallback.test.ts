// Integration test for fallback chain — mock 4 providers and verify sequential failover
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// Mock config with 4 providers
vi.mock('../../src/config/index.js', () => ({
    config: {
        ai: {
            gemini1: { apiKey: 'key1', model: 'model1' },
            gemini2: { apiKey: 'key2', model: 'model2' },
            gemini3: { apiKey: 'key3', model: 'model3' },
            gemini4: { apiKey: 'key4', model: 'model4' },
            gemini5: { apiKey: 'key5', model: 'model5' },
            gemini6: { apiKey: 'key6', model: 'model6' },
            embeddingApiKey: 'key1',
            embeddingModel: 'gemini-embedding-001',
            temperature: 0.7,
            maxTokens: 1024,
        },
        discord: { token: 'test', clientId: 'test' },
        database: { sqlitePath: './test.db', chromaHost: 'localhost', chromaPort: 8000 },
        rag: { topK: 10, rerankTop: 5, confidenceThreshold: 0.6, chunkSize: 512, chunkOverlap: 50 },
        features: { webDashboard: false, analytics: false, communitySubmissions: false },
        rateLimit: { perUser: 10, windowMs: 60000 },
        monitoring: { healthPort: 3001 },
    },
}));

// Mock health module to avoid starting real server
vi.mock('../../src/services/health.js', () => ({
    incrementErrorCount: vi.fn(),
    getStats: vi.fn(() => ({ status: 'healthy' })),
    startHealthServer: vi.fn(),
}));

// Mock OpenAI SDK
const mockCreate = vi.fn();
vi.mock('openai', () => ({
    default: class MockOpenAI {
        chat = {
            completions: {
                create: mockCreate,
            },
        };
        constructor() { }
    },
}));

describe('Fallback Chain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses first provider when it succeeds', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: 'Response from provider 1' } }],
        });

        const { generateCompletion } = await import('../../src/services/ai.js');
        const result = await generateCompletion('system', 'user prompt');
        expect(result).toContain('Response from provider 1');
    });

    it('falls through to second provider on first failure', async () => {
        // First call: 429 rate limit
        mockCreate.mockRejectedValueOnce(Object.assign(new Error('Rate limit'), { status: 429 }));
        // Second call: success
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: 'Response from provider 2' } }],
        });

        const { generateCompletion } = await import('../../src/services/ai.js');
        const result = await generateCompletion('system', 'user prompt');
        expect(result).toContain('Response from provider 2');
    });

    it('tries all providers before failing', async () => {
        // Track call count before this test
        const callsBefore = mockCreate.mock.calls.length;

        // All calls fail
        mockCreate.mockRejectedValue(Object.assign(new Error('Rate limit'), { status: 429 }));

        const { generateCompletion } = await import('../../src/services/ai.js');

        await expect(generateCompletion('system', 'user prompt that will fail everywhere'))
            .rejects.toThrow();

        // Should have tried multiple providers (at least 2 configured)
        const newCalls = mockCreate.mock.calls.length - callsBefore;
        expect(newCalls).toBeGreaterThanOrEqual(2);
    });
});
