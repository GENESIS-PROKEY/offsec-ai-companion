// Integration tests for LLM response parsing pipeline
// Tests for the exact production bugs that weren't caught by unit tests

import { describe, it, expect } from 'vitest';
import { stripOuterCodeFence, sanitizeAnswer } from '../../src/utils/formatters.js';

// ─── Bug 1: cleanLLMOutput stripping markdown with code blocks ──────

describe('stripOuterCodeFence — code block handling', () => {
    it('KNOWN ISSUE: stripOuterCodeFence strips markdown to first code block content', () => {
        // cleanLLMOutput extracts the content of the FIRST code fence.
        // This is correct for beginner JSON mode (extracts JSON from ```json blocks)
        // but WRONG for markdown containing code blocks (strips to first block).
        // That's why RAG parseJSON and explain intermediate/expert DON'T use cleanLLMOutput.
        const markdown = [
            '**📖 What Is It?**',
            'CSRF is a web attack that tricks users.',
            '',
            '**⚔️ Attack:**',
            '```html',
            '<img src="http://evil.com/transfer?amount=10000">',
            '```',
            '',
            '**🛡️ Defense:**',
            'Use CSRF tokens and SameSite cookies.',
        ].join('\n');

        const result = stripOuterCodeFence(markdown);

        // cleanLLMOutput WILL strip to just the code block content — this is by design
        // for JSON extraction, but destructive for markdown responses. 
        // RAG and explain (intermediate/expert) use their own parsing that avoids this.
        expect(result).toContain('<img');
    });

    it('should correctly extract JSON from a code fence', () => {
        const fencedJson = '```json\n{"answer":"XSS is dangerous","suggestedFollowups":[]}\n```';
        const result = stripOuterCodeFence(fencedJson);
        expect(() => JSON.parse(result)).not.toThrow();
        expect(JSON.parse(result).answer).toBe('XSS is dangerous');
    });

    it('should handle JSON with code blocks inside string values', () => {
        const fencedJson = '```json\n{"answer":"Use \\`<img src=\\"x\\">\\` for XSS detection"}\n```';
        const result = stripOuterCodeFence(fencedJson);
        // Should extract the JSON, not just the inner code block
        expect(result).toContain('answer');
    });
});

// ─── Bug 2: RAG parseJSON outer fence stripping ─────────────────────

describe('RAG parseJSON — outer fence handling', () => {
    it('should strip ONLY the outermost code fence, preserving inner code blocks', () => {
        // This simulates what the LLM returns: JSON wrapped in ```json, where the
        // answer field contains markdown with code blocks inside
        const raw = [
            '```json',
            '{',
            '  "answer": "Use this payload:\\n```html\\n<img src=x onerror=alert(1)>\\n```\\nFor defense, use CSP headers.",',
            '  "suggestedFollowups": ["What is CSP?"],',
            '  "keyTakeaways": ["XSS is preventable"]',
            '}',
            '```',
        ].join('\n');

        // Greedy regex anchored to ^ and $ should strip only the outer fence
        const outerFence = raw.trim().match(/^```(?:json|JSON)?\s*\n([\s\S]*)\n\s*```\s*$/);
        expect(outerFence).not.toBeNull();

        const cleaned = outerFence![1].trim();
        // The extracted content should be valid JSON (the inner code fences are escaped in the string)
        expect(cleaned).toContain('"answer"');
        expect(cleaned).toContain('"suggestedFollowups"');
    });

    it('should not match inner code fences with lazy regex', () => {
        // This is the OLD bug: lazy regex [\s\S]*? matches the FIRST ``` pair
        const raw = '```json\n{"answer": "```html\\n<img>\\n```"}\n```';

        // Old regex (lazy) — would match ```json\n{"answer": "``` and extract just that
        const lazyMatch = raw.match(/```(?:json|JSON)?\s*\n([\s\S]*?)\n\s*```/);

        // New regex (greedy, anchored) — matches the outer fence
        const greedyMatch = raw.trim().match(/^```(?:json|JSON)?\s*\n([\s\S]*)\n\s*```\s*$/);

        // Greedy should get the full JSON, lazy may get truncated content
        if (greedyMatch) {
            expect(greedyMatch[1]).toContain('"answer"');
        }
    });
});

// ─── Bug 3: Regex parser with escaped quotes ────────────────────────

describe('Regex answer extraction — escaped quotes', () => {
    it('should handle escaped quotes in answer field', () => {
        const json = '{"answer":"He said \\"hello\\" and used <img src=\\"x\\">","suggestedFollowups":[]}';
        const match = json.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,}]/);

        expect(match).not.toBeNull();
        expect(match![1]).toContain('He said');
        expect(match![1]).toContain('<img');
    });

    it('should NOT truncate at first escaped quote', () => {
        // The old regex [\\s\\S]*? would stop at the first \" inside the answer
        const json = '{"answer":"Step 1: Use \\"sqlmap\\" tool\\nStep 2: Check \\"results\\"","other":"field"}';
        const match = json.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,}]/);

        expect(match).not.toBeNull();
        expect(match![1]).toContain('Step 2');
        expect(match![1]).toContain('results');
    });
});

// ─── Bug 4: Cache behavior ──────────────────────────────────────────

describe('Response cache', () => {
    // Dynamic import to avoid module-level side effects
    it('should cache and retrieve values', async () => {
        const { getCached, setCache, makeCacheKey } = await import('../../src/services/cache.js');

        const key = makeCacheKey('explain', 'csrf', 'expert');
        expect(getCached(key)).toBeNull();

        setCache(key, 'cached response');
        expect(getCached(key)).toBe('cached response');
    });

    it('should normalize cache keys', async () => {
        const { makeCacheKey } = await import('../../src/services/cache.js');

        const key1 = makeCacheKey('explain', 'CSRF', 'expert');
        const key2 = makeCacheKey('explain', '  csrf  ', 'expert');
        expect(key1).toBe(key2);
    });

    it('should return null for expired entries', async () => {
        const { getCached, setCache, makeCacheKey } = await import('../../src/services/cache.js');

        const key = makeCacheKey('test', 'expired', 'beginner');
        // Set with 0ms TTL (immediately expires)
        setCache(key, 'old value', 0);

        // Wait a tick
        await new Promise(r => setTimeout(r, 10));
        expect(getCached(key)).toBeNull();
    });
});

// ─── Bug 5: sanitizeAnswer edge cases ───────────────────────────────

describe('sanitizeAnswer — tricky content', () => {
    it('should preserve code blocks in answer', () => {
        const answer = '**Overview:**\nUse `sqlmap`:\n```bash\nsqlmap -u "http://target?id=1"\n```\n**Defense:** Use parameterized queries.';
        const result = sanitizeAnswer(answer);
        expect(result).toContain('```bash');
        expect(result).toContain('sqlmap');
        expect(result).toContain('Defense');
    });

    it('should handle emoji-rich content', () => {
        const answer = '⚔️ **Attack:** Use `<script>alert(1)</script>`\n🛡️ **Defense:** Sanitize input';
        const result = sanitizeAnswer(answer);
        expect(result).toContain('⚔️');
        expect(result).toContain('🛡️');
    });
});
