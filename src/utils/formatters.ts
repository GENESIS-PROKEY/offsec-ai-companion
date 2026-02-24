// Text formatting utilities for Discord embeds and response processing

import { LEVEL_EMOJI, CONFIDENCE_EMOJI, type Level } from '../config/constants.js';

/**
 * Truncate text to Discord embed field limits.
 */
export function truncate(text: string, maxLength: number = 1024): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a level badge for Discord display.
 */
export function formatLevelBadge(level: Level): string {
    return `${LEVEL_EMOJI[level]} ${level.charAt(0).toUpperCase() + level.slice(1)}`;
}

/**
 * Format a confidence indicator.
 */
export function formatConfidence(score: number): string {
    const pct = Math.round(score * 100);
    if (score >= 0.6) return `${CONFIDENCE_EMOJI.high} High (${pct}%)`;
    if (score >= 0.3) return `${CONFIDENCE_EMOJI.medium} Medium (${pct}%)`;
    return `${CONFIDENCE_EMOJI.low} Low (${pct}%)`;
}

/**
 * Format citations into a numbered source list.
 */
export function formatCitations(sources: { source: string; url?: string }[]): string {
    return sources
        .map((s, i) => {
            const label = `[${i + 1}] ${s.source}`;
            return s.url ? `${label} — ${s.url}` : label;
        })
        .join('\n');
}

/**
 * Strip ONLY the outermost code fence from LLM output.
 * Uses greedy regex anchored to ^ and $ so nested code blocks
 * inside JSON string values are preserved.
 *
 * Handles: ```json {...} ```, ``` {...} ```, and raw text.
 */
export function stripOuterCodeFence(text: string): string {
    let cleaned = text.trim();

    // Greedy match anchored to start/end — strips ONLY the outermost fence
    const outerFence = cleaned.match(/^```(?:json|JSON|markdown|md)?\s*\n([\s\S]*)\n\s*```\s*$/);
    if (outerFence) {
        cleaned = outerFence[1].trim();
    } else {
        // Strip stray fence markers at boundaries only
        cleaned = cleaned
            .replace(/^```(?:json|JSON|markdown|md)?\s*\n?/, '')
            .replace(/\n?\s*```\s*$/, '')
            .trim();
    }

    return cleaned;
}


/**
 * Creates a visual progress bar using emojis.
 * Example: [🟩🟩🟩⬜⬜] 60%
 */
export function createProgressBar(percentage: number, length: number = 8): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return `[\`${'🟩'.repeat(filled)}${'⬜'.repeat(empty)}\`] **${Math.round(percentage)}%**`;
}

/**
 * Recursively flattens a nested JSON object into readable Discord markdown.
 * Handles structures like {title, sections: [{header, content}]}, arrays of terms, or arbitrary objects.
 */
export function flattenToMarkdown(obj: unknown): string {
    if (typeof obj === 'string') return obj;
    if (typeof obj !== 'object' || obj === null) return String(obj);

    const rec = obj as Record<string, unknown>;

    // Array of items — render each
    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (typeof item === 'string') return `• ${item}`;
            if (typeof item === 'object' && item !== null) {
                // Structured item with name/term + definition/description
                if (item.term || item.name) {
                    const label = item.term || item.name;
                    const desc = item.definition || item.description || item.explanation || '';
                    const analogy = item.analogy ? `\n> _💡 ${item.analogy}_` : '';
                    return `**${label}:** ${desc}${analogy}`;
                }
                return flattenToMarkdown(item);
            }
            return String(item);
        }).join('\n\n');
    }

    // Object with known structure
    const parts: string[] = [];

    if (rec.title) parts.push(`## ${rec.title}`);

    // Sections array
    if (rec.sections && Array.isArray(rec.sections)) {
        for (const section of rec.sections as Array<Record<string, unknown>>) {
            if (section.header) parts.push(`\n**${section.header}**`);
            if (section.content) parts.push(flattenToMarkdown(section.content));
            if (section.text) parts.push(String(section.text));
        }
    }

    // Generic key-value fallback for unknown structures
    if (!rec.sections) {
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'title') continue;
            if (typeof value === 'string') {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                parts.push(`**${label}:** ${value}`);
            } else if (Array.isArray(value)) {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                parts.push(`\n**${label}:**`);
                parts.push(flattenToMarkdown(value));
            } else if (typeof value === 'object' && value !== null) {
                parts.push(flattenToMarkdown(value));
            }
        }
    }

    return parts.join('\n');
}

/**
 * Sanitize LLM answer/explanation — handles objects, escaped chars, and residual JSON wrappers.
 * @param input  Raw value from JSON.parse (string or object)
 * @param field  The JSON field name to strip wrappers for (default: 'answer')
 */
export function sanitizeAnswer(input: unknown, field: string = 'answer'): string {
    // If the LLM returned an object instead of a string, flatten it
    if (typeof input === 'object' && input !== null) {
        return flattenToMarkdown(input);
    }

    let text = String(input);

    // Strip residual JSON wrapper like {"answer": "..."} or {"explanation": "..."}
    const wrapperRe = new RegExp(`^\\s*\\{\\s*"${field}"\\s*:\\s*"([\\s\\S]*)"\\s*[,}]`);
    const wrapperMatch = text.match(wrapperRe);
    if (wrapperMatch) {
        text = wrapperMatch[1];
    }

    // Fix escaped newlines: literal \n → real newline
    text = text.replace(/\\n/g, '\n');
    // Fix escaped quotes
    text = text.replace(/\\"/g, '"');
    // Fix escaped backslashes
    text = text.replace(/\\\\/g, '\\');
    // Clean up excessive blank lines (3+ → 2)
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
}
