// Preference MCP — user profile management and adaptive level detection

import { BaseMCP } from '../base.js';
import type { MCPRequest, UserProfile } from '../../types/index.js';
import type { Level } from '../../config/constants.js';
import { LEVELS } from '../../config/constants.js';
import { getDatabase, dbRun, dbGet, dbAll, debouncedSave } from '../../db/sqlite.js';
import { logger } from '../../utils/logger.js';

interface PreferencePayload {
    action: 'get' | 'set' | 'detect';
    preferences?: Partial<UserProfile>;
}

interface PreferenceResult {
    preferredLevel: Level;
    detectedLevel: Level;
    preferredStyle: string;
    topicsOfInterest: string[];
    totalInteractions: number;
    streakDays: number;
    adaptationSuggestion?: string;
}

export class PreferenceMCP extends BaseMCP<PreferencePayload, PreferenceResult> {
    constructor() {
        super('PreferenceMCP');
    }

    protected async handle(request: MCPRequest<PreferencePayload>): Promise<PreferenceResult> {
        await getDatabase(); // ensure DB is initialized
        const { action, preferences } = request.payload;
        const userId = request.context.userId;
        const username = request.context.username;

        switch (action) {
            case 'get':
                return this.getPreferences(userId, username);
            case 'set':
                return this.setPreferences(userId, username, preferences ?? {});
            case 'detect':
                return this.detectLevel(userId, username);
            default:
                return this.getPreferences(userId, username);
        }
    }

    private getPreferences(userId: string, username: string): PreferenceResult {
        // Ensure user exists with defaults
        dbRun(
            `INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)`,
            [userId, username]
        );

        const row = dbGet('SELECT * FROM users WHERE user_id = ?', [userId]);

        return {
            preferredLevel: (row?.preferred_level as Level) ?? 'beginner',
            detectedLevel: (row?.detected_level as Level) ?? 'beginner',
            preferredStyle: (row?.preferred_style as string) ?? 'detailed',
            topicsOfInterest: JSON.parse((row?.topics_of_interest as string) ?? '[]'),
            totalInteractions: (row?.total_interactions as number) ?? 0,
            streakDays: (row?.streak_days as number) ?? 0,
        };
    }

    private setPreferences(
        userId: string,
        username: string,
        prefs: Partial<UserProfile>
    ): PreferenceResult {
        // Ensure user exists
        dbRun(
            `INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)`,
            [userId, username]
        );

        if (prefs.preferredLevel && LEVELS.includes(prefs.preferredLevel)) {
            dbRun('UPDATE users SET preferred_level = ? WHERE user_id = ?', [prefs.preferredLevel, userId]);
        }
        if (prefs.preferredStyle) {
            dbRun('UPDATE users SET preferred_style = ? WHERE user_id = ?', [prefs.preferredStyle, userId]);
        }
        if (prefs.dataRetention) {
            dbRun('UPDATE users SET data_retention = ? WHERE user_id = ?', [prefs.dataRetention, userId]);
        }

        debouncedSave();
        logger.info({ userId, prefs }, 'User preferences updated');
        return this.getPreferences(userId, username);
    }

    private detectLevel(userId: string, username: string): PreferenceResult {
        const prefs = this.getPreferences(userId, username);

        // Fetch last 5 interactions to analyze vocabulary complexity
        const rows = dbAll(
            `SELECT query, level FROM interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
            [userId]
        );

        if (rows.length < 3) {
            return prefs; // Not enough data to detect
        }

        const queries = rows.map((r) => (r.query as string).toLowerCase());
        let expertScore = 0;
        let beginnerScore = 0;

        // Weighted expert patterns: high-specificity terms score more
        const expertPatterns: Array<[string, number]> = [
            ['shellcode', 3], ['CVE-', 3], ['MITRE', 3], ['ATT&CK', 3],
            ['exploit', 2], ['vulnerability', 2], ['payload', 2], ['evasion', 2],
            ['protocol', 2], ['implementation', 2],
            ['difference between', 1], ['why does', 1], ['instead of', 1], ['edge case', 1],
        ];
        const beginnerPatterns: Array<[string, number]> = [
            ['basic', 2], ['beginner', 2], ['simple', 2],
            ['what is', 1], ['how does', 1], ['explain', 1], ['what are', 1], ['how to', 1],
        ];

        for (const q of queries) {
            for (const [pattern, weight] of expertPatterns) {
                if (q.includes(pattern.toLowerCase())) expertScore += weight;
            }
            for (const [pattern, weight] of beginnerPatterns) {
                if (q.includes(pattern.toLowerCase())) beginnerScore += weight;
            }
        }

        let detectedLevel: Level = 'beginner';
        if (expertScore >= 5) detectedLevel = 'expert';
        else if (expertScore >= 2 && beginnerScore <= 2) detectedLevel = 'intermediate';

        dbRun('UPDATE users SET detected_level = ? WHERE user_id = ?', [detectedLevel, userId]);

        // Update streak
        this.updateStreak(userId);

        debouncedSave();

        let adaptationSuggestion: string | undefined;
        if (detectedLevel !== prefs.preferredLevel) {
            adaptationSuggestion = `It looks like you might be ready for ${detectedLevel}-level explanations. Use \`!setlevel ${detectedLevel}\` to adjust.`;
        }

        return {
            ...prefs,
            detectedLevel,
            adaptationSuggestion,
        };
    }

    /**
     * Update streak tracking: increment if interacting on a new consecutive day.
     */
    private updateStreak(userId: string): void {
        const row = dbGet('SELECT last_streak_date, streak_days FROM users WHERE user_id = ?', [userId]);
        if (!row) return;

        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const lastDate = row.last_streak_date as string | null;

        if (lastDate === today) return; // Already counted today

        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        const currentStreak = (row.streak_days as number) ?? 0;
        const newStreak = lastDate === yesterday ? currentStreak + 1 : 1;

        dbRun(
            'UPDATE users SET streak_days = ?, last_streak_date = ? WHERE user_id = ?',
            [newStreak, today, userId]
        );
    }
}
