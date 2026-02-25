/**
 * E2E integration test — validates the FULL LLM pipeline with real Gemini API calls.
 * 
 * GATED: Only runs when GEMINI1_API_KEY is set in environment.
 * Skipped automatically in CI/local without a key.
 * 
 * These tests are intentionally slow (10-30s) because they make real API calls.
 */
import { describe, it, expect } from 'vitest';

const SKIP = !process.env.GEMINI1_API_KEY;

describe.skipIf(SKIP)('E2E: Real LLM Integration', () => {
    it('generates a valid completion from Gemini', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');

        const result = await generateCompletion(
            'You are a cybersecurity educator.',
            'Explain SQL injection in exactly 2 sentences. Be concise.',
            { temperature: 0.3, maxTokens: 200 }
        );

        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(20);
        // Should contain something related to SQL
        expect(result.toLowerCase()).toMatch(/sql|inject|query|database/);
    }, 30_000);

    it('generates a valid embedding vector', async () => {
        const { generateEmbedding } = await import('../../src/services/ai.js');

        const embedding = await generateEmbedding('SQL injection attack');

        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(100); // Gemini embeddings are 768+ dims
        // Each value should be a number
        expect(embedding.every((v: number) => typeof v === 'number')).toBe(true);
    }, 15_000);

    it('returns valid JSON for structured ask prompt', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');

        const result = await generateCompletion(
            'You are a cybersecurity educator. Return ONLY valid JSON.',
            `Answer this question in JSON format: What is XSS?
Return: { "answer": "your answer here", "suggestedFollowups": ["q1"], "keyTakeaways": ["t1"] }`,
            { temperature: 0.3, maxTokens: 500, jsonMode: true }
        );

        expect(result).toBeTruthy();
        // Should be parseable JSON (possibly wrapped in code fences)
        const cleaned = result.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
        const parsed = JSON.parse(cleaned);
        expect(parsed.answer).toBeTruthy();
    }, 30_000);
});
