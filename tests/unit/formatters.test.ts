// Unit tests for utils/formatters.ts
import { describe, it, expect } from 'vitest';
import {
    truncate,
    formatLevelBadge,
    formatConfidence,
    formatCitations,
    stripOuterCodeFence,
    flattenToMarkdown,
    sanitizeAnswer,
} from '../../src/utils/formatters.js';

describe('truncate', () => {
    it('returns text unchanged when under limit', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    it('returns exact-length text unchanged', () => {
        const text = 'a'.repeat(100);
        expect(truncate(text, 100)).toBe(text);
    });

    it('truncates long text with ellipsis', () => {
        const text = 'a'.repeat(200);
        const result = truncate(text, 100);
        expect(result.length).toBe(100);
        expect(result.endsWith('...')).toBe(true);
    });

    it('defaults to 1024 max length', () => {
        const text = 'a'.repeat(2000);
        expect(truncate(text).length).toBe(1024);
    });

    it('handles empty string', () => {
        expect(truncate('', 10)).toBe('');
    });
});

describe('formatLevelBadge', () => {
    it('formats beginner level', () => {
        const badge = formatLevelBadge('beginner');
        expect(badge).toContain('Beginner');
    });

    it('formats intermediate level', () => {
        const badge = formatLevelBadge('intermediate');
        expect(badge).toContain('Intermediate');
    });

    it('formats expert level', () => {
        const badge = formatLevelBadge('expert');
        expect(badge).toContain('Expert');
    });

    it('capitalizes first letter', () => {
        const badge = formatLevelBadge('beginner');
        expect(badge).toMatch(/[A-Z]/);
    });
});

describe('formatConfidence', () => {
    it('formats high confidence (≥0.6)', () => {
        const result = formatConfidence(0.85);
        expect(result).toContain('High');
        expect(result).toContain('85%');
    });

    it('formats medium confidence (0.3–0.6)', () => {
        const result = formatConfidence(0.45);
        expect(result).toContain('Medium');
        expect(result).toContain('45%');
    });

    it('formats low confidence (<0.3)', () => {
        const result = formatConfidence(0.1);
        expect(result).toContain('Low');
        expect(result).toContain('10%');
    });

    it('handles boundary values', () => {
        expect(formatConfidence(0.6)).toContain('High');
        expect(formatConfidence(0.3)).toContain('Medium');
        expect(formatConfidence(0)).toContain('Low');
        expect(formatConfidence(1)).toContain('High');
    });

    it('rounds percentages correctly', () => {
        expect(formatConfidence(0.333)).toContain('33%');
        expect(formatConfidence(0.666)).toContain('67%');
    });
});

describe('formatCitations', () => {
    it('formats sources without URLs', () => {
        const result = formatCitations([
            { source: 'OWASP Top 10' },
            { source: 'Kali Docs' },
        ]);
        expect(result).toContain('[1] OWASP Top 10');
        expect(result).toContain('[2] Kali Docs');
    });

    it('formats sources with URLs', () => {
        const result = formatCitations([
            { source: 'OWASP', url: 'https://owasp.org' },
        ]);
        expect(result).toContain('[1] OWASP');
        expect(result).toContain('https://owasp.org');
    });

    it('returns empty string for empty array', () => {
        expect(formatCitations([])).toBe('');
    });

    it('handles mixed sources (with and without URL)', () => {
        const result = formatCitations([
            { source: 'A' },
            { source: 'B', url: 'https://example.com' },
        ]);
        expect(result).toContain('[1] A');
        expect(result).toContain('[2] B');
        expect(result).toContain('https://example.com');
    });
});

describe('stripOuterCodeFence', () => {
    it('removes markdown code fences', () => {
        expect(stripOuterCodeFence('```json\n{"a": 1}\n```')).toBe('{"a": 1}');
    });

    it('removes plain code fences', () => {
        expect(stripOuterCodeFence('```\ncode here\n```')).toBe('code here');
    });

    it('removes markdown code fences with language', () => {
        expect(stripOuterCodeFence('```markdown\n# Title\n```')).toBe('# Title');
    });

    it('leaves clean text untouched', () => {
        expect(stripOuterCodeFence('plain text')).toBe('plain text');
    });

    it('trims whitespace', () => {
        expect(stripOuterCodeFence('  hello  ')).toBe('hello');
    });

    it('handles empty string', () => {
        expect(stripOuterCodeFence('')).toBe('');
    });
});

describe('flattenToMarkdown', () => {
    it('returns strings unchanged', () => {
        expect(flattenToMarkdown('hello')).toBe('hello');
    });

    it('converts non-object primitives to string', () => {
        expect(flattenToMarkdown(42)).toBe('42');
        expect(flattenToMarkdown(null)).toBe('null');
    });

    it('formats arrays as bullet points', () => {
        const result = flattenToMarkdown(['SQL injection', 'XSS']);
        expect(result).toContain('• SQL injection');
        expect(result).toContain('• XSS');
    });

    it('handles structured items with term/definition', () => {
        const result = flattenToMarkdown([
            { term: 'SQL Injection', definition: 'A code injection technique' },
        ]);
        expect(result).toContain('**SQL Injection:**');
        expect(result).toContain('A code injection technique');
    });

    it('renders object titles and sections', () => {
        const result = flattenToMarkdown({
            title: 'Buffer Overflow',
            sections: [
                { header: 'Overview', content: 'Memory corruption attack' },
            ],
        });
        expect(result).toContain('## Buffer Overflow');
        expect(result).toContain('**Overview**');
        expect(result).toContain('Memory corruption attack');
    });

    it('handles generic key-value objects', () => {
        const result = flattenToMarkdown({ description: 'A test concept', category: 'Web' });
        expect(result).toContain('**Description:** A test concept');
        expect(result).toContain('**Category:** Web');
    });

    it('handles items with analogies', () => {
        const result = flattenToMarkdown([
            { name: 'Firewall', description: 'Network filter', analogy: 'Like a bouncer at a club' },
        ]);
        expect(result).toContain('**Firewall:**');
        expect(result).toContain('💡 Like a bouncer at a club');
    });
});

describe('sanitizeAnswer', () => {
    it('returns trimmed string for plain input', () => {
        expect(sanitizeAnswer('  hello  ')).toBe('hello');
    });

    it('flattens object inputs to markdown', () => {
        const result = sanitizeAnswer({ title: 'Test', sections: [] });
        expect(result).toContain('## Test');
    });

    it('fixes escaped newlines', () => {
        expect(sanitizeAnswer('line1\\nline2')).toContain('line1\nline2');
    });

    it('strips JSON wrappers', () => {
        const result = sanitizeAnswer('{"answer": "the actual answer"}');
        expect(result).toBe('the actual answer');
    });

    it('strips wrappers for custom field names', () => {
        const result = sanitizeAnswer('{"explanation": "the explanation"}', 'explanation');
        expect(result).toBe('the explanation');
    });

    it('cleans up excessive blank lines', () => {
        const result = sanitizeAnswer('a\n\n\n\n\nb');
        expect(result).toBe('a\n\nb');
    });
});
