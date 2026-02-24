// Explain embed builder — continuation embeds for long responses
// Respects Discord's 6000 char total embed limit
// UI Upgrades: Level-based colors, Author line, Thumbnails, and Separators

import { EmbedBuilder } from 'discord.js';
import type { ExplainResult } from '../../types/index.js';
import type { Level } from '../../config/constants.js';
import { EMBED_COLORS, getFooterTip, LEVEL_EMOJI } from '../../config/constants.js';
import { formatLevelBadge, truncate } from '../../utils/formatters.js';
import { formatLabsForEmbed } from '../../utils/labs.js';
import { formatCoursesForEmbed } from '../../utils/courses.js';

/**
 * Builds explain embeds array. Each embed is sent as a separate message.
 */
export function buildExplainEmbed(
    concept: string,
    level: Level,
    result: ExplainResult,
    elapsed?: string
): EmbedBuilder[] {
    let body = result.explanation ?? 'No explanation generated.';

    // Inject visual separators between sections (if they match the emoji header pattern)
    body = body.replace(/\n\n(\*\*[\u{1F300}-\u{1F9FF}].*?\*\*)/gu, '\n\n───────────────\n$1');

    if (result.analogies && result.analogies.length > 0) {
        body += '\n\n───────────────\n**💡 Think of it like:**\n' + result.analogies.map(a => `> _${truncate(a, 200)}_`).join('\n');
    }
    if (result.practicalTip) {
        body += `\n\n**🎯 Pro Tip:** ${result.practicalTip}`;
    }
    if (result.relatedConcepts && result.relatedConcepts.length > 0) {
        body += '\n\n**🔗 Related:** ' + result.relatedConcepts.map(c => `\`${c}\``).join(' • ');
    }

    // Real labs with clickable links (new)
    if (result.labs && result.labs.length > 0) {
        const labsText = formatLabsForEmbed(result.labs);
        body += '\n\n───────────────\n**🔬 Hands-On Labs:**\n' + labsText;
    }
    // Fallback: legacy offSecModules (plain text)
    else if (result.offSecModules && result.offSecModules.length > 0) {
        body += '\n\n───────────────\n**🎓 OffSec Training:**\n' + result.offSecModules.map(m => `→ ${m}`).join('\n');
    }

    // Recommended courses with clickable links
    if (result.courses && result.courses.length > 0) {
        const coursesText = formatCoursesForEmbed(result.courses);
        body += '\n\n**📚 Recommended Courses:**\n' + coursesText;
    }

    // Level-based color gradient
    const embedColor = EMBED_COLORS.explain[level];

    return splitIntoEmbeds(body, {
        title: `${LEVEL_EMOJI[level]} ${truncate(concept, 200)}`,
        color: embedColor,
        footer: `${formatLevelBadge(level)}${elapsed ? ` • ⚡ ${elapsed}s` : ''} • ${getFooterTip()}`,
    });
}

/**
 * Split long text into multiple embeds, each safe to send as its own message.
 */
export function splitIntoEmbeds(
    text: string,
    opts: { title: string; color: number; footer: string }
): EmbedBuilder[] {
    const EMBED_TOTAL_LIMIT = 6000;
    const OVERHEAD = 150; // Increased for author/thumbnail
    const titleLen = opts.title.length;
    const footerLen = opts.footer.length;

    const maxDescSingle = Math.min(4096, EMBED_TOTAL_LIMIT - titleLen - footerLen - OVERHEAD);
    const maxDescFirst = Math.min(4096, EMBED_TOTAL_LIMIT - titleLen - OVERHEAD);
    const maxDescMiddle = Math.min(4096, EMBED_TOTAL_LIMIT - OVERHEAD);
    const maxDescLast = Math.min(4096, EMBED_TOTAL_LIMIT - footerLen - OVERHEAD);

    if (text.length <= maxDescSingle) {
        return [
            createBaseEmbed(opts.color, text)
                .setTitle(opts.title)
                .setTimestamp()
                .setFooter({ text: opts.footer })
        ];
    }

    const chunks: string[] = [];
    let remaining = text;
    let chunkIndex = 0;

    while (remaining.length > 0) {
        const isFirst = chunkIndex === 0;
        const maxDesc = isFirst ? maxDescFirst : maxDescMiddle;

        if (remaining.length <= maxDesc) {
            chunks.push(remaining);
            break;
        }

        let splitAt = remaining.lastIndexOf('\n\n', maxDesc);
        if (splitAt < maxDesc * 0.4) splitAt = remaining.lastIndexOf('\n', maxDesc);
        if (splitAt < maxDesc * 0.4) splitAt = maxDesc;

        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt).trimStart();
        chunkIndex++;
    }

    const lastIdx = chunks.length - 1;
    if (lastIdx > 0 && chunks[lastIdx].length > maxDescLast) {
        const last = chunks.pop()!;
        let splitAt = last.lastIndexOf('\n\n', maxDescLast);
        if (splitAt < maxDescLast * 0.4) splitAt = last.lastIndexOf('\n', maxDescLast);
        if (splitAt < maxDescLast * 0.4) splitAt = maxDescLast;
        chunks.push(last.slice(0, splitAt));
        chunks.push(truncate(last.slice(splitAt).trimStart(), maxDescLast));
    }

    return chunks.map((chunk, i) => {
        const embed = createBaseEmbed(opts.color, chunk);

        if (i === 0) embed.setTitle(opts.title);

        if (i === chunks.length - 1) {
            embed.setTimestamp();
            embed.setFooter({ text: opts.footer });
        }

        return embed;
    });
}

/**
 * Creates a base embed with branding (author/thumbnail)
 */
function createBaseEmbed(color: number, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: '🛡️ OffSec AI Learning Companion'
        })
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2092/2092663.png') // Cyber Shield icon
        .setDescription(description);
}
