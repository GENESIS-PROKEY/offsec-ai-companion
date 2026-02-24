// /related command handler — finds related cybersecurity concepts
// Sends each embed as a SEPARATE message (1 embed per message)

import { Message } from 'discord.js';
import type { MCPOrchestrator } from '../../mcp/orchestrator.js';
import { EMBED_COLORS, MAX_INPUT_LENGTH, getFooterTip } from '../../config/constants.js';
import { buildErrorEmbed } from '../embeds/error.js';
import { getErrorMessage } from '../../utils/errors.js';
import { buildThinkingEmbed } from '../embeds/thinking.js';
import { splitIntoEmbeds } from '../embeds/explain.js';
import { truncate } from '../../utils/formatters.js';
import { sanitizeInput } from '../../utils/sanitize.js';
import { incrementErrorCount } from '../../services/health.js';
import { sendTyping, sendContinuationEmbeds, startTypingIndicator } from '../../utils/discord.js';

export async function handleRelatedCommand(
    message: Message,
    args: string[],
    orchestrator: MCPOrchestrator
) {
    const concept = sanitizeInput(args.join(' '));

    if (!concept) {
        await message.reply({
            embeds: [
                buildErrorEmbed(
                    'Missing concept',
                    '**Usage:** `/related <concept>`\n\n**Examples:**\n• `/related SQL injection`\n• `/related buffer overflow`\n• `/related privilege escalation`'
                ),
            ],
        });
        return;
    }

    if (concept.length > MAX_INPUT_LENGTH) {
        await message.reply({ embeds: [buildErrorEmbed('Input too long', `Topic must be under ${MAX_INPUT_LENGTH} characters.`)] });
        return;
    }

    await sendTyping(message.channel);
    const stopTyping = startTypingIndicator(message.channel);

    const thinkingEmbed = buildThinkingEmbed('related');
    const thinkingMsg = await message.reply({ embeds: [thinkingEmbed] });
    const startTime = Date.now();

    try {
        const result = await orchestrator.handleRelated(
            message.author.id,
            message.author.username,
            concept
        );

        stopTyping();

        let fullText = result?.answer ?? 'No related topics found.';
        if (result?.suggestedFollowups && result.suggestedFollowups.length > 0) {
            fullText += '\n\n**💡 Dive Deeper:**\n' + result.suggestedFollowups.map((f: string) => `→ \`/explain ${f}\``).join('\n');
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        const embeds = splitIntoEmbeds(fullText, {
            title: `🔗 Related to: ${truncate(concept, 200)}`,
            color: EMBED_COLORS.related,
            footer: `⚡ ${elapsed}s • ${getFooterTip()}`,
        });

        await thinkingMsg.edit({ content: '', embeds: [embeds[0]] });

        // Each continuation as a separate message
        await sendContinuationEmbeds(message.channel, embeds);
    } catch (error: unknown) {
        stopTyping();
        incrementErrorCount(getErrorMessage(error));
        const errorEmbed = buildErrorEmbed(
            'Something went wrong',
            `An error occurred while finding related topics for **${concept}**.\n\n**Error:** ${getErrorMessage(error)}`
        );
        await thinkingMsg.edit({ content: '', embeds: [errorEmbed] });
    }
}
