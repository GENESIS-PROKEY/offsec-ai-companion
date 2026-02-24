// Unit tests for input sanitization
import { describe, it, expect } from 'vitest';
import { sanitizeInput } from '../../src/utils/sanitize.js';

describe('sanitizeInput', () => {
    it('trims whitespace', () => {
        expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('strips HTML script tags (XSS)', () => {
        expect(sanitizeInput('<script>alert("xss")</script>hello')).toBe('alert("xss")hello');
    });

    it('strips img tags with onerror', () => {
        expect(sanitizeInput('<img src=x onerror=alert(1)>hello')).toBe('hello');
    });

    it('strips nested HTML tags', () => {
        expect(sanitizeInput('<b><i>bold italic</i></b>')).toBe('bold italic');
    });

    it('removes zero-width unicode chars', () => {
        expect(sanitizeInput('he\u200Bllo\uFEFF')).toBe('hello');
    });

    it('removes ANSI escape codes', () => {
        expect(sanitizeInput('\x1B[31mred text\x1B[0m')).toBe('red text');
    });

    it('removes control characters (keeps newlines/tabs)', () => {
        expect(sanitizeInput('hello\x00world\x07!')).toBe('helloworld!');
        expect(sanitizeInput('line1\nline2\ttab')).toBe('line1\nline2\ttab');
    });

    it('collapses excessive newlines to max 2', () => {
        expect(sanitizeInput('a\n\n\n\n\nb')).toBe('a\n\nb');
    });

    it('collapses excessive spaces to max 2', () => {
        expect(sanitizeInput('a     b')).toBe('a  b');
    });

    it('returns empty string for only-whitespace input', () => {
        expect(sanitizeInput('   ')).toBe('');
    });

    it('handles mixed attack vectors', () => {
        const malicious = '<script>alert(1)</script>\x1B[31m\u200Bhello\x00\n\n\n\nworld';
        const result = sanitizeInput(malicious);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('\x1B');
        expect(result).not.toContain('\u200B');
        expect(result).not.toContain('\x00');
        expect(result).toContain('hello');
        expect(result).toContain('world');
    });

    it('leaves normal cybersecurity text unchanged', () => {
        const text = 'How does SQL injection with UNION SELECT work?';
        expect(sanitizeInput(text)).toBe(text);
    });

    it('preserves markdown formatting', () => {
        const text = '**bold** _italic_ `code` [link](url)';
        expect(sanitizeInput(text)).toBe(text);
    });
});
