// Integration tests for MCP orchestrator (with mocked LLM)
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LLM service to avoid real API calls
vi.mock('../../src/services/ai.js', () => ({
    generateCompletion: vi.fn().mockResolvedValue(JSON.stringify({
        answer: 'SQL injection is a code injection technique that exploits vulnerabilities in data-driven applications.',
        sources: [{ text: 'OWASP', source: 'OWASP Top 10', relevance: 0.9 }],
        confidence: 0.85,
        suggestedFollowups: ['What is XSS?', 'How to prevent SQL injection?'],
        keyTakeaways: ['Always use parameterized queries', 'Never trust user input'],
    })),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    generateEmbeddings: vi.fn().mockResolvedValue([new Array(384).fill(0.1)]),
}));

// Mock ChromaDB
vi.mock('../../src/db/chroma.js', () => ({
    getChromaCollection: vi.fn().mockResolvedValue(null),
    addDocuments: vi.fn().mockResolvedValue(undefined),
    queryDocuments: vi.fn().mockResolvedValue({
        ids: [], documents: [], metadatas: [], distances: [],
    }),
}));

// Mock SQLite
vi.mock('../../src/db/sqlite.js', () => ({
    getDatabase: vi.fn().mockResolvedValue({}),
    dbRun: vi.fn(),
    dbGet: vi.fn().mockReturnValue({ cnt: 0, concepts_explored: '[]' }),
    dbAll: vi.fn().mockReturnValue([]),
    saveDatabase: vi.fn(),
}));

describe('MCPOrchestrator', () => {
    let orchestrator: any;

    beforeEach(async () => {
        const { MCPOrchestrator } = await import('../../src/mcp/orchestrator.js');
        orchestrator = new MCPOrchestrator();
    });

    describe('handleAsk', () => {
        it('returns a result with answer, confidence, and suggestions', async () => {
            const { result, userContext } = await orchestrator.handleAsk(
                'test-user-123',
                'testuser',
                'What is SQL injection?'
            );

            expect(result).toBeDefined();
            expect(result.answer).toBeDefined();
            expect(typeof result.answer).toBe('string');
            expect(result.answer.length).toBeGreaterThan(0);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            expect(userContext.userId).toBe('test-user-123');
        });

        it('returns suggested followups', async () => {
            const { result } = await orchestrator.handleAsk(
                'test-user-123',
                'testuser',
                'What is SQL injection?'
            );

            expect(Array.isArray(result.suggestedFollowups)).toBe(true);
        });

        it('handles empty question gracefully', async () => {
            const { result } = await orchestrator.handleAsk(
                'test-user-123',
                'testuser',
                ''
            );

            expect(result).toBeDefined();
            expect(typeof result.answer).toBe('string');
        });
    });

    describe('handleExplain', () => {
        it('returns an explanation with analogies and related concepts', async () => {
            const { generateCompletion } = await import('../../src/services/ai.js');
            (generateCompletion as any).mockResolvedValueOnce(JSON.stringify({
                explanation: 'A buffer overflow occurs when...',
                analogies: ['Like pouring too much water into a glass'],
                relatedConcepts: ['Stack', 'Heap', 'Memory safety'],
                offSecModules: [],
                practicalTip: 'Always validate input lengths',
            }));

            const { result, userContext } = await orchestrator.handleExplain(
                'test-user-123',
                'testuser',
                'buffer overflow'
            );

            expect(result.explanation).toBeDefined();
            expect(typeof result.explanation).toBe('string');
            expect(userContext.preferredLevel).toBeDefined();
        });

        it('respects level override', async () => {
            const { generateCompletion } = await import('../../src/services/ai.js');
            (generateCompletion as any).mockResolvedValueOnce(JSON.stringify({
                explanation: 'Expert-level explanation...',
                analogies: [],
                relatedConcepts: [],
                offSecModules: [],
            }));

            const { result } = await orchestrator.handleExplain(
                'test-user-123',
                'testuser',
                'buffer overflow',
                'expert'
            );

            expect(result).toBeDefined();
        });
    });

    describe('handleSetLevel', () => {
        it('completes without error for valid levels', async () => {
            await expect(
                orchestrator.handleSetLevel('test-user-123', 'testuser', 'beginner')
            ).resolves.toBeUndefined();

            await expect(
                orchestrator.handleSetLevel('test-user-123', 'testuser', 'expert')
            ).resolves.toBeUndefined();
        });
    });

    describe('handleHistory', () => {
        it('returns history object', async () => {
            const result = await orchestrator.handleHistory('test-user-123', 'testuser');
            expect(result).toBeDefined();
            expect(Array.isArray(result.history)).toBe(true);
        });
    });

    describe('handleRelated', () => {
        it('returns related topics', async () => {
            const result = await orchestrator.handleRelated(
                'test-user-123',
                'testuser',
                'privilege escalation'
            );

            expect(result).toBeDefined();
        });
    });
});
