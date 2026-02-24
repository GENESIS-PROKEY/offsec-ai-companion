// Error embed builder — branded, helpful, with recovery hints

import { EmbedBuilder } from 'discord.js';
import { EMBED_COLORS, APP_FOOTER } from '../../config/constants.js';

export function buildErrorEmbed(title: string, description: string, retryHints?: string[]): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`❌ ${title}`)
        .setColor(EMBED_COLORS.error)
        .setAuthor({ name: '🛡️ OffSec AI Learning Companion' })
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2092/2092663.png')
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: APP_FOOTER });

    const hints = retryHints ?? getDefaultHints(title);
    if (hints.length > 0) {
        embed.addFields({
            name: '💡 What to try',
            value: hints.map(h => `→ ${h}`).join('\n'),
        });
    }

    return embed;
}

function getDefaultHints(title: string): string[] {
    const lower = title.toLowerCase();
    if (lower.includes('rate limit')) {
        return ['Wait 30-60 seconds and try again', 'Use `/setlevel` to check your current level'];
    }
    if (lower.includes('too long')) {
        return ['Shorten your input to under 2000 characters', 'Focus on the key concept or question'];
    }
    if (lower.includes('generation failed') || lower.includes('quiz')) {
        return ['Try a more specific topic (e.g., "SQL injection" instead of "hacking")', 'Try a different difficulty level with `--level beginner`'];
    }
    return ['Try again in a few seconds', 'If the issue persists, try rephrasing your question'];
}

