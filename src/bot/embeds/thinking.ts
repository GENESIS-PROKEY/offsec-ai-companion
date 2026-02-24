// Thinking/loading embed builder — premium-looking loading state
// Replaces plain text "Researching..." with a branded embed

import { EmbedBuilder } from 'discord.js';

const THINKING_COLOR = 0x2B2D31; // Discord dark embed color — subtle, doesn't compete with response

interface ThinkingConfig {
    emoji: string;
    messages: string[];
}

const THINKING_CONFIGS: Record<string, ThinkingConfig> = {
    ask: {
        emoji: '🔍',
        messages: [
            'Searching the knowledge base & analyzing your question...',
            'Consulting OffSec archives & security research papers...',
            'Querying threat intelligence databases...',
            'Cross-referencing vulnerability databases...',
        ],
    },
    explain: {
        emoji: '🧠',
        messages: [
            'Crafting a detailed explanation at your level...',
            'Breaking this concept down with examples...',
            'Building a structured walkthrough...',
            'Assembling analogies and practical tips...',
        ],
    },
    related: {
        emoji: '🗺️',
        messages: [
            'Mapping the cybersecurity knowledge graph...',
            'Discovering concept connections and learning paths...',
            'Analyzing topic relationships and prerequisites...',
            'Building your personalized knowledge map...',
        ],
    },
    quiz: {
        emoji: '📝',
        messages: [
            'Generating a unique quiz tailored to your level...',
            'Crafting challenging questions from diverse sub-topics...',
            'Building an AI-powered assessment for you...',
            'Preparing a cybersecurity challenge...',
        ],
    },
};

/**
 * Build a premium thinking/loading embed.
 * Shows a branded loading state instead of plain text.
 */
export function buildThinkingEmbed(type: string): EmbedBuilder {
    const config = THINKING_CONFIGS[type] ?? THINKING_CONFIGS.ask;
    const message = config.messages[Math.floor(Math.random() * config.messages.length)];

    return new EmbedBuilder()
        .setColor(THINKING_COLOR)
        .setAuthor({ name: '🛡️ OffSec AI Learning Companion' })
        .setDescription(
            `${config.emoji} **Processing...**\n\n` +
            `> *${message}*\n\n` +
            `\`░░░░░░░░░░\` ⏳`
        );
}
