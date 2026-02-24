// Prompt Engineering MCP — centralized prompt template management

import { BaseMCP } from '../base.js';
import type { MCPRequest, PromptOutput } from '../../types/index.js';
import type { Level } from '../../config/constants.js';
import { config } from '../../config/index.js';
import { getMaxTokensForLevel } from '../../config/constants.js';
import { SYSTEM_PROMPT, EXPLAIN_PROMPTS, SAFETY_RULES } from './templates/index.js';

interface PromptPayload {
    promptType: 'explain' | 'rag_answer' | 'socratic' | 'safety';
    variables: Record<string, unknown>;
    userLevel: Level;
}

export class PromptMCP extends BaseMCP<PromptPayload, PromptOutput> {
    constructor() {
        super('PromptMCP');
    }

    protected async handle(request: MCPRequest<PromptPayload>): Promise<PromptOutput> {
        const { promptType, variables, userLevel } = request.payload;

        switch (promptType) {
            case 'explain':
                return this.buildExplainPrompt(userLevel, variables);
            default:
                return this.buildExplainPrompt(userLevel, variables);
        }
    }

    private buildExplainPrompt(level: Level, vars: Record<string, unknown>): PromptOutput {
        const template = EXPLAIN_PROMPTS[level];
        const prompt = template
            .replace('{concept}', (vars.concept as string) ?? '')
            .replace('{history}', this.formatHistory(vars.history as Array<{ query: string; response?: string }>));

        // Expert responses need significantly more tokens for protocol details,
        // CVEs, code snippets, and all required sections
        const maxTokens = getMaxTokensForLevel(config.ai.maxTokens, level);

        return {
            systemMessage: SYSTEM_PROMPT + '\n\n' + SAFETY_RULES,
            prompt,
            temperature: level === 'beginner' ? 0.8 : 0.6,
            maxTokens,
        };
    }

    private formatHistory(history: Array<{ query: string; response?: string }>): string {
        if (!history || history.length === 0) return 'No previous interactions.';
        return history
            .slice(-3)
            .map((h) => `Q: ${h.query}\nA: ${h.response?.slice(0, 100)}...`)
            .join('\n---\n');
    }
}
