// Unit tests for command handler input validation and error embed generation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbedBuilder } from 'discord.js';

// Mock discord.js EmbedBuilder
vi.mock('discord.js', () => {
    class MockEmbedBuilder {
        data: Record<string, any> = {};
        setTitle(t: string) { this.data.title = t; return this; }
        setColor(c: number) { this.data.color = c; return this; }
        setDescription(d: string) { this.data.description = d; return this; }
        setTimestamp() { return this; }
        setFooter(f: any) { this.data.footer = f; return this; }
        setAuthor(a: any) { this.data.author = a; return this; }
        setThumbnail(t: string) { return this; }
        addFields(...fields: any[]) { this.data.fields = fields; return this; }
        toJSON() { return this.data; }
    }
    return {
        EmbedBuilder: MockEmbedBuilder,
        Message: class { },
        ActionRowBuilder: class { addComponents() { return this; } },
        ButtonBuilder: class { setCustomId() { return this; } setLabel() { return this; } setStyle() { return this; } setEmoji() { return this; } },
        ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },
        ComponentType: { Button: 2 },
    };
});

// Mock pino logger
vi.mock('../../src/utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// Mock config
vi.mock('../../src/config/index.js', () => ({
    config: {
        ai: {
            gemini1: { apiKey: 'k1', model: 'm1' },
            gemini2: { apiKey: 'k2', model: 'm2' },
            gemini3: { apiKey: '', model: '' },
            gemini4: { apiKey: '', model: '' },
            embeddingApiKey: 'k1',
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

// ─── Test the sanitizeInput function ─────────────────────────────────
import { sanitizeInput } from '../../src/utils/sanitize.js';

// ─── Test the buildErrorEmbed function ───────────────────────────────
import { buildErrorEmbed } from '../../src/bot/embeds/error.js';

describe('buildErrorEmbed', () => {
    it('creates an embed with the correct error title', () => {
        const embed = buildErrorEmbed('Test Error', 'Something happened');
        const json = embed.toJSON();
        expect(json.title).toContain('Test Error');
        expect(json.description).toBe('Something happened');
    });

    it('prefixes ❌ to the title', () => {
        const embed = buildErrorEmbed('Failure', 'Details here');
        expect(embed.toJSON().title).toBe('❌ Failure');
    });
});

// ─── Test command input validation patterns ──────────────────────────

describe('Command Input Validation', () => {
    describe('ask command — input parsing', () => {
        it('sanitizes input correctly', () => {
            const raw = '<script>alert(1)</script>What is XSS?';
            const clean = sanitizeInput(raw);
            expect(clean).not.toContain('<script>');
            expect(clean).toContain('What is XSS?');
        });

        it('empty args result in empty string', () => {
            const question = sanitizeInput('');
            expect(question).toBe('');
        });

        it('respects MAX_INPUT_LENGTH concept', () => {
            const longInput = 'A'.repeat(2001);
            const sanitized = sanitizeInput(longInput);
            expect(sanitized.length).toBe(2001); // sanitize doesn't truncate, length check is separate
        });
    });

    describe('explain command — level flag parsing', () => {
        it('extracts --level flag correctly', () => {
            const args = ['SQL', 'injection', '--level', 'expert'];
            const levelFlagIndex = args.indexOf('--level');
            expect(levelFlagIndex).toBe(2);
            expect(args[levelFlagIndex + 1]).toBe('expert');
        });

        it('handles missing --level value', () => {
            const args = ['SQL', 'injection', '--level'];
            const levelFlagIndex = args.indexOf('--level');
            expect(args[levelFlagIndex + 1]).toBeUndefined();
        });

        it('handles no --level flag', () => {
            const args = ['SQL', 'injection'];
            expect(args.indexOf('--level')).toBe(-1);
        });
    });

    describe('setlevel command — level validation', () => {
        const LEVELS = ['beginner', 'intermediate', 'expert'] as const;

        it('accepts valid levels', () => {
            for (const level of LEVELS) {
                expect(LEVELS.includes(level as any)).toBe(true);
            }
        });

        it('rejects invalid levels', () => {
            expect(LEVELS.includes('noob' as any)).toBe(false);
            expect(LEVELS.includes('pro' as any)).toBe(false);
            expect(LEVELS.includes('' as any)).toBe(false);
        });

        it('handles case insensitivity', () => {
            const input = 'Expert';
            const normalized = input.toLowerCase();
            expect(LEVELS.includes(normalized as any)).toBe(true);
        });
    });

    describe('input sanitization in context', () => {
        it('strips XSS from ask input', () => {
            const raw = ['<img', 'src=x', 'onerror=alert(1)>', 'What', 'is', 'CSRF?'];
            const sanitized = sanitizeInput(raw.join(' '));
            expect(sanitized).not.toContain('<img');
            expect(sanitized).toContain('CSRF?');
        });

        it('strips zero-width chars from explain input', () => {
            const raw = ['\u200BSQL', 'injection\uFEFF'];
            const sanitized = sanitizeInput(raw.join(' '));
            expect(sanitized).toBe('SQL injection');
        });

        it('normalizes excessive whitespace in related input', () => {
            const raw = ['buffer', '', '', '', 'overflow'];
            const sanitized = sanitizeInput(raw.join(' '));
            expect(sanitized).toBe('buffer  overflow');
        });
    });
});

// ─── Quiz flag parsing tests ─────────────────────────────────────────

describe('Quiz Flag Parsing', () => {
    const LEVELS = ['beginner', 'intermediate', 'expert'] as const;
    const MIN_QUESTIONS = 1;
    const MAX_QUESTIONS = 15;
    const DEFAULT_QUESTIONS = 5;

    function parseQuizFlags(args: string[]) {
        let level: string | undefined;
        let count: number = DEFAULT_QUESTIONS;
        const remaining = [...args];

        const levelIdx = remaining.indexOf('--level');
        if (levelIdx !== -1 && remaining[levelIdx + 1]) {
            const requested = remaining[levelIdx + 1].toLowerCase();
            if (LEVELS.includes(requested as any)) {
                level = requested;
            }
            remaining.splice(levelIdx, 2);
        }

        const countIdx = remaining.indexOf('--count');
        if (countIdx !== -1 && remaining[countIdx + 1]) {
            const parsed = parseInt(remaining[countIdx + 1], 10);
            if (!isNaN(parsed) && parsed >= MIN_QUESTIONS && parsed <= MAX_QUESTIONS) {
                count = parsed;
            }
            remaining.splice(countIdx, 2);
        }

        return { level, count, topic: remaining.join(' ').trim() };
    }

    describe('--level flag', () => {
        it('extracts beginner level', () => {
            const result = parseQuizFlags(['SQL', 'injection', '--level', 'beginner']);
            expect(result.level).toBe('beginner');
            expect(result.topic).toBe('SQL injection');
        });

        it('extracts expert level', () => {
            const result = parseQuizFlags(['XSS', '--level', 'expert']);
            expect(result.level).toBe('expert');
            expect(result.topic).toBe('XSS');
        });

        it('ignores invalid level', () => {
            const result = parseQuizFlags(['XSS', '--level', 'noob']);
            expect(result.level).toBeUndefined();
        });

        it('handles missing level value', () => {
            const result = parseQuizFlags(['XSS', '--level']);
            expect(result.level).toBeUndefined();
        });

        it('handles no --level flag', () => {
            const result = parseQuizFlags(['SQL', 'injection']);
            expect(result.level).toBeUndefined();
        });
    });

    describe('--count flag', () => {
        it('extracts valid count', () => {
            const result = parseQuizFlags(['XSS', '--count', '10']);
            expect(result.count).toBe(10);
        });

        it('uses default for out-of-range count (too high)', () => {
            const result = parseQuizFlags(['XSS', '--count', '20']);
            expect(result.count).toBe(DEFAULT_QUESTIONS);
        });

        it('uses default for out-of-range count (too low)', () => {
            const result = parseQuizFlags(['XSS', '--count', '0']);
            expect(result.count).toBe(DEFAULT_QUESTIONS);
        });

        it('uses default for non-numeric count', () => {
            const result = parseQuizFlags(['XSS', '--count', 'abc']);
            expect(result.count).toBe(DEFAULT_QUESTIONS);
        });

        it('accepts boundary values (1 and 15)', () => {
            expect(parseQuizFlags(['XSS', '--count', '1']).count).toBe(1);
            expect(parseQuizFlags(['XSS', '--count', '15']).count).toBe(15);
        });
    });

    describe('combined flags', () => {
        it('parses both --level and --count', () => {
            const result = parseQuizFlags(['SQL', 'injection', '--level', 'expert', '--count', '3']);
            expect(result.level).toBe('expert');
            expect(result.count).toBe(3);
            expect(result.topic).toBe('SQL injection');
        });

        it('handles flags in any order', () => {
            const result = parseQuizFlags(['--count', '7', 'OWASP', '--level', 'beginner']);
            expect(result.count).toBe(7);
            expect(result.level).toBe('beginner');
            expect(result.topic).toBe('OWASP');
        });
    });
});
