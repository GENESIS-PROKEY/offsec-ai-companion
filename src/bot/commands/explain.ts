// /explain command handler — concept explanations
// Sends each continuation embed as a SEPARATE message (1 embed per message)

import { Message } from 'discord.js';
import type { MCPOrchestrator } from '../../mcp/orchestrator.js';
import type { Level } from '../../config/constants.js';
import { LEVELS, MAX_INPUT_LENGTH } from '../../config/constants.js';
import { buildExplainEmbed } from '../embeds/explain.js';
import { buildErrorEmbed } from '../embeds/error.js';
import { getErrorMessage } from '../../utils/errors.js';
import { buildThinkingEmbed } from '../embeds/thinking.js';
import { sanitizeInput } from '../../utils/sanitize.js';
import { incrementErrorCount } from '../../services/health.js';
import { sendTyping, sendContinuationEmbeds, startTypingIndicator } from '../../utils/discord.js';

export async function handleExplainCommand(
    message: Message,
    args: string[],
    orchestrator: MCPOrchestrator
) {
    let level: Level | undefined;
    const levelFlagIndex = args.indexOf('--level');
    if (levelFlagIndex !== -1 && args[levelFlagIndex + 1]) {
        const requestedLevel = args[levelFlagIndex + 1].toLowerCase() as Level;
        if (LEVELS.includes(requestedLevel)) {
            level = requestedLevel;
        }
        args.splice(levelFlagIndex, 2);
    }

    const concept = sanitizeInput(args.join(' '));

    if (!concept) {
        await message.reply({
            embeds: [
                buildErrorEmbed(
                    'Missing concept',
                    '**Usage:** `/explain <concept> [--level beginner|intermediate|expert]`\n\n**Examples:**\n• `/explain SQL injection`\n• `/explain buffer overflow --level expert`\n• `/explain phishing --level beginner`'
                ),
            ],
        });
        return;
    }

    if (concept.length > MAX_INPUT_LENGTH) {
        await message.reply({ embeds: [buildErrorEmbed('Input too long', `Concept must be under ${MAX_INPUT_LENGTH} characters.`)] });
        return;
    }

    await sendTyping(message.channel);
    const stopTyping = startTypingIndicator(message.channel);

    const thinkingEmbed = buildThinkingEmbed('explain');
    const thinkingMsg = await message.reply({ embeds: [thinkingEmbed] });
    const startTime = Date.now();

    try {
        const { result, userContext } = await orchestrator.handleExplain(
            message.author.id,
            message.author.username,
            concept,
            level
        );

        stopTyping();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        const embeds = buildExplainEmbed(
            concept,
            level ?? userContext.preferredLevel,
            result,
            elapsed
        );

        // First embed replaces thinking message
        await thinkingMsg.edit({ content: '', embeds: [embeds[0]] });

        // Each continuation embed sent as its own separate message
        await sendContinuationEmbeds(message.channel, embeds);
    } catch (error: unknown) {
        stopTyping();
        incrementErrorCount(getErrorMessage(error));
        const errorEmbed = buildErrorEmbed(
            'Something went wrong',
            `An error occurred while explaining **${concept}**.\n\n**Error:** ${getErrorMessage(error)}`
        );
        await thinkingMsg.edit({ content: '', embeds: [errorEmbed] });
    }
}
