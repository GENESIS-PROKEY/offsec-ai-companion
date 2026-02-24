// /setlevel command handler — premium success embed with motivational messaging

import { Message, EmbedBuilder } from 'discord.js';
import type { MCPOrchestrator } from '../../mcp/orchestrator.js';
import type { Level } from '../../config/constants.js';
import { LEVELS, EMBED_COLORS, LEVEL_EMOJI, APP_FOOTER } from '../../config/constants.js';
import { buildErrorEmbed } from '../embeds/error.js';
import { getErrorMessage } from '../../utils/errors.js';
import { incrementErrorCount } from '../../services/health.js';

const LEVEL_MOTIVATION: Record<Level, string> = {
    beginner: '🌱 Every expert was once a beginner. Let\'s build your foundation!',
    intermediate: '⚡ You\'re getting dangerous. Time to sharpen those skills!',
    expert: '🔬 Welcome to the deep end. No hand-holding — just raw knowledge.',
};

const LEVEL_CHANGES: Record<Level, string> = {
    beginner: '→ Simpler language & real-world analogies\n→ Step-by-step breakdowns\n→ Foundational concepts first\n→ Shorter, focused responses',
    intermediate: '→ Technical terminology & tool commands\n→ Practical attack/defense scenarios\n→ 1.5× longer responses for depth\n→ Real-world examples (Burp Suite, Nmap, etc.)',
    expert: '→ Protocol internals & edge cases\n→ CVE references & MITRE ATT&CK IDs\n→ 2.5× longer, highly detailed responses\n→ Advanced exploitation techniques',
};

export async function handleSetLevelCommand(
    message: Message,
    args: string[],
    orchestrator: MCPOrchestrator
) {
    const level = args[0]?.toLowerCase() as Level;

    if (!level || !LEVELS.includes(level)) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Set Your Skill Level')
            .setColor(EMBED_COLORS.info)
            .setAuthor({ name: '🛡️ OffSec AI Learning Companion' })
            .setDescription(
                '> Choose a level to personalize all responses.\n\n' +
                `${LEVEL_EMOJI.beginner} **\`/setlevel beginner\`** — Simple language, analogies, step-by-step\n` +
                `${LEVEL_EMOJI.intermediate} **\`/setlevel intermediate\`** — Technical terms, real tools, practical examples\n` +
                `${LEVEL_EMOJI.expert} **\`/setlevel expert\`** — Protocol internals, CVEs, MITRE ATT&CK, edge cases`
            )
            .setTimestamp()
            .setFooter({ text: APP_FOOTER });

        await message.reply({ embeds: [embed] });
        return;
    }

    try {
        await orchestrator.handleSetLevel(
            message.author.id,
            message.author.username,
            level
        );

        const capitalizedLevel = level.charAt(0).toUpperCase() + level.slice(1);

        const embed = new EmbedBuilder()
            .setTitle(`${LEVEL_EMOJI[level]} Level Set: ${capitalizedLevel}`)
            .setColor(EMBED_COLORS.explain[level])
            .setAuthor({ name: '🛡️ OffSec AI Learning Companion' })
            .setDescription(
                `**${LEVEL_MOTIVATION[level]}**\n\n` +
                `───────────────\n\n` +
                `Your responses are now tuned for **${capitalizedLevel}** level.`
            )
            .addFields(
                {
                    name: '🔧 What changes',
                    value: LEVEL_CHANGES[level],
                },
                {
                    name: '🚀 Try it out',
                    value: `\`/explain SQL injection\` — see the ${capitalizedLevel} difference!\n\`/quiz OWASP --level ${level}\` — test yourself at this level`,
                }
            )
            .setTimestamp()
            .setFooter({ text: APP_FOOTER });

        await message.reply({ embeds: [embed] });
    } catch (error: unknown) {
        incrementErrorCount(getErrorMessage(error));
        const errorEmbed = buildErrorEmbed(
            'Failed to update level',
            `An error occurred while setting your level.\n\n**Error:** ${getErrorMessage(error)}`
        );
        await message.reply({ embeds: [errorEmbed] });
    }
}
