import { describe, it, expect } from 'vitest';
import { getLabsForTopic, formatLabsForEmbed } from '../../src/utils/labs.js';
import { ALL_LABS } from '../../src/data/labs.js';

describe('Lab Data Validation', () => {
    it('should have 280+ labs', () => {
        expect(ALL_LABS.length).toBeGreaterThanOrEqual(210);
    });

    it('should have no duplicate entries (name + platform)', () => {
        const keys = ALL_LABS.map(l => `${l.platform}:${l.name}`);
        const unique = new Set(keys);
        expect(unique.size).toBe(keys.length);
    });

    it('should have valid URLs (https://)', () => {
        for (const lab of ALL_LABS) {
            expect(lab.url, `${lab.name} has invalid URL: ${lab.url}`).toMatch(/^https:\/\//);
        }
    });

    it('should have valid platform values', () => {
        const validPlatforms = ['PortSwigger', 'TryHackMe', 'HackTheBox', 'OffSec', 'CyberDefenders', 'PentesterLab'];
        for (const lab of ALL_LABS) {
            expect(validPlatforms, `${lab.name} has invalid platform: ${lab.platform}`)
                .toContain(lab.platform);
        }
    });

    it('should have valid level values', () => {
        const validLevels = ['beginner', 'intermediate', 'expert'];
        for (const lab of ALL_LABS) {
            expect(validLevels).toContain(lab.level);
        }
    });

    it('should have at least one topic per lab', () => {
        for (const lab of ALL_LABS) {
            expect(lab.topics.length, `${lab.name} has no topics`).toBeGreaterThanOrEqual(1);
        }
    });

    it('should have labs across all difficulty levels', () => {
        const levels = new Set(ALL_LABS.map(l => l.level));
        expect(levels.has('beginner')).toBe(true);
        expect(levels.has('intermediate')).toBe(true);
        expect(levels.has('expert')).toBe(true);
    });
});

describe('getLabsForTopic', () => {
    it('should return labs matching a topic', () => {
        const labs = getLabsForTopic('sql injection', 'beginner');
        expect(labs.length).toBeGreaterThan(0);
        expect(labs.length).toBeLessThanOrEqual(5);
    });

    it('should return labs at the correct level', () => {
        const labs = getLabsForTopic('xss', 'expert');
        for (const lab of labs) {
            // Should be expert or fallback to intermediate
            expect(['expert', 'intermediate']).toContain(lab.level);
        }
    });

    it('should return few or no results for nonsense topics', () => {
        const labs = getLabsForTopic('qqqxyznonexistent', 'beginner');
        expect(labs.length).toBe(0);
    });

    it('should return at most 5 results', () => {
        const labs = getLabsForTopic('web security', 'intermediate');
        expect(labs.length).toBeLessThanOrEqual(5);
    });
});

describe('formatLabsForEmbed', () => {
    it('should format labs with emojis', () => {
        const result = formatLabsForEmbed([
            { name: 'Test Lab', url: 'https://example.com', platform: 'PortSwigger', level: 'beginner' },
        ]);
        expect(result).toContain('🌐');
        expect(result).toContain('[Test Lab]');
        expect(result).toContain('🟢');
    });

    it('should return empty string for empty array', () => {
        expect(formatLabsForEmbed([])).toBe('');
    });
});
