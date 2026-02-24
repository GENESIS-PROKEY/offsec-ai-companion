// Memory MCP — conversation history storage, retrieval, and summarization

import { BaseMCP } from '../base.js';
import type { MCPRequest, InteractionRecord } from '../../types/index.js';
import { getDatabase, dbRun, dbGet, dbAll, debouncedSave } from '../../db/sqlite.js';
import { generateCompletion } from '../../services/ai.js';
import { MEMORY, type Level } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

interface MemoryPayload {
    action: 'store' | 'retrieve' | 'summarize';
    data?: InteractionRecord;
    limit?: number;
}

interface MemoryResult {
    history: InteractionRecord[];
    summary?: string;
    totalInteractions: number;
}

export class MemoryMCP extends BaseMCP<MemoryPayload, MemoryResult> {
    constructor() {
        super('MemoryMCP');
    }

    protected async handle(request: MCPRequest<MemoryPayload>): Promise<MemoryResult> {
        await getDatabase(); // ensure DB is initialized
        const { action, data, limit } = request.payload;
        const userId = request.context.userId;

        switch (action) {
            case 'store':
                return this.storeInteraction(userId, data!);
            case 'retrieve':
                return this.retrieveHistory(userId, limit ?? MEMORY.MAX_HISTORY_DISPLAY);
            case 'summarize':
                return this.summarizeHistory(userId);
            default:
                return this.retrieveHistory(userId, limit ?? MEMORY.MAX_HISTORY_DISPLAY);
        }
    }

    private async storeInteraction(
        userId: string,
        data: InteractionRecord
    ): Promise<MemoryResult> {
        // Ensure user exists
        dbRun(
            `INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)`,
            [userId, data.userId]
        );

        // Store interaction
        dbRun(
            `INSERT INTO interactions (id, user_id, command, query, response, level, confidence, topics, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.id, userId, data.command, data.query, data.response, data.level, data.confidence, JSON.stringify(data.topics), data.timestamp]
        );

        // Update user stats
        dbRun(
            `UPDATE users
       SET total_interactions = total_interactions + 1,
           questions_asked = CASE WHEN ? = 'ask' THEN questions_asked + 1 ELSE questions_asked END,
           last_active_at = datetime('now')
       WHERE user_id = ?`,
            [data.command, userId]
        );

        // Update concepts explored for explain commands
        if (data.command === 'explain' && data.topics.length > 0) {
            const row = dbGet('SELECT concepts_explored FROM users WHERE user_id = ?', [userId]);
            const existing: string[] = JSON.parse((row?.concepts_explored as string) ?? '[]');
            const updated = [...new Set([...existing, ...data.topics])];
            dbRun('UPDATE users SET concepts_explored = ? WHERE user_id = ?', [JSON.stringify(updated), userId]);
        }

        // Save to disk
        debouncedSave();

        // Check if summarization is needed
        const countRow = dbGet('SELECT COUNT(*) as cnt FROM interactions WHERE user_id = ?', [userId]);
        const cnt = (countRow?.cnt as number) ?? 0;

        if (cnt >= MEMORY.SUMMARIZE_THRESHOLD && cnt % MEMORY.SUMMARIZE_THRESHOLD === 0) {
            logger.info({ userId, count: cnt }, 'Triggering history summarization');
            this.summarizeHistory(userId).catch((err) =>
                logger.error({ err }, 'Background summarization failed')
            );
        }

        return { history: [], totalInteractions: cnt };
    }

    private async retrieveHistory(userId: string, limit: number): Promise<MemoryResult> {
        // Fetch recent interactions
        const rows = dbAll(
            `SELECT * FROM interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
            [userId, limit]
        );

        const history: InteractionRecord[] = rows.map((r) => ({
            id: r.id as string,
            userId: r.user_id as string,
            command: r.command as string,
            query: r.query as string,
            response: r.response as string,
            level: r.level as Level,
            confidence: r.confidence as number,
            timestamp: r.created_at as string,
            topics: JSON.parse((r.topics as string) ?? '[]'),
        }));

        // Fetch summary if available
        const summaryRow = dbGet('SELECT summary FROM history_summaries WHERE user_id = ?', [userId]);

        // Total count
        const countRow = dbGet('SELECT COUNT(*) as cnt FROM interactions WHERE user_id = ?', [userId]);

        return {
            history: history.reverse(),
            summary: summaryRow?.summary as string | undefined,
            totalInteractions: (countRow?.cnt as number) ?? 0,
        };
    }

    private async summarizeHistory(userId: string): Promise<MemoryResult> {
        const rows = dbAll(
            `SELECT query, command, level, created_at FROM interactions WHERE user_id = ? ORDER BY created_at ASC`,
            [userId]
        );

        if (rows.length < MEMORY.SUMMARIZE_THRESHOLD) {
            return { history: [], totalInteractions: rows.length };
        }

        const interactionList = rows
            .map((r) => `[${r.command}] ${r.query}`)
            .join('\n');

        const summary = await generateCompletion(
            'You are a learning journey summarizer.',
            `Summarize this user's cybersecurity learning journey in ${MEMORY.SUMMARY_MAX_WORDS} words or less. Focus on topics explored, progression, and areas of interest.\n\nInteractions:\n${interactionList}`,
            { temperature: 0.5, maxTokens: 1200 }
        );

        dbRun(
            `INSERT OR REPLACE INTO history_summaries (user_id, summary, interaction_count, updated_at) VALUES (?, ?, ?, datetime('now'))`,
            [userId, summary, rows.length]
        );
        debouncedSave();

        return { history: [], summary, totalInteractions: rows.length };
    }
}
