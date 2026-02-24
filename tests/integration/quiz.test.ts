// Tests for handleQuiz orchestrator method (with mocked LLM)
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LLM service
vi.mock('../../src/services/ai.js', () => ({
    generateCompletion: vi.fn(),
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

const VALID_QUIZ_RESPONSE = {
    question: 'What is the primary purpose of parameterized queries?',
    options: [
        'To prevent SQL injection attacks',
        'To speed up database queries',
        'To compress query results',
        'To encrypt database connections',
    ],
    correctIndex: 0,
    explanation: 'Parameterized queries separate SQL logic from data, preventing attackers from injecting malicious SQL.',
    difficulty: 'intermediate',
    subTopic: 'defense mechanisms',
};

const SECOND_QUIZ_RESPONSE = {
    question: 'Which type of SQL injection returns data through error messages?',
    options: [
        'Blind SQL injection',
        'Error-based SQL injection',
        'Union-based SQL injection',
        'Time-based SQL injection',
    ],
    correctIndex: 1,
    explanation: 'Error-based SQLi extracts data by triggering database error messages that reveal information.',
    difficulty: 'intermediate',
    subTopic: 'attack types',
};

describe('MCPOrchestrator.handleQuiz', () => {
    let orchestrator: any;

    beforeEach(async () => {
        const { MCPOrchestrator } = await import('../../src/mcp/orchestrator.js');
        orchestrator = new MCPOrchestrator();
    });

    it('returns a valid quiz question with all required fields', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as any).mockResolvedValueOnce(JSON.stringify(VALID_QUIZ_RESPONSE));

        const result = await orchestrator.handleQuiz('user1', 'testuser', 'SQL injection');

        expect(result.question).toBe(VALID_QUIZ_RESPONSE.question);
        expect(result.options).toHaveLength(4);
        expect(result.correctIndex).toBe(0);
        expect(result.explanation).toBeDefined();
        expect(result.difficulty).toBe('intermediate');
    });

    it('passes questionNumber and previousQuestions to avoid repetition', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        // Use mockImplementation to catch all calls (dynamic imports may re-resolve)
        (generateCompletion as any).mockImplementation(async (sys: string, prompt: string) => {
            // Check if this is the quiz prompt (not a preference prompt)
            if (prompt.includes('quiz') || prompt.includes('DIVERSITY')) {
                return JSON.stringify(SECOND_QUIZ_RESPONSE);
            }
            // Default for any non-quiz calls (e.g., preference detection)
            return JSON.stringify({ answer: 'ok' });
        });

        const previousQuestions = [VALID_QUIZ_RESPONSE.question];
        const result = await orchestrator.handleQuiz('user1', 'testuser', 'SQL injection', 2, previousQuestions);

        expect(result.question).not.toBe(VALID_QUIZ_RESPONSE.question);
        expect(result.subTopic).toBe('attack types');
    });

    it('throws on invalid LLM response (missing fields)', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as any).mockResolvedValueOnce(JSON.stringify({ text: 'just a string' }));

        await expect(
            orchestrator.handleQuiz('user1', 'testuser', 'SQL injection')
        ).rejects.toThrow('Invalid quiz format from LLM');
    });

    it('throws on unparseable response', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as any).mockResolvedValueOnce('not json at all');

        await expect(
            orchestrator.handleQuiz('user1', 'testuser', 'SQL injection')
        ).rejects.toThrow();
    });

    it('handles code-fenced JSON responses from LLM', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        const fencedJson = '```json\n' + JSON.stringify(VALID_QUIZ_RESPONSE) + '\n```';
        (generateCompletion as any).mockResolvedValueOnce(fencedJson);

        const result = await orchestrator.handleQuiz('user1', 'testuser', 'SQL injection');
        expect(result.question).toBe(VALID_QUIZ_RESPONSE.question);
    });

    it('includes subTopic field in response when available', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as any).mockResolvedValueOnce(JSON.stringify(VALID_QUIZ_RESPONSE));

        const result = await orchestrator.handleQuiz('user1', 'testuser', 'SQL injection');
        expect(result.subTopic).toBe('defense mechanisms');
    });
});
