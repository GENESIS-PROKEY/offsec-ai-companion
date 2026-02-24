// Application-wide constants

export const APP_NAME = 'OffSec AI Learning Companion';
export const APP_VERSION = '1.2.0';
export const APP_FOOTER = `${APP_NAME} v${APP_VERSION}`;

// User levels
export const LEVELS = ['beginner', 'intermediate', 'expert'] as const;
export type Level = (typeof LEVELS)[number];

// Token multiplier per level — expert responses need much more room
const TOKEN_MULTIPLIER: Record<Level, number> = {
    beginner: 1,
    intermediate: 2,
    expert: 6,
};

/**
 * Get the max token limit scaled by user level.
 * Expert-level responses need significantly more room
 * for protocol details, CVEs, code, and all required sections.
 */
export function getMaxTokensForLevel(baseTokens: number, level: Level): number {
    return Math.round(baseTokens * TOKEN_MULTIPLIER[level]);
}

// User styles
export const STYLES = ['concise', 'detailed', 'socratic'] as const;
export type ExplanationStyle = (typeof STYLES)[number];

// Discord embed colors — premium cybersecurity palette
export const EMBED_COLORS = {
    explain: {
        beginner: 0x57f287,   // Green — growth
        intermediate: 0xfee75c, // Gold — progress 
        expert: 0xed4245,      // Red — danger zone
    },
    ask: 0x57f287,       // Green — answers
    history: 0xeb459e,   // Fuchsia — memory
    related: 0x5865f2,   // Blurple — connections
    error: 0xed4245,     // Red — errors
    warning: 0xfee75c,   // Yellow — caution
    info: 0x5865f2,      // Blurple — info
    success: 0x57f287,   // Green — success
    ping: 0x57f287,      // Green — status
} as const;

// Rotating footer tips
export const FOOTER_TIPS = [
    'Try /explain OWASP Top 10',
    'Level up with /setlevel intermediate',
    'Ask about PEN-200 with /ask',
    'Explore connections with /related',
    'Check your progress with /history',
    'Stay sharp. Stay curious. Stay OffSec.',
    'Master the fundamentals. Break the box.',
];

/**
 * Gets a random footer tip or default version
 */
export function getFooterTip(): string {
    const tip = FOOTER_TIPS[Math.floor(Math.random() * FOOTER_TIPS.length)];
    return `${tip} • ${APP_FOOTER}`;
}

// Confidence thresholds
export const CONFIDENCE = {
    HIGH: 0.6,
    LOW: 0.3,
} as const;

// Level emojis
export const LEVEL_EMOJI: Record<Level, string> = {
    beginner: '🌱',
    intermediate: '⚡',
    expert: '🔬',
};

// Confidence emojis
export const CONFIDENCE_EMOJI = {
    high: '🟢',
    medium: '🟡',
    low: '🔴',
} as const;

// Memory limits
export const MEMORY = {
    RECENT_WINDOW: 5,
    SUMMARIZE_THRESHOLD: 20,
    MAX_HISTORY_DISPLAY: 10,
    SUMMARY_MAX_WORDS: 400,
} as const;

// Input limits
export const MAX_INPUT_LENGTH = 2000;

// Thinking messages — randomized for variety
export const THINKING_MESSAGES = {
    ask: [
        '🔍 Researching your question...',
        '🧠 Analyzing the security landscape...',
        '⚡ Querying the knowledge base...',
        '🔐 Consulting the OffSec archives...',
    ],
    explain: [
        '🧠 Crafting your explanation...',
        '📖 Breaking this down for you...',
        '⚡ Generating a detailed walkthrough...',
    ],
    related: [
        '🔗 Mapping the knowledge graph...',
        '🗺️ Discovering connections...',
        '🔍 Finding related concepts...',
    ],
    quiz: [
        '🧠 Generating your quiz...',
        '📝 Crafting a challenge for you...',
        '🎯 Building a question...',
    ],
};

export function randomThinking(type: keyof typeof THINKING_MESSAGES): string {
    const msgs = THINKING_MESSAGES[type];
    return msgs[Math.floor(Math.random() * msgs.length)];
}
