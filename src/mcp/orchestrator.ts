// MCP Orchestrator — routes commands to the appropriate MCP pipeline

import type { UserContext, ExplainResult, RAGResult, InteractionRecord } from '../types/index.js';
import type { Level, ExplanationStyle } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { stripOuterCodeFence } from '../utils/formatters.js';

// MCP imports (lazy-initialized)
import { ExplainMCP } from './explain/index.js';
import { RAGMCP } from './rag/index.js';
import { MemoryMCP } from './memory/index.js';
import { PreferenceMCP } from './preference/index.js';
import { PromptMCP } from './prompts/index.js';

export class MCPOrchestrator {
    private explainMCP: ExplainMCP;
    private ragMCP: RAGMCP;
    private memoryMCP: MemoryMCP;
    private preferenceMCP: PreferenceMCP;
    private promptMCP: PromptMCP;

    constructor() {
        this.explainMCP = new ExplainMCP();
        this.ragMCP = new RAGMCP();
        this.memoryMCP = new MemoryMCP();
        this.preferenceMCP = new PreferenceMCP();
        this.promptMCP = new PromptMCP();
    }

    /**
     * Orchestrate the !explain command flow:
     * 1. Get user preferences
     * 2. Check memory for prior asks
     * 3. Build prompt
     * 4. Generate explanation
     * 5. Store interaction
     */
    async handleExplain(
        userId: string,
        username: string,
        concept: string,
        level?: Level
    ): Promise<{ result: ExplainResult; userContext: UserContext }> {
        const start = Date.now();
        logger.info({ userId, concept, level }, 'Orchestrator: !explain flow started');

        // Step 1: Fetch user preferences
        const prefResponse = await this.preferenceMCP.execute({
            action: 'get',
            payload: { action: 'get' as const },
            context: this.buildMinimalContext(userId, username),
        });
        const userContext = this.buildContextFromPrefs(userId, username, prefResponse.data);

        // Use explicit level override or user's preferred level
        const effectiveLevel = level ?? userContext.preferredLevel;

        // Step 2: Check memory
        const memoryResponse = await this.memoryMCP.execute({
            action: 'retrieve',
            payload: { action: 'retrieve' as const, limit: 3 },
            context: userContext,
        });

        // Step 3: Build prompt
        const promptResponse = await this.promptMCP.execute({
            action: 'build',
            payload: {
                promptType: 'explain',
                variables: {
                    concept,
                    history: memoryResponse.data?.history ?? [],
                },
                userLevel: effectiveLevel,
            },
            context: userContext,
        });

        // Step 4: Generate explanation
        const explainResponse = await this.explainMCP.execute({
            action: 'explain',
            payload: {
                concept,
                level: effectiveLevel,
                prompt: promptResponse.data,
            },
            context: userContext,
        });

        // Null safety — if LLM call failed, provide a fallback
        const explainResult: ExplainResult = explainResponse.data ?? {
            explanation: '⚠️ Sorry, I couldn\'t generate an explanation right now. This is likely due to API rate limits. Please try again in about 30 seconds.',
            analogies: [],
            relatedConcepts: [],
            offSecModules: [],
            practicalTip: 'Try again in a moment — rate limits reset quickly.',
        };

        // Step 5: Store interaction
        await this.memoryMCP.execute({
            action: 'store',
            payload: {
                action: 'store' as const,
                data: {
                    id: crypto.randomUUID(),
                    userId,
                    command: 'explain',
                    query: concept,
                    response: explainResult.explanation ?? '',
                    level: effectiveLevel,
                    confidence: explainResponse.metadata?.confidence ?? 0.5,
                    timestamp: new Date().toISOString(),
                    topics: [concept],
                },
            },
            context: userContext,
        });

        logger.info({ userId, latencyMs: Date.now() - start }, 'Orchestrator: !explain flow completed');
        return { result: explainResult, userContext };
    }

    /**
     * Orchestrate the !ask command flow:
     * 1. Get user preferences
     * 2. Fetch recent context from memory
     * 3. Run RAG pipeline (embed → retrieve → rerank → generate)
     * 4. Store interaction
     */
    async handleAsk(
        userId: string,
        username: string,
        question: string
    ): Promise<{ result: RAGResult; userContext: UserContext }> {
        const start = Date.now();
        logger.info({ userId, question }, 'Orchestrator: !ask flow started');

        // Step 1: Fetch user preferences
        const prefResponse = await this.preferenceMCP.execute({
            action: 'get',
            payload: { action: 'get' as const },
            context: this.buildMinimalContext(userId, username),
        });
        const userContext = this.buildContextFromPrefs(userId, username, prefResponse.data);

        // Step 2: Fetch memory context
        const memoryResponse = await this.memoryMCP.execute({
            action: 'retrieve',
            payload: { action: 'retrieve' as const, limit: 3 },
            context: userContext,
        });
        userContext.recentHistory = memoryResponse.data?.history ?? [];

        // Step 3: Run RAG pipeline
        const ragResponse = await this.ragMCP.execute({
            action: 'ask',
            payload: {
                query: question,
                topK: 10,
                userLevel: userContext.preferredLevel,
                history: userContext.recentHistory,
            },
            context: userContext,
        });

        // Null safety — if LLM call failed, provide a fallback result
        const ragResult: RAGResult = ragResponse.data ?? {
            answer: '⚠️ Sorry, I couldn\'t generate a response right now. This might be due to rate limits. Please try again in a few seconds.',
            sources: [],
            confidence: 0.3,
            suggestedFollowups: [],
            keyTakeaways: [],
        };

        // Step 4: Store interaction
        await this.memoryMCP.execute({
            action: 'store',
            payload: {
                action: 'store' as const,
                data: {
                    id: crypto.randomUUID(),
                    userId,
                    command: 'ask',
                    query: question,
                    response: ragResult.answer ?? '',
                    level: userContext.preferredLevel,
                    confidence: ragResponse.metadata?.confidence ?? ragResult.confidence ?? 0.5,
                    timestamp: new Date().toISOString(),
                    topics: [],
                },
            },
            context: userContext,
        });

        logger.info({ userId, latencyMs: Date.now() - start }, 'Orchestrator: !ask flow completed');
        return { result: ragResult, userContext };
    }

    /**
     * Set user learning level.
     */
    async handleSetLevel(userId: string, username: string, level: Level): Promise<void> {
        await this.preferenceMCP.execute({
            action: 'set',
            payload: { action: 'set' as const, preferences: { preferredLevel: level } },
            context: this.buildMinimalContext(userId, username),
        });
    }

    /**
     * Get user interaction history.
     */
    async handleHistory(userId: string, username: string): Promise<{ history: InteractionRecord[]; summary?: string; totalInteractions: number } | null> {
        const context = this.buildMinimalContext(userId, username);
        const response = await this.memoryMCP.execute({
            action: 'retrieve',
            payload: { action: 'retrieve' as const, limit: 10 },
            context,
        });
        return response.data;
    }

    /**
     * Find related concepts via vector similarity.
     */
    async handleRelated(userId: string, username: string, concept: string) {
        const context = this.buildMinimalContext(userId, username);
        const response = await this.ragMCP.execute({
            action: 'related',
            payload: { query: concept, topK: 5, userLevel: context.preferredLevel },
            context,
        });
        return response.data;
    }

    /**
     * Generate an interactive quiz question on a cybersecurity topic.
     * Each call generates a DIFFERENT sub-topic question to avoid repetition.
     */
    async handleQuiz(
        userId: string,
        username: string,
        topic: string,
        questionNumber: number = 1,
        previousQuestions: string[] = [],
        totalQuestions: number = 5,
        levelOverride?: string
    ) {
        const prefs = await this.preferenceMCP.execute({
            action: 'get',
            payload: { action: 'get' },
            context: this.buildMinimalContext(userId, username),
        });
        const level = levelOverride ?? prefs?.data?.preferredLevel ?? 'intermediate';

        const { generateCompletion } = await import('../services/ai.js');

        // Build the "already asked" exclusion block
        const exclusionBlock = previousQuestions.length > 0
            ? `\nALREADY ASKED (DO NOT repeat or rephrase these):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
            : '';

        const prompt = `Generate question ${questionNumber} of a ${totalQuestions}-question cybersecurity quiz about: "${topic}"
User level: ${level}
${exclusionBlock}
DIVERSITY RULES (CRITICAL):
- This is question ${questionNumber}/${totalQuestions}. Each question MUST test a DIFFERENT sub-topic or aspect.
- For "${topic}", cover different angles like: definitions, tools, attack techniques, defenses, real-world examples, protocol details, detection methods, mitigation strategies.
- Question ${questionNumber} should NOT rephrase or reword any previous question.
- Example for "SQL injection": Q1=types of SQLi, Q2=defense tools, Q3=detection methods, Q4=real-world CVEs, Q5=WAF bypass techniques.

DIFFICULTY LEVEL: ${level}
- For beginner: focus on DEFINITIONS, basic concepts, and simple real-world analogies. Questions should be accessible to someone new to cybersecurity.
- For intermediate: focus on PRACTICAL application, tool usage (Burp Suite, Nmap, Metasploit), and real-world attack/defense scenarios.
- For expert: focus on PROTOCOL INTERNALS, CVE details, MITRE ATT&CK technique IDs, edge cases, and advanced exploitation/defense techniques.

Return ONLY valid JSON in this exact format:
{
  "question": "A specific cybersecurity question about a NEW aspect of ${topic}",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "2-3 sentence explanation of why the correct answer is right and why others are wrong.",
  "difficulty": "${level}",
  "subTopic": "The specific sub-topic this question covers (e.g., 'detection methods')"
}

RULES:
- The question MUST be factually accurate and have exactly ONE correct answer
- Options should be plausible — no obvious joke answers
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- Match the difficulty strictly to the "${level}" level described above`;

        const raw = await generateCompletion(
            'You are a cybersecurity instructor creating diverse quiz questions. Each question must test a DIFFERENT aspect of the topic. Return ONLY valid JSON.',
            prompt
        );

        const cleaned = stripOuterCodeFence(raw);
        const parsed = JSON.parse(cleaned);

        if (!parsed.question || !parsed.options || parsed.correctIndex === undefined) {
            throw new Error('Invalid quiz format from LLM');
        }

        return parsed;
    }

    // ─── Helpers ───────────────────────────────────────────────────────

    private buildMinimalContext(userId: string, username: string): UserContext {
        return {
            userId,
            username,
            preferredLevel: 'beginner',
            detectedLevel: 'beginner',
            preferredStyle: 'detailed',
            recentHistory: [],
        };
    }

    private buildContextFromPrefs(userId: string, username: string, prefs: { preferredLevel?: string; detectedLevel?: string; preferredStyle?: string } | null): UserContext {
        return {
            userId,
            username,
            preferredLevel: (prefs?.preferredLevel as Level) ?? 'beginner',
            detectedLevel: (prefs?.detectedLevel as Level) ?? 'beginner',
            preferredStyle: (prefs?.preferredStyle as ExplanationStyle) ?? 'detailed',
            recentHistory: [],
        };
    }
}
