// Discord bot client setup

import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { registerCommands } from './commands/index.js';

export function createBot() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    client.once(Events.ClientReady, (c) => {
        logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, '🤖 Bot is online');
    });

    // Register command handlers
    registerCommands(client);

    return client;
}

export async function startBot() {
    const client = createBot();
    await client.login(config.discord.token);
    return client;
}
