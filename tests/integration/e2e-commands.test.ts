// E2E integration tests — mock Discord client + orchestrator for full command flows
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../src/utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

vi.mock('../../src/services/health.js', () => ({
    incrementErrorCount: vi.fn(),
    getStats: vi.fn(() => ({ status: 'healthy' })),
    startHealthServer: vi.fn(),
}));
vi.mock('../../src/config/index.js', () => ({
    config: {
        ai: {
            gemini1: { apiKey: 'k1', model: 'm1' },
            gemini2: { apiKey: '', model: '' },
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
        rateLimit: { perUser: 10, windowMs: 60000 },
        monitoring: { healthPort: 3001 },
    },
}));

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
        Client: class { },
        Events: { InteractionCreate: 'interactionCreate', MessageCreate: 'messageCreate' },
        ActionRowBuilder: class { addComponents() { return this; } },
        ButtonBuilder: class { setCustomId() { return this; } setLabel() { return this; } setStyle() { return this; } setEmoji() { return this; } },
        ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },
        ComponentType: { Button: 2 },
    };
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('E2E Command Flows', () => {
    describe('/ask prefix command', () => {
        it('replies with error embed for empty input', async () => {
            const replyMock = vi.fn().mockResolvedValue({
                edit: vi.fn(),
            });

            const mockMessage: any = {
                author: { id: 'user-123', username: 'testuser', bot: false },
                content: '/ask',
                channel: { sendTyping: vi.fn(), send: vi.fn() },
                reply: replyMock,
            };

            // Import after mocks
            const { handleAskCommand } = await import('../../src/bot/commands/ask.js');
            const mockOrchestrator: any = {
                handleAsk: vi.fn(),
            };

            await handleAskCommand(mockMessage, [], mockOrchestrator);

            expect(replyMock).toHaveBeenCalledTimes(1);
            const callArgs = replyMock.mock.calls[0][0];
            expect(callArgs.embeds).toBeDefined();
            expect(callArgs.embeds.length).toBe(1);
        });

        it('replies with error embed for too-long input', async () => {
            const replyMock = vi.fn().mockResolvedValue({
                edit: vi.fn(),
            });

            const mockMessage: any = {
                author: { id: 'user-123', username: 'testuser', bot: false },
                content: '/ask ' + 'A'.repeat(2001),
                channel: { sendTyping: vi.fn(), send: vi.fn() },
                reply: replyMock,
            };

            const { handleAskCommand } = await import('../../src/bot/commands/ask.js');
            const longArgs = ['A'.repeat(2001)];

            await handleAskCommand(mockMessage, longArgs, {} as any);

            expect(replyMock).toHaveBeenCalledTimes(1);
            const embed = replyMock.mock.calls[0][0].embeds[0];
            expect(embed.toJSON().title).toContain('Input too long');
        });
    });

    describe('/explain prefix command', () => {
        it('replies with error embed for empty concept', async () => {
            const replyMock = vi.fn().mockResolvedValue({});

            const mockMessage: any = {
                author: { id: 'user-123', username: 'testuser', bot: false },
                content: '/explain',
                channel: { sendTyping: vi.fn(), send: vi.fn() },
                reply: replyMock,
            };

            const { handleExplainCommand } = await import('../../src/bot/commands/explain.js');
            await handleExplainCommand(mockMessage, [], {} as any);

            expect(replyMock).toHaveBeenCalledTimes(1);
            const embed = replyMock.mock.calls[0][0].embeds[0];
            expect(embed.toJSON().title).toContain('Missing concept');
        });
    });

    describe('/related prefix command', () => {
        it('replies with error embed for empty concept', async () => {
            const replyMock = vi.fn().mockResolvedValue({});

            const mockMessage: any = {
                author: { id: 'user-123', username: 'testuser', bot: false },
                content: '/related',
                channel: { sendTyping: vi.fn(), send: vi.fn() },
                reply: replyMock,
            };

            const { handleRelatedCommand } = await import('../../src/bot/commands/related.js');
            await handleRelatedCommand(mockMessage, [], {} as any);

            expect(replyMock).toHaveBeenCalledTimes(1);
            const embed = replyMock.mock.calls[0][0].embeds[0];
            expect(embed.toJSON().title).toContain('Missing concept');
        });

        it('replies with error embed for too-long input', async () => {
            const replyMock = vi.fn().mockResolvedValue({});

            const mockMessage: any = {
                author: { id: 'user-123', username: 'testuser', bot: false },
                channel: { sendTyping: vi.fn(), send: vi.fn() },
                reply: replyMock,
            };

            const { handleRelatedCommand } = await import('../../src/bot/commands/related.js');
            await handleRelatedCommand(mockMessage, ['B'.repeat(2001)], {} as any);

            expect(replyMock).toHaveBeenCalled();
        });
    });

    describe('/setlevel prefix command', () => {
        it('shows usage for invalid level', async () => {
            const replyMock = vi.fn().mockResolvedValue({});

            const mockMessage: any = {
                author: { id: 'user-123', username: 'testuser', bot: false },
                channel: {},
                reply: replyMock,
            };

            const { handleSetLevelCommand } = await import('../../src/bot/commands/setlevel.js');
            await handleSetLevelCommand(mockMessage, ['noob'], {} as any);

            expect(replyMock).toHaveBeenCalledTimes(1);
            const embed = replyMock.mock.calls[0][0].embeds[0];
            expect(embed.toJSON().title).toContain('Set Your Skill Level');
        });

        it('shows usage when no level provided', async () => {
            const replyMock = vi.fn().mockResolvedValue({});

            const mockMessage: any = {
                author: { id: 'user-123', username: 'testuser', bot: false },
                channel: {},
                reply: replyMock,
            };

            const { handleSetLevelCommand } = await import('../../src/bot/commands/setlevel.js');
            await handleSetLevelCommand(mockMessage, [], {} as any);

            expect(replyMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error recovery', () => {
        it('shows error embed when orchestrator throws', async () => {
            const editMock = vi.fn().mockResolvedValue({});
            const replyMock = vi.fn().mockResolvedValue({ edit: editMock });

            const mockMessage: any = {
                author: { id: 'user-123', username: 'testuser' },
                channel: { sendTyping: vi.fn(), send: vi.fn() },
                reply: replyMock,
            };

            const mockOrchestrator: any = {
                handleAsk: vi.fn().mockRejectedValue(new Error('LLM is down')),
            };

            const { handleAskCommand } = await import('../../src/bot/commands/ask.js');
            await handleAskCommand(mockMessage, ['test', 'question'], mockOrchestrator);

            // Should have called reply for thinking + edit for error
            expect(editMock).toHaveBeenCalledTimes(1);
            const errorEmbed = editMock.mock.calls[0][0].embeds[0];
            expect(errorEmbed.toJSON().title).toContain('Something went wrong');
        });
    });

    // ─── Happy Path Tests ────────────────────────────────────────────

    describe('/ask happy path', () => {
        it('shows answer embed with key takeaways and follow-ups', async () => {
            const editMock = vi.fn().mockResolvedValue({});
            const replyMock = vi.fn().mockResolvedValue({ edit: editMock });

            const mockMessage: any = {
                author: { id: 'user-hp', username: 'hpuser' },
                channel: { sendTyping: vi.fn(), send: vi.fn() },
                reply: replyMock,
            };

            const mockOrchestrator: any = {
                handleAsk: vi.fn().mockResolvedValue({
                    result: {
                        answer: 'SQL injection is a code injection technique...',
                        confidence: 0.85,
                        keyTakeaways: ['Always use parameterized queries', 'Never trust user input'],
                        suggestedFollowups: ['What is blind SQL injection?'],
                    },
                    userContext: { preferredLevel: 'intermediate' },
                }),
            };

            const { handleAskCommand } = await import('../../src/bot/commands/ask.js');
            await handleAskCommand(mockMessage, ['What', 'is', 'SQL', 'injection?'], mockOrchestrator);

            // Thinking embed is sent first, then replaced with answer
            expect(replyMock).toHaveBeenCalledTimes(1);
            expect(editMock).toHaveBeenCalledTimes(1);

            const editArgs = editMock.mock.calls[0][0];
            const embed = editArgs.embeds[0];
            const json = embed.toJSON();

            // Title should have the question and success icon
            expect(json.title).toContain('SQL injection?');
            // Description should have the answer, takeaways, and follow-ups
            expect(json.description).toContain('SQL injection is a code injection technique');
            expect(json.description).toContain('parameterized queries');
            expect(json.description).toContain('/ask What is blind SQL injection?');
            // Footer should contain response time
            expect(json.footer.text).toContain('⚡');
        });
    });

    describe('/explain happy path', () => {
        it('builds explain embed with explanation and analogies', async () => {
            const editMock = vi.fn().mockResolvedValue({});
            const replyMock = vi.fn().mockResolvedValue({ edit: editMock });

            const mockMessage: any = {
                author: { id: 'user-hp2', username: 'hpuser2' },
                channel: { sendTyping: vi.fn(), send: vi.fn() },
                reply: replyMock,
            };

            const mockOrchestrator: any = {
                handleExplain: vi.fn().mockResolvedValue({
                    result: {
                        explanation: 'Buffer overflow occurs when data exceeds buffer boundaries...',
                        analogies: ['Like overfilling a glass of water'],
                        practicalTip: 'Use memory-safe languages like Rust',
                        relatedConcepts: ['Stack smashing', 'Heap overflow'],
                        offSecModules: ['PEN-200 Module 19'],
                    },
                    userContext: { preferredLevel: 'beginner' },
                }),
            };

            const { handleExplainCommand } = await import('../../src/bot/commands/explain.js');
            await handleExplainCommand(mockMessage, ['buffer', 'overflow'], mockOrchestrator);

            expect(editMock).toHaveBeenCalledTimes(1);
            const embed = editMock.mock.calls[0][0].embeds[0];
            const json = embed.toJSON();

            expect(json.title).toContain('buffer overflow');
            expect(json.description).toContain('Buffer overflow occurs');
            expect(json.description).toContain('overfilling a glass');
            expect(json.description).toContain('Rust');
            expect(json.footer.text).toContain('⚡');
        });
    });

    describe('/setlevel happy path', () => {
        it('shows premium success embed with motivation and changes', async () => {
            const replyMock = vi.fn().mockResolvedValue({});

            const mockMessage: any = {
                author: { id: 'user-hp3', username: 'hpuser3' },
                channel: {},
                reply: replyMock,
            };

            const mockOrchestrator: any = {
                handleSetLevel: vi.fn().mockResolvedValue(undefined),
            };

            const { handleSetLevelCommand } = await import('../../src/bot/commands/setlevel.js');
            await handleSetLevelCommand(mockMessage, ['expert'], mockOrchestrator);

            expect(replyMock).toHaveBeenCalledTimes(1);
            const embed = replyMock.mock.calls[0][0].embeds[0];
            const json = embed.toJSON();

            // Title should have level emoji and name
            expect(json.title).toContain('Expert');
            expect(json.title).toContain('🔬');
            // Description should have motivational message
            expect(json.description).toContain('deep end');
            // Fields should list what changes
            expect(json.fields).toBeDefined();
            expect(json.fields.length).toBeGreaterThanOrEqual(2);
        });
    });
});
