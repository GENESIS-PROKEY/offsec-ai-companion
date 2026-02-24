// /quiz command handler — Interactive cybersecurity MCQ quiz
// Uses Discord Buttons for reliable answering + multi-question rounds with score tracking

import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type BaseMessageOptions } from 'discord.js';
import type { MCPOrchestrator } from '../../mcp/orchestrator.js';
import { EMBED_COLORS, LEVELS, MAX_INPUT_LENGTH, getFooterTip, type Level, LEVEL_EMOJI } from '../../config/constants.js';
import { buildErrorEmbed } from '../embeds/error.js';
import { buildThinkingEmbed } from '../embeds/thinking.js';
import type { CommandContext } from './index.js';
import type { DiscordReplyOptions } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { sanitizeInput } from '../../utils/sanitize.js';
import { incrementErrorCount } from '../../services/health.js';
import { getErrorMessage } from '../../utils/errors.js';
import { sendTyping, sendToChannel } from '../../utils/discord.js';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_EMOJI = ['🅰️', '🅱️', '©️', '🇩'];
const QUIZ_TIMEOUT = 30_000; // 30 seconds per question
const DEFAULT_QUESTIONS = 5;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 15;
// MAX_INPUT_LENGTH imported from constants

interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    difficulty?: string;
    subTopic?: string;
}

/**
 * Build the buttons row for a quiz question
 */
function buildOptionButtons(questionId: string, optionCount: number, disabled = false, correctIndex?: number, selectedIndex?: number): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (let i = 0; i < optionCount; i++) {
        let style = ButtonStyle.Secondary;

        if (disabled && correctIndex !== undefined) {
            if (i === correctIndex) style = ButtonStyle.Success;
            else if (i === selectedIndex) style = ButtonStyle.Danger;
        }

        const button = new ButtonBuilder()
            .setCustomId(`quiz_${questionId}_${i}`)
            .setLabel(`${OPTION_LABELS[i]}`)
            .setStyle(style)
            .setDisabled(disabled);

        row.addComponents(button);
    }

    return row;
}

/**
 * Build the quiz question embed
 */
function buildQuestionEmbed(quiz: QuizQuestion, topic: string, questionNum: number, totalQuestions: number, score: number): EmbedBuilder {
    const optionsText = quiz.options
        .map((opt: string, i: number) => `**${OPTION_LABELS[i]}.** ${opt}`)
        .join('\n');

    const progressBar = buildProgressBar(questionNum, totalQuestions);

    return new EmbedBuilder()
        .setTitle(`🧠 Quiz: ${topic}`)
        .setColor(0x5865F2)
        .setAuthor({ name: '🛡️ OffSec AI Learning Companion' })
        .setDescription(
            `${progressBar}\n\n` +
            `**Question ${questionNum}/${totalQuestions}**` +
            (quiz.subTopic ? ` — _${quiz.subTopic}_` : '') + `\n\n` +
            `${quiz.question}\n\n` +
            `${optionsText}\n\n` +
            `⏱️ *30 seconds to answer — click a button below!*`
        )
        .setTimestamp()
        .setFooter({ text: `Score: ${score}/${questionNum - 1} • Difficulty: ${quiz.difficulty ?? 'Intermediate'} • Q${questionNum}/${totalQuestions} • ${getFooterTip()}` });
}

/**
 * Build the result embed after answering
 */
function buildResultEmbed(quiz: QuizQuestion, userCorrect: boolean, selectedIndex: number, topic: string): EmbedBuilder {
    const resultColor = userCorrect ? 0x57F287 : 0xED4245;
    const resultIcon = userCorrect ? '✅' : '❌';

    return new EmbedBuilder()
        .setColor(resultColor)
        .setDescription(
            `${resultIcon} ${userCorrect ? '**Correct!**' : `**Incorrect!** The answer was **${OPTION_LABELS[quiz.correctIndex]}.** ${quiz.options[quiz.correctIndex]}`}\n\n` +
            `📖 ${quiz.explanation}`
        );
}

/**
 * Build a visual progress bar
 */
function buildProgressBar(current: number, total: number): string {
    const filled = current - 1; // questions completed
    const remaining = total - filled;
    return `${'🟩'.repeat(filled)}${'⬜'.repeat(remaining)} (${filled}/${total} complete)`;
}

/**
 * Build the final score embed
 */
function buildFinalScoreEmbed(score: number, totalQuestions: number, topic: string): EmbedBuilder {
    const percentage = Math.round((score / totalQuestions) * 100);
    let grade: string;
    let color: number;
    let emoji: string;

    if (percentage >= 80) {
        grade = 'Excellent!';
        color = 0x57F287;
        emoji = '🏆';
    } else if (percentage >= 60) {
        grade = 'Good job!';
        color = 0xFEE75C;
        emoji = '⭐';
    } else if (percentage >= 40) {
        grade = 'Keep practicing!';
        color = 0xED4245;
        emoji = '📚';
    } else {
        grade = 'Study more on this topic!';
        color = 0xED4245;
        emoji = '💪';
    }

    const bars = '█'.repeat(Math.round(percentage / 10)) + '░'.repeat(10 - Math.round(percentage / 10));

    return new EmbedBuilder()
        .setTitle(`${emoji} Quiz Complete: ${topic}`)
        .setColor(color)
        .setAuthor({ name: '🛡️ OffSec AI Learning Companion' })
        .setDescription(
            `**${grade}**\n\n` +
            `**Score:** ${score}/${totalQuestions} (${percentage}%)\n` +
            `\`${bars}\` ${percentage}%\n\n` +
            `───────────────\n\n` +
            `💡 **Next steps:**\n` +
            `→ \`/explain ${topic}\` — Deep dive into this topic\n` +
            `→ \`/quiz ${topic}\` — Try again for a better score\n` +
            `→ \`/related ${topic}\` — Explore connected concepts`
        )
        .setTimestamp()
        .setFooter({ text: `${getFooterTip()}` });
}

// ─── Prefix Command Handler ──────────────────────────────────────────

export async function handleQuizCommand(
    message: Message,
    args: string[],
    orchestrator: MCPOrchestrator
) {
    // Parse --level flag
    let level: Level | undefined;
    const levelFlagIndex = args.indexOf('--level');
    if (levelFlagIndex !== -1 && args[levelFlagIndex + 1]) {
        const requested = args[levelFlagIndex + 1].toLowerCase() as Level;
        if (LEVELS.includes(requested)) {
            level = requested;
        }
        args.splice(levelFlagIndex, 2);
    }

    // Parse --count flag
    let questionsCount = DEFAULT_QUESTIONS;
    const countFlagIndex = args.indexOf('--count');
    if (countFlagIndex !== -1 && args[countFlagIndex + 1]) {
        const parsed = parseInt(args[countFlagIndex + 1], 10);
        if (!isNaN(parsed) && parsed >= MIN_QUESTIONS && parsed <= MAX_QUESTIONS) {
            questionsCount = parsed;
        }
        args.splice(countFlagIndex, 2);
    }

    const topic = sanitizeInput(args.join(' '));

    if (!topic) {
        const embed = new EmbedBuilder()
            .setTitle('🧠 Cybersecurity Quiz')
            .setColor(EMBED_COLORS.ask)
            .setDescription(
                '> Test your cybersecurity knowledge with an AI-generated quiz!\n' +
                `> Default: **${DEFAULT_QUESTIONS} questions** at your saved difficulty level.\n\n` +
                '**Usage:** `/quiz <topic> [--level beginner|intermediate|expert] [--count 1-15]`\n\n' +
                '**Examples:**'
            )
            .addFields(
                { name: '💉 Basic', value: '`/quiz SQL injection`', inline: true },
                { name: '🔐 With Level', value: '`/quiz AES --level expert`', inline: true },
                { name: '🐧 Custom Count', value: '`/quiz privesc --count 10`', inline: true },
                { name: '🌐 Full Options', value: '`/quiz TCP --level beginner --count 3`', inline: true },
            )
            .setTimestamp()
            .setFooter({ text: getFooterTip() });

        await message.reply({ embeds: [embed] });
        return;
    }

    if (topic.length > MAX_INPUT_LENGTH) {
        await message.reply({ embeds: [buildErrorEmbed('Input too long', `Topic must be under ${MAX_INPUT_LENGTH} characters.`)] });
        return;
    }

    await sendTyping(message.channel);

    const thinkingEmbed = buildThinkingEmbed('quiz');
    const thinkingMsg = await message.reply({ embeds: [thinkingEmbed] });

    try {
        await runQuizRound(topic, orchestrator, message.author.id, message.author.username, {
            editMessage: async (opts) => { await thinkingMsg.edit(opts); return thinkingMsg; },
            sendMessage: async (opts) => {
                return await sendToChannel(message.channel, opts);
            },
            userId: message.author.id,
        }, questionsCount, level);
    } catch (error: unknown) {
        logger.error({ error: getErrorMessage(error) }, 'Quiz command failed');
        incrementErrorCount(getErrorMessage(error));
        const errorEmbed = buildErrorEmbed(
            'Quiz generation failed',
            `Couldn't generate a quiz about **${topic}**.\n\n**Error:** ${getErrorMessage(error)}`
        );
        await thinkingMsg.edit({ content: '', embeds: [errorEmbed] });
    }
}

// ─── Slash Command Handler ───────────────────────────────────────────

export async function handleQuizSlash(
    ctx: CommandContext,
    topic: string,
    orchestrator: MCPOrchestrator,
    level?: Level,
    count?: number
) {
    const questionsCount = count && count >= MIN_QUESTIONS && count <= MAX_QUESTIONS ? count : DEFAULT_QUESTIONS;
    await ctx.deferReply();

    try {
        await runQuizRound(topic, orchestrator, ctx.userId, ctx.username, {
            editMessage: async (opts) => {
                const reply = await ctx.editReply(opts as DiscordReplyOptions);
                return reply;
            },
            sendMessage: async (opts) => {
                const reply = await ctx.followUp(opts as DiscordReplyOptions);
                return reply;
            },
            userId: ctx.userId,
        }, questionsCount, level);
    } catch (error: unknown) {
        logger.error({ error: getErrorMessage(error) }, 'Quiz slash command failed');
        incrementErrorCount(getErrorMessage(error));
        const errorEmbed = buildErrorEmbed(
            'Quiz generation failed',
            `Couldn't generate a quiz about **${topic}**.\n\n**Error:** ${getErrorMessage(error)}`
        );
        await ctx.editReply({ embeds: [errorEmbed] });
    }
}

// ─── Core Quiz Engine ────────────────────────────────────────────────

interface QuizIO {
    editMessage: (opts: BaseMessageOptions) => Promise<Message | null | void>;
    sendMessage: (opts: BaseMessageOptions) => Promise<Message | null | void>;
    userId: string;
}

async function runQuizRound(
    topic: string,
    orchestrator: MCPOrchestrator,
    userId: string,
    username: string,
    io: QuizIO,
    totalQuestions: number = DEFAULT_QUESTIONS,
    levelOverride?: Level
) {
    let score = 0;
    const previousQuestions: string[] = [];

    for (let q = 1; q <= totalQuestions; q++) {
        // Generate question (show loading for questions 2+)
        if (q > 1) {
            const loadingEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setDescription(`⏳ Generating question ${q}/${totalQuestions}...`)
                .setFooter({ text: `Score: ${score}/${q - 1}` });

            await io.sendMessage({ embeds: [loadingEmbed] });
        }

        let quiz: QuizQuestion;
        try {
            quiz = await orchestrator.handleQuiz(userId, username, topic, q, previousQuestions, totalQuestions, levelOverride);
        } catch (err: unknown) {
            logger.warn({ error: getErrorMessage(err), question: q }, 'Failed to generate quiz question, skipping');
            if (q === 1) throw err; // If the first question fails, abort
            continue;
        }

        // Track this question to prevent repeats
        previousQuestions.push(quiz.question);

        // Build question embed + buttons
        const questionId = `${Date.now()}_${q}`;
        const questionEmbed = buildQuestionEmbed(quiz, topic, q, totalQuestions, score);
        const buttonRow = buildOptionButtons(questionId, quiz.options.length);

        // Send the question
        let questionMsg: Message | null | void;
        if (q === 1) {
            questionMsg = await io.editMessage({ content: '', embeds: [questionEmbed], components: [buttonRow] });
        } else {
            questionMsg = await io.sendMessage({ embeds: [questionEmbed], components: [buttonRow] });
        }

        if (!questionMsg) continue;

        // Wait for button click
        try {
            const buttonInteraction = await questionMsg.awaitMessageComponent({
                componentType: ComponentType.Button,
                filter: (i: { user: { id: string }; customId: string }) => i.user.id === io.userId && i.customId.startsWith(`quiz_${questionId}_`),
                time: QUIZ_TIMEOUT,
            });

            const selectedIndex = parseInt(buttonInteraction.customId.split('_').pop()!, 10);
            const userCorrect = selectedIndex === quiz.correctIndex;
            if (userCorrect) score++;

            // Update the question with disabled buttons (colored)
            const disabledRow = buildOptionButtons(questionId, quiz.options.length, true, quiz.correctIndex, selectedIndex);
            const resultEmbed = buildResultEmbed(quiz, userCorrect, selectedIndex, topic);

            await buttonInteraction.update({
                embeds: [questionEmbed, resultEmbed],
                components: [disabledRow],
            });

        } catch {
            // Timeout — no answer
            const disabledRow = buildOptionButtons(questionId, quiz.options.length, true, quiz.correctIndex);
            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(
                    `⏱️ **Time's up!** The answer was **${OPTION_LABELS[quiz.correctIndex]}.** ${quiz.options[quiz.correctIndex]}\n\n` +
                    `📖 ${quiz.explanation}`
                );

            await questionMsg.edit({
                embeds: [questionEmbed, timeoutEmbed],
                components: [disabledRow],
            }).catch(() => { });
        }

        // Small delay between questions
        if (q < totalQuestions) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Final score
    const finalEmbed = buildFinalScoreEmbed(score, totalQuestions, topic);
    await io.sendMessage({ embeds: [finalEmbed] });
}
