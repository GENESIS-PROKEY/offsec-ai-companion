// RAG MCP — retrieval-augmented generation pipeline with LLM fallback

import { BaseMCP } from '../base.js';
import type { MCPRequest, RAGResult, Citation, InteractionRecord, ParsedRAGResponse } from '../../types/index.js';
import type { Level } from '../../config/constants.js';
import { generateCompletion, generateEmbedding } from '../../services/ai.js';
import { queryDocuments } from '../../db/chroma.js';
import { config } from '../../config/index.js';
import { CONFIDENCE, getMaxTokensForLevel } from '../../config/constants.js';
import { sanitizeAnswer } from '../../utils/formatters.js';
import { getCached, setCache, makeCacheKey } from '../../services/cache.js';
import { logger } from '../../utils/logger.js';
import { SYSTEM_PROMPT, SAFETY_RULES } from '../prompts/templates/index.js';
import { getLabsForTopic, formatLabsForEmbed } from '../../utils/labs.js';
import { getCoursesForTopic, formatCoursesForEmbed } from '../../utils/courses.js';

interface RAGPayload {
    query: string;
    topK?: number;
    filters?: { source?: string; category?: string };
    userLevel: Level;
    history?: InteractionRecord[];
}

// ─── Prompt for LLM-only mode (no ChromaDB) ─────────────────────────

const DETAILED_ASK_INSTRUCTIONS = `
Provide a focused, well-structured cybersecurity answer. Keep it detailed but concise — aim for about 2000-3000 characters total in the answer field.

Include these sections in your answer (use emoji headers):

**📖 Overview** — 2-3 sentence direct answer

**🔍 How It Works** — Numbered steps, clear mechanism explanation

**⚔️ Attack & Defense** — Attack techniques + specific defenses/mitigations (combined)

**🔧 Tools** — Relevant tools with brief descriptions (offensive + defensive)

**🎓 Practice & Training** — Mention that hands-on labs are available for this topic (do NOT fabricate lab names or URLs — real labs will be appended automatically)

FORMATTING:
- Bullet points (•) and numbered lists — no walls of text
- **Bold** key terms, \`code blocks\` for commands/tools
- Adjust depth for user level (beginner=analogies, intermediate=practical, expert=CVEs/internals)
- Be CONCISE but thorough — quality over quantity`;

const LLM_ANSWER_PROMPT = `You are answering a cybersecurity question directly from your knowledge.

USER QUESTION: {question}
USER LEVEL: {level}

CONVERSATION HISTORY:
{recent_history}

${DETAILED_ASK_INSTRUCTIONS}

NEVER provide instructions for unauthorized system access. Always emphasize authorized testing.

You MUST respond with ONLY a valid JSON object. Do NOT include any text before or after the JSON. No commentary, no explanation outside the JSON.

JSON format:
{
  "answer": "Your DETAILED answer using ALL sections listed above, with bullet points, code blocks, and emojis throughout",
  "suggestedFollowups": ["follow-up question 1", "follow-up question 2", "follow-up question 3"],
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"]
}`;

const RAG_ANSWER_PROMPT = `You are answering a cybersecurity question using retrieved knowledge and your expertise.

USER QUESTION: {question}
USER LEVEL: {level}

RETRIEVED CONTEXT:
{chunks_with_source_ids}

CONVERSATION HISTORY:
{recent_history}

${DETAILED_ASK_INSTRUCTIONS}

Additional RAG-specific rules:
- Use the retrieved context as your PRIMARY source
- Cite sources using [N] notation inline
- If the context doesn't fully cover the question, supplement with your knowledge and note when doing so
- If multiple sources conflict, note the discrepancy

You MUST respond with ONLY a valid JSON object. Do NOT include any text before or after the JSON.

JSON format:
{
  "answer": "Your DETAILED answer using ALL sections listed above, with [1] inline citations, bullet points, and code blocks throughout",
  "suggestedFollowups": ["follow-up 1", "follow-up 2", "follow-up 3"],
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"]
}`;

const RELATED_PROMPT = `You are a cybersecurity knowledge graph expert. Given a cybersecurity concept, provide a COMPREHENSIVE analysis of related topics.

CONCEPT: {concept}
USER LEVEL: {level}

You MUST provide ALL of the following sections:

1. **📖 Overview** — Detailed explanation of {concept} and why it matters in cybersecurity
2. **🔗 Related Topics** — Identify 8-10 closely related concepts. For EACH one, provide:
   • The topic name
   • How it relates (attack chain, defensive pairing, prerequisite, consequence, etc.)
   • Whether it's offensive (⚔️), defensive (🛡️), or foundational (📖)
   • A one-line explanation of what it is
3. **🗺️ Learning Path** — Recommended order to study these topics (numbered steps)
4. **⚔️ Attack Chain** — How these topics connect in a real attack scenario
5. **🛡️ Defense Stack** — How these topics connect in a defense-in-depth strategy
6. **💡 Key Takeaways** — Most important connections to understand

IMPORTANT: Use bullet points throughout. Be DETAILED. Adjust language for user level but keep the same depth.
Do NOT fabricate lab names or URLs — real hands-on labs will be appended automatically after your response.

You MUST respond with ONLY a valid JSON object. Do NOT include any text before or after the JSON.

JSON format:
{
  "answer": "Your DETAILED analysis using ALL sections above, with bullet points and emojis",
  "relatedTopics": [
    {"name": "Topic Name", "relationship": "How it relates", "category": "offensive|defensive|foundational"},
    ...
  ],
  "suggestedFollowups": ["What should I learn about X?", "How does Y connect to Z?", "Explain the attack chain involving..."],
  "learningPath": "Recommended order to study these topics"
}`;

export class RAGMCP extends BaseMCP<RAGPayload, RAGResult> {
    private lastConfidence = 0;

    constructor() {
        super('RAGMCP');
    }

    protected async handle(request: MCPRequest<RAGPayload>): Promise<RAGResult> {
        const { query, topK = config.rag.topK, filters, userLevel, history } = request.payload;
        const action = request.action;

        // If this is a "related" query, use LLM to find related topics
        if (action === 'related') {
            return this.findRelated(query, userLevel);
        }

        // Try RAG pipeline first, fall back to LLM-only if ChromaDB is down
        try {
            const ragResult = await this.ragPipeline(query, topK, filters, userLevel, history);
            if (ragResult) return ragResult;
        } catch (error) {
            logger.warn({ error }, 'RAG pipeline failed, falling back to LLM-only mode');
        }

        // LLM-only fallback
        return this.llmOnlyAnswer(query, userLevel, history);
    }

    /**
     * Full RAG pipeline: embed → search → rerank → generate
     */
    private async ragPipeline(
        query: string,
        topK: number,
        filters: Record<string, unknown> | undefined,
        userLevel: Level,
        history?: InteractionRecord[]
    ): Promise<RAGResult | null> {
        // Step 1: Embed the query
        const queryEmbedding = await generateEmbedding(query);

        // Step 2: Search ChromaDB
        const results = await queryDocuments(queryEmbedding, topK, filters as Record<string, string>);

        if (results.ids.length === 0) {
            return null; // Trigger LLM fallback
        }

        // Step 3: Score and filter chunks
        const scoredChunks = results.ids.map((id, i) => ({
            id,
            content: results.documents[i],
            metadata: results.metadatas[i],
            distance: results.distances[i],
            similarity: 1 - results.distances[i],
        }));

        // Step 3b: Hybrid keyword boost — exact term matches rank higher
        // This helps queries like "CVE-2021-44228" or specific tool names
        // that embeddings alone may not capture precisely
        const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        for (const chunk of scoredChunks) {
            const contentLower = chunk.content.toLowerCase();
            for (const term of queryTerms) {
                if (contentLower.includes(term)) chunk.similarity += 0.05;
            }
        }

        const relevantChunks = scoredChunks
            .filter((c) => c.similarity >= 0.3)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, config.rag.rerankTop);

        if (relevantChunks.length === 0) {
            return null; // Trigger LLM fallback
        }

        // Step 4: Build context string
        const chunksWithIds = relevantChunks
            .map((c, i) => `[${i + 1}] Source: ${c.metadata.source ?? 'Unknown'}\n${c.content}`)
            .join('\n\n---\n\n');

        // Step 5: Build prompt
        const historyStr = this.formatHistory(history);
        const prompt = RAG_ANSWER_PROMPT
            .replace('{question}', query)
            .replace('{level}', userLevel)
            .replace('{chunks_with_source_ids}', chunksWithIds)
            .replace('{recent_history}', historyStr);

        const rawResponse = await generateCompletion(
            SYSTEM_PROMPT + '\n\n' + SAFETY_RULES,
            prompt,
            { temperature: 0.5, maxTokens: getMaxTokensForLevel(config.ai.maxTokens, userLevel) }
        );

        // Step 6: Parse response
        const parsed = this.parseJSON(rawResponse);

        // Step 7: Build citations
        const citations: Citation[] = relevantChunks.map((c) => ({
            text: c.content.slice(0, 150) + '...',
            source: (c.metadata.source as string) ?? 'Unknown',
            url: (c.metadata.url as string) ?? undefined,
            relevance: c.similarity,
        }));

        const avgSimilarity = relevantChunks.reduce((sum, c) => sum + c.similarity, 0) / relevantChunks.length;
        this.lastConfidence = Math.min(avgSimilarity + 0.1, 1.0);

        // Append real labs and courses to answer
        let answer = this.appendLabs(parsed.answer ?? rawResponse, query, userLevel);
        answer = this.appendCourses(answer, query, userLevel);

        return {
            answer,
            sources: citations,
            confidence: this.lastConfidence,
            suggestedFollowups: parsed.suggestedFollowups ?? [],
            keyTakeaways: parsed.keyTakeaways ?? [],
        };
    }

    /**
     * LLM-only fallback when ChromaDB is unavailable.
     */
    private async llmOnlyAnswer(
        query: string,
        userLevel: Level,
        history?: InteractionRecord[]
    ): Promise<RAGResult> {
        logger.info({ query, userLevel }, 'Using LLM-only mode (no RAG)');

        const historyStr = this.formatHistory(history);
        const prompt = LLM_ANSWER_PROMPT
            .replace('{question}', query)
            .replace('{level}', userLevel)
            .replace('{recent_history}', historyStr);

        // Check cache first (LLM-only mode only — RAG results change with ingested data)
        const cacheKey = makeCacheKey('ask', query, userLevel);
        const cached = getCached(cacheKey);

        let rawResponse: string;
        if (cached) {
            logger.info({ query, userLevel }, '⚡ Cache HIT — skipping LLM call');
            rawResponse = cached;
        } else {
            rawResponse = await generateCompletion(
                SYSTEM_PROMPT + '\n\n' + SAFETY_RULES,
                prompt,
                { temperature: 0.6, maxTokens: getMaxTokensForLevel(config.ai.maxTokens, userLevel) }
            );
            setCache(cacheKey, rawResponse);
        }

        const parsed = this.parseJSON(rawResponse);
        this.lastConfidence = 0.5; // LLM-only: medium confidence (no retrieval backing)

        // Append real labs and courses to answer
        let answer = this.appendLabs(parsed.answer ?? rawResponse, query, userLevel);
        answer = this.appendCourses(answer, query, userLevel);

        return {
            answer,
            sources: [],
            confidence: this.lastConfidence,
            suggestedFollowups: parsed.suggestedFollowups ?? [],
            keyTakeaways: parsed.keyTakeaways ?? [],
        };
    }

    /**
     * Find related concepts using LLM (works without ChromaDB).
     */
    private async findRelated(concept: string, userLevel: Level): Promise<RAGResult> {
        const prompt = RELATED_PROMPT
            .replaceAll('{concept}', concept)
            .replace('{level}', userLevel);

        // Check cache for related topics
        const cacheKey = makeCacheKey('related', concept, userLevel);
        const cached = getCached(cacheKey);

        let rawResponse: string;
        if (cached) {
            logger.info({ concept, userLevel }, '⚡ Cache HIT — skipping LLM call');
            rawResponse = cached;
        } else {
            rawResponse = await generateCompletion(
                SYSTEM_PROMPT + '\n\n' + SAFETY_RULES,
                prompt,
                { temperature: 0.5, maxTokens: getMaxTokensForLevel(config.ai.maxTokens, userLevel) }
            );
            setCache(cacheKey, rawResponse);
        }

        const parsed = this.parseJSON(rawResponse);
        this.lastConfidence = 0.7; // Related: no retrieval, but LLM is well-suited for this

        // Format related topics into readable answer
        let answer = parsed.answer ?? `Here are topics related to **${concept}**:`;
        if (parsed.relatedTopics && parsed.relatedTopics.length > 0) {
            answer += '\n\n' + parsed.relatedTopics
                .map((t: { name?: string; relationship?: string; category?: string }, i: number) => {
                    const icon = t.category === 'offensive' ? '⚔️' :
                        t.category === 'defensive' ? '🛡️' : '📖';
                    return `${icon} **${i + 1}. ${t.name}**\n↳ ${t.relationship}`;
                })
                .join('\n\n');
        }

        if (parsed.learningPath) {
            answer += `\n\n📚 **Recommended Learning Path:**\n${parsed.learningPath}`;
        }

        return {
            answer,
            sources: [],
            confidence: this.lastConfidence,
            suggestedFollowups: parsed.suggestedFollowups ?? [
                `Explain ${concept}`,
                `What are common ${concept} attack vectors?`,
            ],
        };
    }

    private formatHistory(history?: InteractionRecord[]): string {
        if (!history || history.length === 0) return 'No previous interactions.';
        return history
            .slice(-3)
            .map((h) => `Q: ${h.query}\nA: ${h.response?.slice(0, 100)}...`)
            .join('\n---\n');
    }



    private parseJSON(raw: string): ParsedRAGResponse {
        // Strip ONLY the outermost code fence (```json ... ```) without
        // destroying code blocks nested INSIDE JSON string values.
        // Uses greedy regex anchored to ^ and $ — matches outer fence only.
        let cleaned = raw.trim();
        const outerFence = cleaned.match(/^```(?:json|JSON)?\s*\n([\s\S]*)\n\s*```\s*$/);
        if (outerFence) {
            cleaned = outerFence[1].trim();
        } else {
            // Strip stray fence markers at start/end only
            cleaned = cleaned
                .replace(/^```(?:json|JSON)?\s*\n?/, '')
                .replace(/\n?\s*```\s*$/, '')
                .trim();
        }

        // Attempt 1: Direct parse (ideal case — LLM returned pure JSON)
        try {
            const parsed = JSON.parse(cleaned);
            if (parsed.answer) parsed.answer = sanitizeAnswer(parsed.answer);
            return parsed;
        } catch { /* fall through */ }

        // Attempt 2: Extract JSON object from mixed content (text + JSON)
        try {
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.answer) {
                    parsed.answer = sanitizeAnswer(parsed.answer);
                    return parsed;
                }
            }
        } catch { /* fall through */ }

        // Attempt 3: Try to find JSON after a newline (common pattern)
        try {
            const lines = cleaned.split('\n');
            const jsonStartIdx = lines.findIndex(l => l.trimStart().startsWith('{'));
            if (jsonStartIdx >= 0) {
                const jsonStr = lines.slice(jsonStartIdx).join('\n');
                const parsed = JSON.parse(jsonStr);
                if (parsed.answer) {
                    parsed.answer = sanitizeAnswer(parsed.answer);
                    return parsed;
                }
            }
        } catch { /* fall through */ }

        // Attempt 4: Regex extract of "answer" field value directly
        // This handles malformed JSON where JSON.parse fails but the answer field is there
        try {
            const answerMatch = cleaned.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/);
            if (answerMatch) {
                const answer = sanitizeAnswer(answerMatch[1]);
                // Try to extract other fields too
                const followupsMatch = cleaned.match(/"suggestedFollowups"\s*:\s*\[([\s\S]*?)\]/);
                const takeawaysMatch = cleaned.match(/"keyTakeaways"\s*:\s*\[([\s\S]*?)\]/);
                return {
                    answer,
                    suggestedFollowups: followupsMatch
                        ? followupsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) ?? []
                        : [],
                    keyTakeaways: takeawaysMatch
                        ? takeawaysMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) ?? []
                        : [],
                };
            }
        } catch { /* fall through */ }

        // Fallback: sanitize the entire cleaned response as the answer
        logger.warn('Failed to parse JSON from LLM response — using raw text as answer');
        return { answer: sanitizeAnswer(cleaned), suggestedFollowups: [], keyTakeaways: [] };
    }

    protected override getConfidence(_data: RAGResult): number {
        return this.lastConfidence;
    }

    /** Append real lab links to the generated answer */
    private appendLabs(answer: string, query: string, level: Level): string {
        const labs = getLabsForTopic(query, level);
        if (labs.length === 0) return answer;

        const labsSection = '\n\n**🔬 Hands-On Labs:**\n' + formatLabsForEmbed(labs);
        return answer + labsSection;
    }

    /** Append recommended course links to the generated answer */
    private appendCourses(answer: string, query: string, level: Level): string {
        const courses = getCoursesForTopic(query, level);
        if (courses.length === 0) return answer;

        const coursesSection = '\n\n**📚 Recommended Courses:**\n' + formatCoursesForEmbed(courses);
        return answer + coursesSection;
    }
}
