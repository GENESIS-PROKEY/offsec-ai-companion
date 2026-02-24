// Discord channel utility — type-safe helpers that eliminate `as any` casts
// Handles discord.js's union channel types cleanly

import type { Message, TextBasedChannel, EmbedBuilder, BaseMessageOptions } from 'discord.js';

// ─── Type-Safe Channel Helpers ───────────────────────────────────────

/**
 * Safely send typing indicator to a channel.
 * Discord.js channels may not always support sendTyping (e.g. DM channels in some cases).
 */
export async function sendTyping(channel: TextBasedChannel): Promise<void> {
    if ('sendTyping' in channel && typeof channel.sendTyping === 'function') {
        await channel.sendTyping();
    }
}

/**
 * Safely send a message to a channel.
 * Returns the sent message, or null if the channel doesn't support sending.
 */
export async function sendToChannel(
    channel: TextBasedChannel,
    options: BaseMessageOptions
): Promise<Message | null> {
    if ('send' in channel && typeof channel.send === 'function') {
        return await channel.send(options);
    }
    return null;
}

/**
 * Send multiple embeds as separate messages (1 embed per message).
 * Skips the first embed (index 0) — that's typically edited into the thinking message.
 */
export async function sendContinuationEmbeds(
    channel: TextBasedChannel,
    embeds: EmbedBuilder[],
    startIndex: number = 1
): Promise<void> {
    for (let i = startIndex; i < embeds.length; i++) {
        await sendToChannel(channel, { embeds: [embeds[i]] });
    }
}

// ─── Typing Indicator Manager ────────────────────────────────────────

/**
 * Starts a typing indicator that refreshes every 8 seconds.
 * Discord expires typing after ~10s, so we need to keep it alive.
 * Returns a cleanup function that stops the interval.
 */
export function startTypingIndicator(channel: TextBasedChannel): () => void {
    const interval = setInterval(() => {
        sendTyping(channel).catch(() => { /* swallow — channel may have changed */ });
    }, 8_000);

    return () => clearInterval(interval);
}
