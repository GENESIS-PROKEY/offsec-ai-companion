// Register Discord slash commands with the API
// Usage: npx tsx scripts/deploy-commands.ts

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

const commands = [
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask any cybersecurity question — powered by AI + RAG')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('Your cybersecurity question')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('explain')
        .setDescription('Get a detailed, level-appropriate explanation of a cybersecurity concept')
        .addStringOption(opt =>
            opt.setName('concept')
                .setDescription('The concept to explain (e.g., SQL injection, buffer overflow)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('level')
                .setDescription('Override your skill level for this response')
                .setRequired(false)
                .addChoices(
                    { name: '🌱 Beginner', value: 'beginner' },
                    { name: '⚡ Intermediate', value: 'intermediate' },
                    { name: '🔬 Expert', value: 'expert' },
                )
        ),

    new SlashCommandBuilder()
        .setName('related')
        .setDescription('Discover related cybersecurity concepts and learning paths')
        .addStringOption(opt =>
            opt.setName('topic')
                .setDescription('The topic to find connections for')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('setlevel')
        .setDescription('Set your skill level to personalize all responses')
        .addStringOption(opt =>
            opt.setName('level')
                .setDescription('Your learning level')
                .setRequired(true)
                .addChoices(
                    { name: '🌱 Beginner — Simple language, analogies', value: 'beginner' },
                    { name: '⚡ Intermediate — Technical, practical', value: 'intermediate' },
                    { name: '🔬 Expert — Protocol internals, CVEs', value: 'expert' },
                )
        ),

    new SlashCommandBuilder()
        .setName('history')
        .setDescription('View your learning journey and interaction stats'),

    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot status, latency, and system info'),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands and how to use them'),

    new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Test your cybersecurity knowledge with an AI-generated quiz')
        .addStringOption(opt =>
            opt.setName('topic')
                .setDescription('The topic to quiz you on (e.g., SQL injection, buffer overflow)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('level')
                .setDescription('Difficulty level (default: your saved level)')
                .setRequired(false)
                .addChoices(
                    { name: '🌱 Beginner — Definitions & basics', value: 'beginner' },
                    { name: '⚡ Intermediate — Tools & practical', value: 'intermediate' },
                    { name: '🔬 Expert — Protocol internals & CVEs', value: 'expert' },
                )
        )
        .addIntegerOption(opt =>
            opt.setName('count')
                .setDescription('Number of questions (1-15, default: 5)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(15)
        ),
].map(cmd => cmd.toJSON());

async function deploy() {
    const rest = new REST().setToken(config.discord.token);

    try {
        logger.info(`🔄 Registering ${commands.length} slash commands...`);

        await rest.put(
            Routes.applicationCommands(config.discord.clientId),
            { body: commands }
        );

        logger.info('✅ Slash commands registered globally!');
        logger.info('ℹ️  Global commands may take up to 1 hour to appear. Guild commands are instant.');
    } catch (error: any) {
        logger.error({ error: error?.message }, '❌ Failed to register slash commands');
        process.exit(1);
    }
}

deploy();
