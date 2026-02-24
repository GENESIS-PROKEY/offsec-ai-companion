// /ask command handler — AI-powered cybersecurity Q&A
// Sends each embed as a SEPARATE message (1 embed per message, max 6000 chars each)

import { Message, EmbedBuilder } from 'discord.js';
import type { MCPOrchestrator } from '../../mcp/orchestrator.js';
import { EMBED_COLORS, CONFIDENCE, MAX_INPUT_LENGTH, getFooterTip } from '../../config/constants.js';
import { buildErrorEmbed } from '../embeds/error.js';
import { getErrorMessage } from '../../utils/errors.js';
import { buildThinkingEmbed } from '../embeds/thinking.js';
import { splitIntoEmbeds } from '../embeds/explain.js';
import { formatLevelBadge, formatConfidence, truncate } from '../../utils/formatters.js';
import { sanitizeInput } from '../../utils/sanitize.js';
import { incrementErrorCount } from '../../services/health.js';
import { sendTyping, sendContinuationEmbeds, startTypingIndicator } from '../../utils/discord.js';

export async function handleAskCommand(
    message: Message,
    args: string[],
    orchestrator: MCPOrchestrator
) {
    const question = sanitizeInput(args.join(' '));

    if (!question) {
        const embed = new EmbedBuilder()
            .setTitle('❓ Ask a Cybersecurity Question')
            .setColor(EMBED_COLORS.ask)
            .setDescription(
                '> Type your question and I\'ll research it using my knowledge base.\n\n' +
                '**Usage:** `/ask <your question>`\n\n' +
                '**Examples:**'
            )
            .addFields(
                { name: '🔐 Offensive Security', value: '`/ask How does SQL injection work?`', inline: true },
                { name: '🛡️ Defense', value: '`/ask How do I harden a Linux server?`', inline: true },
                { name: '🔑 Cryptography', value: '`/ask Explain Kerberos authentication`', inline: true },
                { name: '🐧 Privilege Escalation', value: '`/ask Linux privesc techniques`', inline: true },
            )
            .setTimestamp()
            .setFooter({ text: getFooterTip() });

        await message.reply({ embeds: [embed] });
        return;
    }

    if (question.length > MAX_INPUT_LENGTH) {
        await message.reply({ embeds: [buildErrorEmbed('Input too long', `Question must be under ${MAX_INPUT_LENGTH} characters.`)] });
        return;
    }

    await sendTyping(message.channel);
    const stopTyping = startTypingIndicator(message.channel);

    const thinkingEmbed = buildThinkingEmbed('ask');
    const searchMsg = await message.reply({ embeds: [thinkingEmbed] });
    const startTime = Date.now();

    try {
        const { result, userContext } = await orchestrator.handleAsk(
            message.author.id,
            message.author.username,
            question
        );

        stopTyping();

        const answer: string = result.answer ?? 'No answer generated.';
        const isHighConfidence = result.confidence >= CONFIDENCE.HIGH;
        const isLowConfidence = result.confidence < CONFIDENCE.LOW;
        const color = isHighConfidence ? EMBED_COLORS.ask : isLowConfidence ? EMBED_COLORS.error : EMBED_COLORS.warning;
        const icon = isHighConfidence ? '✅' : isLowConfidence ? '⚠️' : '💬';
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const footer = `${formatLevelBadge(userContext.preferredLevel)} • ${formatConfidence(result.confidence)} • ⚡ ${elapsed}s • ${getFooterTip()}`;

        // Build full text with takeaways + follow-ups appended
        let fullText = answer;
        if (result.keyTakeaways && result.keyTakeaways.length > 0) {
            fullText += '\n\n**🔑 Key Takeaways:**\n' + result.keyTakeaways.map((t: string) => `✦ ${t}`).join('\n');
        }
        if (result.suggestedFollowups && result.suggestedFollowups.length > 0) {
            fullText += '\n\n**💡 Keep Exploring:**\n' + result.suggestedFollowups.map((f: string) => `→ \`/ask ${f}\``).join('\n');
        }

        // Split into embeds (each under 6000 chars)
        const embeds = splitIntoEmbeds(fullText, {
            title: `${icon} ${truncate(question, 200)}`,
            color,
            footer,
        });

        // First embed replaces the thinking message
        await searchMsg.edit({ content: '', embeds: [embeds[0]] });

        // Each continuation as a separate message
        await sendContinuationEmbeds(message.channel, embeds);

    } catch (error: unknown) {
        stopTyping();
        incrementErrorCount(getErrorMessage(error));
        const errorEmbed = buildErrorEmbed(
            'Something went wrong',
            `An error occurred while processing your question.\n\n**Error:** ${getErrorMessage(error)}`
        );
        await searchMsg.edit({ content: '', embeds: [errorEmbed] });
    }
}
