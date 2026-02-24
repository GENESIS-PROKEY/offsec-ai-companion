// Command registry — supports both slash commands AND message prefix (backward compatible)

import { Client, Events, Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Message as DiscordMessage } from 'discord.js';
import type { DiscordReplyOptions } from '../../types/index.js';
import { MCPOrchestrator } from '../../mcp/orchestrator.js';
import { handleExplainCommand } from './explain.js';
import { handleAskCommand } from './ask.js';
import { handleSetLevelCommand } from './setlevel.js';
import { handleHistoryCommand } from './history.js';
import { handleRelatedCommand } from './related.js';
import { handleQuizCommand, handleQuizSlash } from './quiz.js';
import { EMBED_COLORS, CONFIDENCE, APP_NAME, APP_VERSION, APP_FOOTER, LEVEL_EMOJI, LEVELS, getFooterTip, randomThinking, type Level } from '../../config/constants.js';
import { truncate, formatLevelBadge, formatConfidence, createProgressBar } from '../../utils/formatters.js';
import { buildErrorEmbed } from '../embeds/error.js';
import { logger } from '../../utils/logger.js';
import { getErrorMessage } from '../../utils/errors.js';
import { RateLimiter } from '../../utils/rateLimit.js';
import { sanitizeInput } from '../../utils/sanitize.js';
import { sendToChannel } from '../../utils/discord.js';

const PREFIX = '/';

// Rate limiter (uses config values for perUser + windowMs)
const rateLimiter = new RateLimiter();

const orchestrator = new MCPOrchestrator();

/**
 * A unified "message-like" wrapper so command handlers work with both
 * Discord slash interactions AND traditional message-based commands.
 */
export interface CommandContext {
    userId: string;
    username: string;
    reply(options: DiscordReplyOptions | string): Promise<DiscordMessage | void>;
    editReply(options: DiscordReplyOptions | string): Promise<DiscordMessage | void>;
    deferReply(): Promise<void>;
    followUp(options: DiscordReplyOptions | string): Promise<DiscordMessage | null | void>;
    isSlash: boolean;
}

function fromMessage(message: Message): CommandContext {
    let replyMsg: Message | null = null;
    return {
        userId: message.author.id,
        username: message.author.username,
        isSlash: false,
        async reply(options: DiscordReplyOptions | string) {
            replyMsg = await message.reply(options as Parameters<typeof message.reply>[0]);
            return replyMsg;
        },
        async editReply(options: DiscordReplyOptions | string) {
            if (replyMsg) return replyMsg.edit(options as Parameters<typeof replyMsg.edit>[0]);
            return message.reply(options as Parameters<typeof message.reply>[0]);
        },
        async deferReply() {
            if ('sendTyping' in message.channel) {
                await message.channel.sendTyping();
            }
            replyMsg = await message.reply('⏳ Thinking...');
        },
        async followUp(options: DiscordReplyOptions | string) {
            const opts = typeof options === 'string' ? { content: options } : options;
            return sendToChannel(message.channel, opts);
        },
    };
}

function fromInteraction(interaction: ChatInputCommandInteraction): CommandContext {
    return {
        userId: interaction.user.id,
        username: interaction.user.username,
        isSlash: true,
        async reply(options: DiscordReplyOptions | string) {
            if (interaction.deferred) {
                return interaction.editReply(options as Parameters<typeof interaction.editReply>[0]);
            }
            return interaction.reply(options as Parameters<typeof interaction.reply>[0]) as unknown as DiscordMessage | void;
        },
        async editReply(options: DiscordReplyOptions | string) {
            return interaction.editReply(options as Parameters<typeof interaction.editReply>[0]);
        },
        async deferReply() {
            await interaction.deferReply();
        },
        async followUp(options: DiscordReplyOptions | string) {
            return interaction.followUp(options as Parameters<typeof interaction.followUp>[0]);
        },
    };
}

export function registerCommands(client: Client) {
    // ═══ Slash Command Handler ═══
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const userId = interaction.user.id;
        const command = interaction.commandName;

        if (rateLimiter.check(userId)) {
            await interaction.reply({
                embeds: [buildRateLimitEmbed()],
                ephemeral: true,
            });
            return;
        }

        const ctx = fromInteraction(interaction);

        try {
            switch (command) {
                case 'ask': {
                    const question = sanitizeInput(interaction.options.getString('question', true));
                    await handleAskSlash(ctx, question);
                    break;
                }
                case 'explain': {
                    const concept = sanitizeInput(interaction.options.getString('concept', true));
                    const level = interaction.options.getString('level') ?? undefined;
                    await handleExplainSlash(ctx, concept, level);
                    break;
                }
                case 'related': {
                    const topic = sanitizeInput(interaction.options.getString('topic', true));
                    await handleRelatedSlash(ctx, topic);
                    break;
                }
                case 'setlevel': {
                    const level = interaction.options.getString('level', true);
                    await handleSetLevelSlash(ctx, level);
                    break;
                }
                case 'history':
                    await handleHistorySlash(ctx);
                    break;
                case 'ping':
                    await handlePing(ctx, client);
                    break;
                case 'help':
                    await sendHelpMessage(ctx);
                    break;
                case 'quiz': {
                    const topic = sanitizeInput(interaction.options.getString('topic', true));
                    const quizLevel = interaction.options.getString('level') as Level | null;
                    const quizCount = interaction.options.getInteger('count');
                    await handleQuizSlash(ctx, topic, orchestrator, quizLevel ?? undefined, quizCount ?? undefined);
                    break;
                }
            }
        } catch (error: unknown) {
            logger.error({ error: getErrorMessage(error), command, userId }, 'Slash command failed');
            try {
                const errorEmbed = buildErrorEmbed('Something went wrong', getErrorMessage(error));
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch { /* ignore reply errors */ }
        }
    });

    // ═══ Legacy message prefix handler (backward compatible) ═══
    client.on(Events.MessageCreate, async (message: Message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
        const command = args.shift()?.toLowerCase();
        if (!command) return;

        if (rateLimiter.check(message.author.id)) {
            await message.reply({ embeds: [buildRateLimitEmbed()] });
            return;
        }

        try {
            switch (command) {
                case 'explain':
                case 'e':
                    await handleExplainCommand(message, args, orchestrator);
                    break;
                case 'ask':
                case 'a':
                    await handleAskCommand(message, args, orchestrator);
                    break;
                case 'setlevel':
                case 'level':
                    await handleSetLevelCommand(message, args, orchestrator);
                    break;
                case 'history':
                case 'h':
                    await handleHistoryCommand(message, orchestrator);
                    break;
                case 'related':
                case 'r':
                    await handleRelatedCommand(message, args, orchestrator);
                    break;
                case 'ping':
                    await handlePing(fromMessage(message), client);
                    break;
                case 'help':
                    await sendHelpMessage(fromMessage(message));
                    break;
                case 'quiz':
                case 'q':
                    await handleQuizCommand(message, args, orchestrator);
                    break;
                default:
                    break;
            }
        } catch (error: unknown) {
            logger.error({ error: getErrorMessage(error), command, userId: message.author.id }, 'Command execution failed');
        }
    });
}


async function handleAskSlash(ctx: CommandContext, question: string) {
    await ctx.deferReply();

    const { result, userContext } = await orchestrator.handleAsk(ctx.userId, ctx.username, question);

    const answer = result.answer ?? 'No answer generated.';
    const isHigh = result.confidence >= CONFIDENCE.HIGH;
    const isLow = result.confidence < CONFIDENCE.LOW;
    const color = isHigh ? EMBED_COLORS.ask : isLow ? EMBED_COLORS.error : EMBED_COLORS.warning;
    const icon = isHigh ? '✅' : isLow ? '⚠️' : '💬';
    const footer = `${formatLevelBadge(userContext.preferredLevel)} • ${formatConfidence(result.confidence)} • ${getFooterTip()}`;

    let fullText = answer;
    if (result.keyTakeaways?.length) {
        fullText += '\n\n**🔑 Key Takeaways:**\n' + result.keyTakeaways.map((t: string) => `✦ ${t}`).join('\n');
    }
    if (result.suggestedFollowups?.length) {
        fullText += '\n\n**💡 Keep Exploring:**\n' + result.suggestedFollowups.map((f: string) => `→ \`/ask ${f}\``).join('\n');
    }

    const { splitIntoEmbeds } = await import('../embeds/explain.js');
    const embeds = splitIntoEmbeds(fullText, {
        title: `${icon} ${truncate(question, 200)}`,
        color,
        footer,
    });

    await ctx.editReply({ content: '', embeds: [embeds[0]] });

    // Each continuation as its own separate message (1 embed per followUp)
    for (let i = 1; i < embeds.length; i++) {
        await ctx.followUp({ embeds: [embeds[i]] });
    }
}

async function handleExplainSlash(ctx: CommandContext, concept: string, level?: string) {
    await ctx.deferReply();

    const { result, userContext } = await orchestrator.handleExplain(
        ctx.userId, ctx.username, concept, level as Level | undefined
    );

    const { buildExplainEmbed } = await import('../embeds/explain.js');
    const embeds = buildExplainEmbed(concept, (level as Level) ?? userContext.preferredLevel, result);

    await ctx.editReply({ content: '', embeds: [embeds[0]] });

    for (let i = 1; i < embeds.length; i++) {
        await ctx.followUp({ embeds: [embeds[i]] });
    }
}

async function handleRelatedSlash(ctx: CommandContext, topic: string) {
    await ctx.deferReply();

    const result = await orchestrator.handleRelated(ctx.userId, ctx.username, topic);

    let fullText = result?.answer ?? 'No related topics found.';
    if (result?.suggestedFollowups?.length) {
        fullText += '\n\n**💡 Dive Deeper:**\n' + result.suggestedFollowups.map((f: string) => `→ \`/explain ${f}\``).join('\n');
    }

    const { splitIntoEmbeds } = await import('../embeds/explain.js');
    const embeds = splitIntoEmbeds(fullText, {
        title: `🔗 Related to: ${truncate(topic, 200)}`,
        color: EMBED_COLORS.related,
        footer: getFooterTip(),
    });

    await ctx.editReply({ content: '', embeds: [embeds[0]] });

    for (let i = 1; i < embeds.length; i++) {
        await ctx.followUp({ embeds: [embeds[i]] });
    }
}

async function handleSetLevelSlash(ctx: CommandContext, level: string) {
    await orchestrator.handleSetLevel(ctx.userId, ctx.username, level as Level);

    const levelDescriptions: Record<string, string> = {
        beginner: 'Simple language with analogies and real-world comparisons',
        intermediate: 'Technical terms, real tool commands, practical examples',
        expert: 'Protocol internals, CVE references, MITRE ATT&CK IDs, edge cases',
    };

    const emoji = LEVEL_EMOJI[level as Level] ?? '📊';

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} Level Updated`)
        .setColor(EMBED_COLORS.success)
        .setDescription(
            `Your learning level is now **${level.charAt(0).toUpperCase() + level.slice(1)}**.\n\n` +
            `> ${levelDescriptions[level] ?? ''}\n\n` +
            '**Try it out:** `/explain SQL injection`'
        )
        .setTimestamp()
        .setFooter({ text: APP_FOOTER });

    await ctx.reply({ embeds: [embed] });
}

async function handleHistorySlash(ctx: CommandContext) {
    await ctx.deferReply();

    const result = await orchestrator.handleHistory(ctx.userId, ctx.username);

    if (!result || result.history.length === 0) {
        // First interaction ever — show a premium welcome/onboarding embed
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`🛡️ Welcome to ${APP_NAME}`)
            .setColor(EMBED_COLORS.success)
            .setAuthor({ name: '🛡️ OffSec AI Learning Companion' })
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2092/2092663.png')
            .setDescription(
                '**Your elite cybersecurity learning journey starts here.**\n\n' +
                '> I am your AI-powered companion designed for the OffSec community. ' +
                'I can explain complex concepts, research vulnerabilities, and map your progress.\n\n' +
                '**🚀 Quick Start:**\n' +
                '1. **Set your level:** `/setlevel beginner` (or intermediate/expert)\n' +
                '2. **Ask something:** `/ask What is SQL injection?`\n' +
                '3. **Get deep detail:** `/explain buffer overflow`\n\n' +
                'I will adapt my responses as you grow from 🌱 **Beginner** to 🔬 **Expert**.'
            )
            .setTimestamp()
            .setFooter({ text: `${getFooterTip()}` });

        await ctx.editReply({ embeds: [welcomeEmbed] });
        return;
    }

    // Rich history with stats and progress bar
    const cmdEmojis: Record<string, string> = { explain: '🔐', ask: '❓', related: '🔗', setlevel: '📊' };

    // Calculate progress (just a demo stat based on total interactions)
    const progressPct = Math.min(100, (result.totalInteractions / 30) * 100);
    const progressBar = createProgressBar(progressPct);

    const historyLines = result.history.map((h: { command: string; timestamp: string; query: string; confidence?: number }) => {
        const emoji = cmdEmojis[h.command] ?? '📝';
        const date = new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${emoji} **${h.command}** — ${truncate(h.query, 50)}\n   ⏰ ${date} • 🎯 ${Math.round((h.confidence ?? 0) * 100)}%`;
    });

    const embed = new EmbedBuilder()
        .setTitle(`📜 ${ctx.username}'s Learning Journey`)
        .setColor(EMBED_COLORS.history)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2643/2643506.png') // Progress icon
        .setDescription(
            `### 📊 Learning Profile\n` +
            `**Overall Progress:** ${progressBar}\n` +
            `**Total Interactions:** \`${result.totalInteractions}\` sessions\n\n` +
            `### 🕓 Recent Activity\n` +
            truncate(historyLines.join('\n\n'), 2000)
        )
        .setTimestamp()
        .setFooter({ text: getFooterTip() });

    const embeds = [embed];

    if (result.summary) {
        const summaryEmbed = new EmbedBuilder()
            .setColor(EMBED_COLORS.history)
            .setTitle('🧠 Knowledge Summary')
            .setDescription(truncate(result.summary, 4000))
            .setFooter({ text: `Explore connections with /related • ${APP_FOOTER}` });
        embeds.push(summaryEmbed);
    }

    await ctx.editReply({ embeds });
}

// ═══ Shared Handlers (work with both) ═══

async function handlePing(ctx: CommandContext, client: Client) {
    const latency = Date.now() - Date.now(); // approximation for slash
    const apiLatency = Math.round(client.ws.ping);
    const uptime = client.uptime ?? 0;
    const heapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const statusEmoji = apiLatency < 100 ? '🟢' : apiLatency < 300 ? '🟡' : '🔴';

    const embed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .setColor(EMBED_COLORS.ping)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/3138/3138382.png') // Heartbeat icon
        .setDescription(`> ${statusEmoji} All systems operational\n> Connected to **${client.guilds.cache.size}** server(s)`)
        .addFields(
            { name: '🌐 API', value: `\`${apiLatency}ms\``, inline: true },
            { name: '⏰ Uptime', value: `\`${formatUptime(uptime)}\``, inline: true },
            { name: '💾 Memory', value: `\`${heapMB} MB\``, inline: true },
            { name: '🤖 Version', value: `\`v${APP_VERSION}\``, inline: true },
            { name: '⚡ Node.js', value: `\`${process.version}\``, inline: true },
            { name: '📊 Guilds', value: `\`${client.guilds.cache.size}\``, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: getFooterTip() });

    await ctx.reply({ embeds: [embed] });
}

async function sendHelpMessage(ctx: CommandContext) {
    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${APP_NAME}`)
        .setColor(EMBED_COLORS.info)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/1063/1063376.png') // Help icon
        .setAuthor({ name: '🛡️ OffSec AI Learning Companion' })
        .setDescription(
            '```\n' +
            '╔══════════════════════════════════════════╗\n' +
            '║   AI-Powered Cybersecurity Learning      ║\n' +
            '║   RAG + LLM • Adaptive Difficulty        ║\n' +
            '╚══════════════════════════════════════════╝\n' +
            '```\n' +
            '> Your personal cybersecurity tutor powered by **AI + RAG**.\n' +
            '> Responses adapt to your skill level automatically.\n\n' +
            `> **Skill Levels:** ${LEVEL_EMOJI.beginner} Beginner • ${LEVEL_EMOJI.intermediate} Intermediate • ${LEVEL_EMOJI.expert} Expert`
        )
        .addFields(
            {
                name: '━━ 🎓 Learning Commands ━━',
                value:
                    '**`/ask`** `question` — Ask any cybersecurity question\n' +
                    '**`/explain`** `concept` `[level]` — Get a detailed explanation\n' +
                    '**`/related`** `topic` — Discover connected concepts\n' +
                    '**`/quiz`** `topic` — Test your knowledge with a quiz\n\n' +
                    '> 💬 **Prefix shortcuts:** `/a`, `/e`, `/r`, `/q`, `/h`, `/level`',
            },
            {
                name: '━━ ⚙️ Utility Commands ━━',
                value:
                    '**`/setlevel`** `level` — Set your skill level\n' +
                    '**`/history`** — View your learning journey\n' +
                    '**`/ping`** — Check bot status & latency',
            },
            {
                name: '━━ 🚀 Quick Start ━━',
                value:
                    '```\n/setlevel beginner\n/ask What is SQL injection?\n/explain buffer overflow\n/related privilege escalation\n```',
            }
        )
        .setTimestamp()
        .setFooter({ text: `${getFooterTip()}` });

    await ctx.reply({ embeds: [embed] });
}

// ═══ Utilities ═══

// isRateLimited is now handled by RateLimiter class (utils/rateLimit.ts)

function buildRateLimitEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('⏳ Cooldown Active')
        .setColor(EMBED_COLORS.warning)
        .setDescription('You\'re sending commands too fast.\nPlease wait a few seconds before trying again.')
        .setTimestamp()
        .setFooter({ text: getFooterTip() });
}

function formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

function splitText(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= maxLen) { chunks.push(remaining); break; }
        let idx = remaining.lastIndexOf('\n\n', maxLen);
        if (idx < maxLen * 0.4) idx = remaining.lastIndexOf('\n', maxLen);
        if (idx < maxLen * 0.4) idx = maxLen;
        chunks.push(remaining.slice(0, idx));
        remaining = remaining.slice(idx).trimStart();
    }
    return chunks;
}
