/**
 * Pipeline integration tests — verify the FULL response enrichment chain.
 * 
 * These tests mock ONLY the AI/DB layer but let the entire pipeline run:
 * Orchestrator → MCP (Explain/RAG) → Lab/Course enrichment → Embed building
 * 
 * This catches integration bugs like:
 * - Courses not appearing in responses (dead code)  
 * - Labs injection breaking after refactors
 * - Embed builder crashing on enriched data
 * - Type mismatches between pipeline stages
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only the AI service — everything else (labs, courses, formatters) runs for real
vi.mock('../../src/services/ai.js', () => ({
    generateCompletion: vi.fn(),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    generateEmbeddings: vi.fn().mockResolvedValue([new Array(384).fill(0.1)]),
}));

// Mock ChromaDB (no vector store in tests)
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

describe('Pipeline: /ask response enrichment', () => {
    let orchestrator: InstanceType<typeof import('../../src/mcp/orchestrator.js').MCPOrchestrator>;

    beforeEach(async () => {
        const { MCPOrchestrator } = await import('../../src/mcp/orchestrator.js');
        orchestrator = new MCPOrchestrator();
    });

    it('injects labs into /ask responses for matching topics', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({
            answer: 'SQL injection is a web security vulnerability.',
            suggestedFollowups: [],
            keyTakeaways: ['Use parameterized queries'],
        }));

        const { result } = await orchestrator.handleAsk(
            'pipeline-user',
            'testuser',
            'sql injection'
        );

        // Labs should be injected into the answer text
        expect(result.answer).toContain('🔬 Hands-On Labs:');
        expect(result.answer).toContain('https://');
    });

    it('injects courses into /ask responses for matching topics', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({
            answer: 'SQL injection is a web security vulnerability.',
            suggestedFollowups: [],
            keyTakeaways: [],
        }));

        const { result } = await orchestrator.handleAsk(
            'pipeline-user',
            'testuser',
            'sql injection'
        );

        // Courses should be appended after labs
        expect(result.answer).toContain('📚 Recommended Courses:');
    });

    it('does NOT inject labs/courses for nonsense topics', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({
            answer: 'This topic does not exist.',
            suggestedFollowups: [],
            keyTakeaways: [],
        }));

        const { result } = await orchestrator.handleAsk(
            'pipeline-user',
            'testuser',
            'qqqxyznonexistent'
        );

        // No labs or courses should appear for nonsense
        expect(result.answer).not.toContain('🔬 Hands-On Labs:');
        expect(result.answer).not.toContain('📚 Recommended Courses:');
    });
});

describe('Pipeline: /explain response enrichment', () => {
    let orchestrator: InstanceType<typeof import('../../src/mcp/orchestrator.js').MCPOrchestrator>;

    beforeEach(async () => {
        const { MCPOrchestrator } = await import('../../src/mcp/orchestrator.js');
        orchestrator = new MCPOrchestrator();
    });

    it('enriches explain result with labs array', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({
            explanation: 'Cross-site scripting (XSS) allows attackers to inject client-side scripts.',
            analogies: ['Like graffiti on a shared whiteboard'],
            relatedConcepts: ['CSP', 'DOM', 'innerHTML'],
            offSecModules: [],
            practicalTip: 'Sanitize all user input',
        }));

        const { result } = await orchestrator.handleExplain(
            'pipeline-user',
            'testuser',
            'xss cross-site scripting'
        );

        // Labs should be populated as an array on the result object
        expect(result.labs).toBeDefined();
        expect(Array.isArray(result.labs)).toBe(true);
        // XSS is a well-known topic — should match labs
        expect(result.labs!.length).toBeGreaterThan(0);
        // Each lab should have required fields
        expect(result.labs![0]).toHaveProperty('name');
        expect(result.labs![0]).toHaveProperty('url');
        expect(result.labs![0]).toHaveProperty('platform');
    });

    it('enriches explain result with courses array', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({
            explanation: 'Cross-site scripting allows injection of scripts.',
            analogies: [],
            relatedConcepts: [],
            offSecModules: [],
        }));

        const { result } = await orchestrator.handleExplain(
            'pipeline-user',
            'testuser',
            'xss cross-site scripting'
        );

        // Courses should be populated as an array on the result object
        expect(result.courses).toBeDefined();
        expect(Array.isArray(result.courses)).toBe(true);
    });

    it('returns empty labs/courses for nonsense topics', async () => {
        const { generateCompletion } = await import('../../src/services/ai.js');
        (generateCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({
            explanation: 'Unknown topic.',
            analogies: [],
            relatedConcepts: [],
            offSecModules: [],
        }));

        const { result } = await orchestrator.handleExplain(
            'pipeline-user',
            'testuser',
            'qqqxyznonexistent'
        );

        expect(result.labs).toHaveLength(0);
        expect(result.courses).toHaveLength(0);
    });
});

describe('Pipeline: Embed builder renders enriched data', () => {
    it('renders labs and courses sections in explain embeds', async () => {
        const { buildExplainEmbed } = await import('../../src/bot/embeds/explain.js');

        const result = {
            explanation: 'SQL injection allows attackers to interfere with queries.',
            analogies: ['Like ordering food with hidden instructions'],
            relatedConcepts: ['Parameterized queries', 'WAF'],
            offSecModules: [],
            confidence: 0.9,
            practicalTip: 'Always use prepared statements',
            labs: [
                { name: 'SQL Injection', url: 'https://portswigger.net/web-security/sql-injection', platform: 'PortSwigger', level: 'beginner' },
            ],
            courses: [
                { name: 'Web Security Academy', url: 'https://portswigger.net/web-security', platform: 'PortSwigger', free: true },
            ],
        };

        const embeds = buildExplainEmbed('sql injection', 'beginner', result, '1.2');

        // Verify embeds are produced
        expect(embeds.length).toBeGreaterThan(0);

        // Get the full embed text
        const fullText = embeds.map(e => e.data.description ?? '').join(' ');

        // Labs section should be rendered
        expect(fullText).toContain('🔬 Hands-On Labs:');
        expect(fullText).toContain('SQL Injection');

        // Courses section should be rendered  
        expect(fullText).toContain('📚 Recommended Courses:');
        expect(fullText).toContain('Web Security Academy');
    });

    it('renders explain embed without labs/courses when empty', async () => {
        const { buildExplainEmbed } = await import('../../src/bot/embeds/explain.js');

        const result = {
            explanation: 'Some topic explanation.',
            analogies: [],
            relatedConcepts: [],
            offSecModules: [],
            confidence: 0.8,
            labs: [],
            courses: [],
        };

        const embeds = buildExplainEmbed('test', 'beginner', result, '0.5');
        const fullText = embeds.map(e => e.data.description ?? '').join(' ');

        // Should NOT have labs/courses sections
        expect(fullText).not.toContain('🔬 Hands-On Labs:');
        expect(fullText).not.toContain('📚 Recommended Courses:');
    });
});
