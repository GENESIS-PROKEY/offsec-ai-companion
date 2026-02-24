// Unit tests for config/constants.ts
import { describe, it, expect } from 'vitest';
import {
    APP_NAME,
    APP_VERSION,
    APP_FOOTER,
    LEVELS,
    STYLES,
    EMBED_COLORS,
    CONFIDENCE,
    LEVEL_EMOJI,
    CONFIDENCE_EMOJI,
    MEMORY,
    THINKING_MESSAGES,
    randomThinking,
} from '../../src/config/constants.js';

describe('Constants', () => {
    it('APP_NAME is defined', () => {
        expect(APP_NAME).toBe('OffSec AI Learning Companion');
    });

    it('APP_VERSION follows semver', () => {
        expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('APP_FOOTER contains name and version', () => {
        expect(APP_FOOTER).toContain(APP_NAME);
        expect(APP_FOOTER).toContain(APP_VERSION);
    });

    it('LEVELS has exactly 3 entries', () => {
        expect(LEVELS).toHaveLength(3);
        expect(LEVELS).toContain('beginner');
        expect(LEVELS).toContain('intermediate');
        expect(LEVELS).toContain('expert');
    });

    it('STYLES has exactly 3 entries', () => {
        expect(STYLES).toHaveLength(3);
        expect(STYLES).toContain('concise');
        expect(STYLES).toContain('detailed');
        expect(STYLES).toContain('socratic');
    });

    it('EMBED_COLORS are valid hex color integers', () => {
        for (const [key, value] of Object.entries(EMBED_COLORS)) {
            if (typeof value === 'number') {
                // Flat color (e.g., ask, error, success)
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(0xFFFFFF);
            } else if (typeof value === 'object' && value !== null) {
                // Nested level-based colors (e.g., explain: { beginner, intermediate, expert })
                for (const [subKey, subValue] of Object.entries(value)) {
                    expect(typeof subValue).toBe('number');
                    expect(subValue).toBeGreaterThanOrEqual(0);
                    expect(subValue).toBeLessThanOrEqual(0xFFFFFF);
                }
            }
        }
    });

    it('EMBED_COLORS has all required keys', () => {
        const requiredKeys = ['explain', 'ask', 'history', 'related', 'error', 'warning', 'info', 'success', 'ping'];
        for (const key of requiredKeys) {
            expect(EMBED_COLORS).toHaveProperty(key);
        }
    });

    it('CONFIDENCE thresholds are valid', () => {
        expect(CONFIDENCE.HIGH).toBeGreaterThan(CONFIDENCE.LOW);
        expect(CONFIDENCE.HIGH).toBeLessThanOrEqual(1);
        expect(CONFIDENCE.LOW).toBeGreaterThanOrEqual(0);
    });

    it('LEVEL_EMOJI maps all levels', () => {
        for (const level of LEVELS) {
            expect(LEVEL_EMOJI[level]).toBeDefined();
            expect(typeof LEVEL_EMOJI[level]).toBe('string');
        }
    });

    it('CONFIDENCE_EMOJI has high, medium, low', () => {
        expect(CONFIDENCE_EMOJI.high).toBeDefined();
        expect(CONFIDENCE_EMOJI.medium).toBeDefined();
        expect(CONFIDENCE_EMOJI.low).toBeDefined();
    });

    it('MEMORY constants are positive integers', () => {
        expect(MEMORY.RECENT_WINDOW).toBeGreaterThan(0);
        expect(MEMORY.SUMMARIZE_THRESHOLD).toBeGreaterThan(0);
        expect(MEMORY.MAX_HISTORY_DISPLAY).toBeGreaterThan(0);
        expect(MEMORY.SUMMARY_MAX_WORDS).toBeGreaterThan(0);
    });

    it('THINKING_MESSAGES has entries for all types', () => {
        expect(THINKING_MESSAGES.ask.length).toBeGreaterThan(0);
        expect(THINKING_MESSAGES.explain.length).toBeGreaterThan(0);
        expect(THINKING_MESSAGES.related.length).toBeGreaterThan(0);
    });
});

describe('randomThinking', () => {
    it('returns a string from the correct category', () => {
        const msg = randomThinking('ask');
        expect(THINKING_MESSAGES.ask).toContain(msg);
    });

    it('works for all categories', () => {
        for (const type of ['ask', 'explain', 'related'] as const) {
            const msg = randomThinking(type);
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        }
    });
});
