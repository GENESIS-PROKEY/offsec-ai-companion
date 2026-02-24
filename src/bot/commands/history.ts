// /history command handler — learning journey tracker with error handling

import { Message, EmbedBuilder } from 'discord.js';
import type { MCPOrchestrator } from '../../mcp/orchestrator.js';
import { EMBED_COLORS, APP_FOOTER } from '../../config/constants.js';
import { buildErrorEmbed } from '../embeds/error.js';
import { getErrorMessage } from '../../utils/errors.js';
import { truncate } from '../../utils/formatters.js';

export async function handleHistoryCommand(
    message: Message,
    orchestrator: MCPOrchestrator
) {
    try {
        const result = await orchestrator.handleHistory(
            message.author.id,
            message.author.username
        );

        if (!result || result.history.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📜 Your Learning History')
                .setColor(EMBED_COLORS.history)
                .setDescription(
                    '**No interactions yet!** Start your cybersecurity journey:\n\n' +
                    '→ `/explain SQL injection` — Learn a concept\n' +
                    '→ `/ask How does XSS work?` — Ask a question\n' +
                    '→ `/related OWASP` — Explore related topics\n' +
                    '→ `/setlevel beginner` — Set your skill level'
                )
                .setTimestamp()
                .setFooter({ text: APP_FOOTER });

            await message.reply({ embeds: [embed] });
            return;
        }

        const commandEmojis: Record<string, string> = {
            explain: '🔐',
            ask: '❓',
            related: '🔗',
            setlevel: '📊',
        };

        const historyLines = result.history.map((h: { command: string; timestamp: string; query: string; confidence?: number }) => {
            const emoji = commandEmojis[h.command] ?? '📝';
            const date = new Date(h.timestamp);
            const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const preview = truncate(h.query, 50);
            return `${emoji} **${h.command}** — ${preview}\n   ⏰ ${timeStr} • 🎯 ${Math.round((h.confidence ?? 0) * 100)}%`;
        });

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${message.author.username}'s Learning Journey`)
            .setColor(EMBED_COLORS.history)
            .setDescription(truncate(historyLines.join('\n\n'), 4000))
            .addFields({
                name: '📊 Stats',
                value: [
                    `🔢 **Total:** ${result.totalInteractions} interactions`,
                    `📅 **Session:** ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
                ].join('\n'),
            })
            .setTimestamp()
            .setFooter({ text: APP_FOOTER });

        if (result.summary) {
            const summaryEmbed = new EmbedBuilder()
                .setColor(EMBED_COLORS.history)
                .setTitle('🧠 Knowledge Summary')
                .setDescription(truncate(result.summary, 4000))
                .setFooter({ text: `Explore connections with /related • ${APP_FOOTER}` });

            await message.reply({ embeds: [embed, summaryEmbed] });
        } else {
            embed.addFields({
                name: '💡 Next Steps',
                value: '→ `/explain` a new concept\n→ `/ask` a deeper question\n→ `/related` to explore connections',
            });
            await message.reply({ embeds: [embed] });
        }
    } catch (error: unknown) {
        const errorEmbed = buildErrorEmbed(
            'Failed to load history',
            `An error occurred while fetching your history.\n\n**Error:** ${getErrorMessage(error)}\n\n💡 Try again in a few seconds.`
        );
        await message.reply({ embeds: [errorEmbed] });
    }
}
