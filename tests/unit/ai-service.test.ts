// Unit tests for AI service 4-tier Gemini fallback
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config with 4 Gemini provider slots
vi.mock('../../src/config/index.js', () => ({
    config: {
        ai: {
            gemini1: { apiKey: 'test-key-1', model: 'gemini-3.1-pro-preview' },
            gemini2: { apiKey: 'test-key-2', model: 'gemini-3-flash-preview' },
            gemini3: { apiKey: 'test-key-3', model: 'gemini-2.5-flash-preview' },
            gemini4: { apiKey: 'test-key-4', model: 'gemini-2.5-flash-lite' },
            gemini5: { apiKey: 'test-key-5', model: 'gemini-2.5-flash-lite' },
            gemini6: { apiKey: 'test-key-6', model: 'gemini-2.5-flash-lite' },
            embeddingApiKey: 'test-key-1',
            embeddingModel: 'gemini-embedding-001',
            temperature: 0.7,
            maxTokens: 1024,
        },
        discord: { token: 'test', clientId: 'test' },
        database: { sqlitePath: './data/test.db', chromaHost: 'localhost', chromaPort: 8000 },
        rag: { topK: 10, rerankTop: 5, confidenceThreshold: 0.6, chunkSize: 512, chunkOverlap: 50 },
        features: { webDashboard: false, analytics: false, communitySubmissions: false },
        rateLimit: { perUser: 10, windowMs: 60000 },
    },
}));

// Mock OpenAI constructor (used as Gemini API client)
const mockCreate = vi.fn();
vi.mock('openai', () => {
    return {
        default: class MockOpenAI {
            chat = {
                completions: {
                    create: mockCreate,
                },
            };
            constructor() { }
        },
    };
});

describe('AI Service — 6-tier Gemini Fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('generateCompletion', () => {
        it('returns content from the primary Gemini provider', async () => {
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: 'Test response from Gemini 3.1 Pro' } }],
            });

            const { generateCompletion } = await import('../../src/services/ai.js');
            const result = await generateCompletion('You are a helper', 'What is XSS?');

            expect(result).toBe('Test response from Gemini 3.1 Pro');
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        it('falls back to next provider on failure', async () => {
            // First call fails (gemini1), second succeeds (gemini2)
            mockCreate
                .mockRejectedValueOnce(new Error('Primary provider unavailable'))
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'Fallback from Gemini 3 Flash' } }],
                });

            const { generateCompletion } = await import('../../src/services/ai.js');
            const result = await generateCompletion('You are a helper', 'What is XSS?');

            expect(result).toBe('Fallback from Gemini 3 Flash');
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });

        it('throws LLMError when all 6 providers fail', async () => {
            mockCreate
                .mockRejectedValueOnce(new Error('Provider 1 failed'))
                .mockRejectedValueOnce(new Error('Provider 2 failed'))
                .mockRejectedValueOnce(new Error('Provider 3 failed'))
                .mockRejectedValueOnce(new Error('Provider 4 failed'))
                .mockRejectedValueOnce(new Error('Provider 5 failed'))
                .mockRejectedValueOnce(new Error('Provider 6 failed'));

            const { generateCompletion } = await import('../../src/services/ai.js');

            await expect(
                generateCompletion('You are a helper', 'What is XSS?')
            ).rejects.toThrow();
        });

        it('handles empty response content by trying fallback', async () => {
            // All providers return empty → should throw
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: null } }],
            });

            const { generateCompletion } = await import('../../src/services/ai.js');

            await expect(
                generateCompletion('You are a helper', 'What is XSS?')
            ).rejects.toThrow();
        });

        it('passes custom options to the provider', async () => {
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: '{"key": "value"}' } }],
            });

            const { generateCompletion } = await import('../../src/services/ai.js');
            await generateCompletion('System', 'User', {
                temperature: 0.2,
                maxTokens: 500,
                jsonMode: true,
            });

            expect(mockCreate).toHaveBeenCalledTimes(1);
            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.temperature).toBe(0.2);
            expect(callArgs.max_tokens).toBe(500);
        });
    });

    describe('generateEmbedding', () => {
        it('returns a number array for a given text', async () => {
            const mockEmbedding = new Array(768).fill(0.5);
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    embeddings: [{ values: mockEmbedding }],
                }),
            }) as any;

            const { generateEmbedding } = await import('../../src/services/ai.js');
            const result = await generateEmbedding('test text');

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(typeof result[0]).toBe('number');
        });
    });
});
