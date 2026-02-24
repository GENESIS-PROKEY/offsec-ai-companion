// Unit tests for config validation
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Config validation', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    it('config module exports expected shape', async () => {
        const { config } = await import('../../src/config/index.js');
        expect(config).toHaveProperty('discord');
        expect(config).toHaveProperty('ai');
        expect(config).toHaveProperty('database');
        expect(config).toHaveProperty('rag');
    });

    it('discord config has token and clientId', async () => {
        const { config } = await import('../../src/config/index.js');
        expect(typeof config.discord.token).toBe('string');
        expect(typeof config.discord.clientId).toBe('string');
    });

    it('ai config has gemini provider slots', async () => {
        const { config } = await import('../../src/config/index.js');
        expect(config.ai.gemini1).toBeDefined();
        expect(typeof config.ai.gemini1.apiKey).toBe('string');
        expect(typeof config.ai.gemini1.model).toBe('string');
    });

    it('ai config has positive maxTokens', async () => {
        const { config } = await import('../../src/config/index.js');
        expect(config.ai.maxTokens).toBeGreaterThan(0);
    });

    it('ai config has valid temperature', async () => {
        const { config } = await import('../../src/config/index.js');
        expect(config.ai.temperature).toBeGreaterThanOrEqual(0);
        expect(config.ai.temperature).toBeLessThanOrEqual(2);
    });

    it('database config has chromaHost and chromaPort', async () => {
        const { config } = await import('../../src/config/index.js');
        expect(typeof config.database.chromaHost).toBe('string');
        expect(typeof config.database.chromaPort).toBe('number');
    });

    it('rag config has positive topK', async () => {
        const { config } = await import('../../src/config/index.js');
        expect(config.rag.topK).toBeGreaterThan(0);
    });
});
