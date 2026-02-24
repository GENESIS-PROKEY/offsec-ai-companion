// Explain MCP — generates level-appropriate cybersecurity concept explanations
// Beginner: uses JSON mode for structured output
// Intermediate/Expert: uses plain markdown for maximum length and quality

import { BaseMCP } from '../base.js';
import type { MCPRequest, ExplainResult, PromptOutput } from '../../types/index.js';
import type { Level } from '../../config/constants.js';
import { generateCompletion } from '../../services/ai.js';
import { getCached, setCache, makeCacheKey } from '../../services/cache.js';
import { stripOuterCodeFence, sanitizeAnswer } from '../../utils/formatters.js';
import { logger } from '../../utils/logger.js';
import { getLabsForTopic } from '../../utils/labs.js';
import { getCoursesForTopic } from '../../utils/courses.js';

interface ExplainPayload {
    concept: string;
    level: Level;
    prompt?: PromptOutput;
}

export class ExplainMCP extends BaseMCP<ExplainPayload, ExplainResult> {
    constructor() {
        super('ExplainMCP');
    }

    protected async handle(request: MCPRequest<ExplainPayload>): Promise<ExplainResult> {
        const { concept, level, prompt } = request.payload;

        if (!prompt) {
            throw new Error('Prompt output is required for explanation generation');
        }

        // Beginner uses JSON mode; intermediate/expert use plain markdown
        const useJsonMode = level === 'beginner';

        // Check cache first — avoids redundant LLM calls
        const cacheKey = makeCacheKey('explain', concept, level);
        const cached = getCached(cacheKey);

        let rawResponse: string;
        if (cached) {
            logger.info({ concept, level }, '⚡ Cache HIT — skipping LLM call');
            rawResponse = cached;
        } else {
            rawResponse = await generateCompletion(
                prompt.systemMessage,
                prompt.prompt,
                {
                    temperature: prompt.temperature,
                    maxTokens: prompt.maxTokens,
                    jsonMode: useJsonMode,
                }
            );
            // Store in cache for 5 minutes
            setCache(cacheKey, rawResponse);
        }

        // Confidence heuristic: cache hits are proven responses, fresh calls have no retrieval backing
        const confidence = cached ? 0.9 : 0.75;

        let result: ExplainResult;

        if (useJsonMode) {
            // Beginner: strip outer fence (expects JSON), then parse
            const cleaned = stripOuterCodeFence(rawResponse);
            result = this.parseJsonResponse(cleaned);
        } else {
            // Intermediate/Expert: DO NOT strip fences — response IS markdown
            // stripOuterCodeFence would destroy code blocks in the response
            // which destroys markdown responses containing code blocks.
            result = this.parseMarkdownResponse(rawResponse.trim());
        }

        // Apply confidence heuristic after parsing
        result.confidence = confidence;

        // Enrich with real labs — level-filtered
        const labs = getLabsForTopic(concept, level);
        result.labs = labs.map(l => ({ name: l.name, url: l.url, platform: l.platform, level: l.level }));

        // Enrich with recommended courses — level-filtered
        const courses = getCoursesForTopic(concept, level);
        result.courses = courses.map(c => ({ name: c.name, url: c.url, platform: c.platform, certification: c.certification, free: c.free }));

        return result;
    }

    /**
     * Parse a JSON response (used for beginner level).
     */
    private parseJsonResponse(cleaned: string): ExplainResult {
        let parsed!: Record<string, unknown>;

        // Attempt 1: Direct JSON parse
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            // Attempt 2: Extract JSON object
            try {
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/s);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                }
            } catch { /* fall through */ }

            // Attempt 3: Regex extract
            if (!parsed) {
                const expMatch = cleaned.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,}]/);
                if (expMatch) {
                    parsed = { explanation: expMatch[1] };
                } else {
                    logger.warn({ rawResponse: cleaned.slice(0, 200) }, 'Failed to parse JSON, using raw text');
                    parsed = { explanation: cleaned };
                }
            }
        }

        return {
            explanation: sanitizeAnswer(parsed.explanation ?? cleaned, 'explanation'),
            analogies: (parsed.analogies as string[]) ?? [],
            relatedConcepts: (parsed.relatedConcepts as string[]) ?? [],
            offSecModules: (parsed.offSecModules as string[]) ?? [],
            practicalTip: parsed.practicalTip as string | undefined,
            confidence: 0, // overwritten by handle()
        };
    }

    /**
     * Parse a plain markdown response (used for intermediate/expert levels).
     * The full response IS the explanation. Related concepts and tips are extracted from the footer.
     */
    private parseMarkdownResponse(raw: string): ExplainResult {
        let explanation = raw;
        let relatedConcepts: string[] = [];
        let practicalTip: string | undefined;

        // If the LLM still returned JSON despite instructions, handle it gracefully
        if (raw.trimStart().startsWith('{')) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.explanation) {
                    return {
                        explanation: sanitizeAnswer(parsed.explanation, 'explanation'),
                        analogies: parsed.analogies ?? [],
                        relatedConcepts: parsed.relatedConcepts ?? [],
                        offSecModules: parsed.offSecModules ?? [],
                        practicalTip: parsed.practicalTip,
                        confidence: 0, // overwritten by handle()
                    };
                }
            } catch { /* not JSON, continue */ }
        }

        // Also handle JSON wrapped in code fences
        const jsonFenceMatch = raw.match(/^```(?:json)?\s*\n(\{[\s\S]*\})\s*\n```$/);
        if (jsonFenceMatch) {
            try {
                const parsed = JSON.parse(jsonFenceMatch[1]);
                if (parsed.explanation) {
                    return {
                        explanation: sanitizeAnswer(parsed.explanation, 'explanation'),
                        analogies: parsed.analogies ?? [],
                        relatedConcepts: parsed.relatedConcepts ?? [],
                        offSecModules: parsed.offSecModules ?? [],
                        practicalTip: parsed.practicalTip,
                        confidence: 0, // overwritten by handle()
                    };
                }
            } catch { /* not valid JSON in fence, continue */ }
        }

        // Extract RELATED_CONCEPTS from the footer
        const relatedMatch = explanation.match(/RELATED_CONCEPTS:\s*(.+)/i);
        if (relatedMatch) {
            relatedConcepts = relatedMatch[1].split(',').map(s => s.trim()).filter(Boolean);
            explanation = explanation.replace(/RELATED_CONCEPTS:\s*.+/i, '').trim();
        }

        // Extract PRACTICAL_TIP from the footer
        const tipMatch = explanation.match(/PRACTICAL_TIP:\s*(.+)/i);
        if (tipMatch) {
            practicalTip = tipMatch[1].trim();
            explanation = explanation.replace(/PRACTICAL_TIP:\s*.+/i, '').trim();
        }

        // Fix escaped newlines and quotes (in case LLM escapes them)
        explanation = explanation
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\n{3,}/g, '\n\n');

        return {
            explanation: explanation || 'No explanation generated. Please try again.',
            analogies: [],
            relatedConcepts,
            offSecModules: [],
            practicalTip,
            confidence: 0, // overwritten by handle()
        };
    }

    protected override getConfidence(data: ExplainResult): number {
        return data.confidence;
    }
}
