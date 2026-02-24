import { describe, it, expect } from 'vitest';
import { buildErrorEmbed } from '../../src/bot/embeds/error.js';
import { buildThinkingEmbed } from '../../src/bot/embeds/thinking.js';
import { EMBED_COLORS } from '../../src/config/constants.js';

describe('buildErrorEmbed', () => {
    it('should create an embed with the error title', () => {
        const embed = buildErrorEmbed('Rate Limited', 'Slow down!');
        const data = embed.toJSON();
        expect(data.title).toContain('Rate Limited');
        expect(data.description).toBe('Slow down!');
    });

    it('should use error color', () => {
        const embed = buildErrorEmbed('Error', 'Something broke');
        expect(embed.toJSON().color).toBe(EMBED_COLORS.error);
    });

    it('should add retry hints when title matches rate limit', () => {
        const embed = buildErrorEmbed('Rate Limit', 'Too many requests');
        const fields = embed.toJSON().fields ?? [];
        expect(fields.length).toBeGreaterThan(0);
        expect(fields[0].name).toContain('What to try');
    });

    it('should accept custom retry hints', () => {
        const embed = buildErrorEmbed('Error', 'oops', ['Try this', 'Try that']);
        const fields = embed.toJSON().fields ?? [];
        expect(fields[0].value).toContain('Try this');
        expect(fields[0].value).toContain('Try that');
    });

    it('should have author and footer', () => {
        const embed = buildErrorEmbed('Error', 'test');
        const data = embed.toJSON();
        expect(data.author?.name).toContain('OffSec');
        expect(data.footer?.text).toBeTruthy();
    });
});

describe('buildThinkingEmbed', () => {
    it('should create a thinking embed for ask', () => {
        const embed = buildThinkingEmbed('ask');
        const data = embed.toJSON();
        expect(data.description).toContain('Processing');
        expect(data.color).toBe(0x2B2D31);
    });

    it('should create a thinking embed for explain', () => {
        const embed = buildThinkingEmbed('explain');
        const data = embed.toJSON();
        expect(data.description).toContain('Processing');
    });

    it('should fallback to ask for unknown types', () => {
        const embed = buildThinkingEmbed('unknown_command');
        const data = embed.toJSON();
        expect(data.description).toContain('Processing');
    });

    it('should have author line', () => {
        const embed = buildThinkingEmbed('quiz');
        expect(embed.toJSON().author?.name).toContain('OffSec');
    });
});
